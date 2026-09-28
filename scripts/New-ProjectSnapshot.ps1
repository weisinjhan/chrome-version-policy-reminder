[CmdletBinding()]
param(
    [Parameter()]
    [string]$ProjectRoot,

    [Parameter()]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$scriptDirectory = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptDirectory)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $scriptDirectory
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $ProjectRoot 'backup\chrome-version-extension-1.2.0.snapshot.json'
}

$projectRootPath = [System.IO.Path]::GetFullPath($ProjectRoot)
$outputFullPath = [System.IO.Path]::GetFullPath($OutputPath)
$projectRootPrefix = $projectRootPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not (Test-Path -LiteralPath $projectRootPath -PathType Container)) {
    throw "Project root does not exist: $projectRootPath"
}

function Get-RelativeSnapshotPath {
    param(
        [Parameter(Mandatory)]
        [string]$FullPath
    )

    $resolvedPath = [System.IO.Path]::GetFullPath($FullPath)
    if (-not $resolvedPath.StartsWith($projectRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the project root: $resolvedPath"
    }

    $relativePath = $resolvedPath.Substring($projectRootPrefix.Length)
    return $relativePath.Replace([System.IO.Path]::DirectorySeparatorChar, '/')
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

function Test-ExcludedPath {
    param(
        [Parameter(Mandatory)]
        [string]$FullPath
    )

    $relativePath = Get-RelativeSnapshotPath -FullPath $FullPath
    return (
        $relativePath -eq '.git' -or
        $relativePath.StartsWith('.git/') -or
        [System.IO.Path]::GetFullPath($FullPath) -eq $outputFullPath -or
        $relativePath -eq 'restore-output' -or
        $relativePath.StartsWith('restore-output/') -or
        $relativePath -like 'snapshot-restore-*' -or
        $relativePath -like 'snapshot-restore-*/*'
    )
}

$manifestPath = Join-Path $projectRootPath 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json was not found under: $projectRootPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

$outputDirectory = Split-Path -Parent $outputFullPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$directories = @(
    Get-ChildItem -LiteralPath $projectRootPath -Directory -Recurse -Force |
        Where-Object { -not (Test-ExcludedPath -FullPath $_.FullName) } |
        ForEach-Object { Get-RelativeSnapshotPath -FullPath $_.FullName } |
        Sort-Object -Unique
)

$files = @(
    Get-ChildItem -LiteralPath $projectRootPath -File -Recurse -Force |
        Where-Object { -not (Test-ExcludedPath -FullPath $_.FullName) } |
        Sort-Object FullName |
        ForEach-Object {
            $bytes = [System.IO.File]::ReadAllBytes($_.FullName)

            [ordered]@{
                path = Get-RelativeSnapshotPath -FullPath $_.FullName
                length = $bytes.LongLength
                sha256 = Get-Sha256Hex -Bytes $bytes
                contentBase64 = [System.Convert]::ToBase64String($bytes)
            }
        }
)

$snapshot = [ordered]@{
    schemaVersion = 1
    projectName = 'chrome-version-extension'
    extensionVersion = [string]$manifest.version
    extensionId = 'bklghhpdljbemdboogebiacbbdknhdli'
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    hashAlgorithm = 'SHA-256'
    contentEncoding = 'base64'
    excluded = @('.git/', (Get-RelativeSnapshotPath -FullPath $outputFullPath))
    directories = $directories
    files = $files
}

$json = $snapshot | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($outputFullPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Output "Snapshot created: $outputFullPath"
Write-Output "Directories: $($directories.Count)"
Write-Output "Files: $($files.Count)"