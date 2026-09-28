[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$SnapshotPath,

    [Parameter(Mandatory)]
    [string]$DestinationPath,

    [Parameter()]
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$snapshotFullPath = [System.IO.Path]::GetFullPath($SnapshotPath)
$destinationRoot = [System.IO.Path]::GetFullPath($DestinationPath)

if (-not (Test-Path -LiteralPath $snapshotFullPath -PathType Leaf)) {
    throw "Snapshot does not exist: $snapshotFullPath"
}

$snapshot = Get-Content -LiteralPath $snapshotFullPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ($snapshot.schemaVersion -ne 1) {
    throw "Unsupported snapshot schema version: $($snapshot.schemaVersion)"
}

if ($snapshot.hashAlgorithm -ne 'SHA-256' -or $snapshot.contentEncoding -ne 'base64') {
    throw 'Snapshot hash algorithm or content encoding is unsupported.'
}

function Resolve-SafeDestinationPath {
    param(
        [Parameter(Mandatory)]
        [string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw 'Snapshot contains an empty relative path.'
    }

    $normalized = $RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    if ([System.IO.Path]::IsPathRooted($normalized)) {
        throw "Snapshot contains an absolute path: $RelativePath"
    }

    $segments = $normalized.Split([System.IO.Path]::DirectorySeparatorChar)
    if ($segments -contains '..' -or $segments -contains '.') {
        throw "Snapshot contains an unsafe path: $RelativePath"
    }

    $resolved = [System.IO.Path]::GetFullPath((Join-Path $destinationRoot $normalized))
    $rootPrefix = $destinationRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    if ($resolved -ne $destinationRoot -and -not $resolved.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Snapshot path escapes the destination root: $RelativePath"
    }

    return $resolved
}

function Get-Sha256Hex {
    param(
        [Parameter(Mandatory)]
        [byte[]]$Bytes
    )

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($Bytes)
        return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
    }
}

$seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($directory in @($snapshot.directories)) {
    $relativePath = [string]$directory
    if (-not $seenPaths.Add($relativePath)) {
        throw "Duplicate or conflicting path in snapshot: $relativePath"
    }
    [void](Resolve-SafeDestinationPath -RelativePath $relativePath)
}

foreach ($file in @($snapshot.files)) {
    $relativePath = [string]$file.path
    if (-not $seenPaths.Add($relativePath)) {
        throw "Duplicate or conflicting path in snapshot: $relativePath"
    }

    $bytes = [System.Convert]::FromBase64String([string]$file.contentBase64)
    if ($bytes.LongLength -ne [long]$file.length) {
        throw "Length mismatch before restore: $relativePath"
    }

    $actualHash = Get-Sha256Hex -Bytes $bytes
    if ($actualHash -ne ([string]$file.sha256).ToLowerInvariant()) {
        throw "SHA-256 mismatch before restore: $relativePath"
    }

    [void](Resolve-SafeDestinationPath -RelativePath $relativePath)
}

if (Test-Path -LiteralPath $destinationRoot) {
    $existingItems = @(Get-ChildItem -LiteralPath $destinationRoot -Force -ErrorAction Stop)
    if ($existingItems.Count -gt 0 -and -not $Force) {
        throw "Destination is not empty. Use -Force to overwrite files: $destinationRoot"
    }
} else {
    New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
}

foreach ($directory in @($snapshot.directories) | Sort-Object { ([string]$_).Length }) {
    $directoryPath = Resolve-SafeDestinationPath -RelativePath ([string]$directory)
    New-Item -ItemType Directory -Path $directoryPath -Force | Out-Null
}

foreach ($file in @($snapshot.files)) {
    $relativePath = [string]$file.path
    $destinationFile = Resolve-SafeDestinationPath -RelativePath $relativePath
    $parentDirectory = Split-Path -Parent $destinationFile
    if (-not (Test-Path -LiteralPath $parentDirectory)) {
        New-Item -ItemType Directory -Path $parentDirectory -Force | Out-Null
    }

    if ((Test-Path -LiteralPath $destinationFile) -and -not $Force) {
        throw "Destination file already exists. Use -Force to overwrite: $destinationFile"
    }

    $bytes = [System.Convert]::FromBase64String([string]$file.contentBase64)
    [System.IO.File]::WriteAllBytes($destinationFile, $bytes)

    $restoredBytes = [System.IO.File]::ReadAllBytes($destinationFile)
    $restoredHash = Get-Sha256Hex -Bytes $restoredBytes
    if ($restoredHash -ne ([string]$file.sha256).ToLowerInvariant()) {
        throw "SHA-256 mismatch after restore: $relativePath"
    }
}

Write-Output "Restore completed: $destinationRoot"
Write-Output "Files restored and verified: $(@($snapshot.files).Count)"