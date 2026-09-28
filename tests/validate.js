"use strict";

const assert = require("node:assert");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const expectedExtensionId = "bklghhpdljbemdboogebiacbbdknhdli";
const policyNames = [
  "MinimumAllowedVersion",
  "ExternalNetworkBlockDate",
  "SopUrl",
  "DownloadUrl"
];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function parseProjectJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function validateJsonFiles() {
  const files = [
    "manifest.json",
    "managed-schema.json",
    path.join("_locales", "en", "messages.json"),
    path.join("_locales", "zh_TW", "messages.json"),
    path.join("_locales", "zh_CN", "messages.json")
  ];

  for (const file of files) {
    parseProjectJson(file);
    console.log(`${file}: valid JSON`);
  }
}

function validateJavaScriptSyntax() {
  const files = [
    "version.js",
    "policy-utils.js",
    "localization.js",
    "service-worker.js",
    "content-reminder.js"
  ];

  for (const file of files) {
    childProcess.execFileSync(process.execPath, ["--check", path.join(projectRoot, file)], {
      stdio: "inherit"
    });
    console.log(`${file}: valid JavaScript`);
  }
}

function validateVersionUtilities() {
  const versionUtils = require(path.join(projectRoot, "version.js"));

  assert.deepStrictEqual(versionUtils.parseVersion("140.0.7339.81"), [140, 0, 7339, 81]);
  assert.deepStrictEqual(versionUtils.parseVersion(" 140.0.7339.81 "), [140, 0, 7339, 81]);
  assert.deepStrictEqual(versionUtils.parseVersion("0156.01.02.0003"), [156, 1, 2, 3]);
  assert.strictEqual(versionUtils.normalizeVersion("0156.01.02.0003"), "156.1.2.3");
  assert.strictEqual(versionUtils.normalizeVersion("0000.00.000.0"), "0.0.0.0");
  assert.strictEqual(versionUtils.compareVersions("140.0.7339.80", "140.0.7339.81"), -1);
  assert.strictEqual(versionUtils.compareVersions("140.0.7339.81", "140.0.7339.81"), 0);
  assert.strictEqual(versionUtils.compareVersions("140.0.7339.82", "140.0.7339.81"), 1);
  assert.strictEqual(versionUtils.compareVersions("141.0.0.0", "140.999.9999.9999"), 1);
  assert.strictEqual(versionUtils.compareVersions("140.0.100.9", "140.0.99.10"), 1);
  assert.strictEqual(versionUtils.compareVersions("0156.01.02.0003", "156.1.2.3"), 0);
  assert.strictEqual(versionUtils.compareVersions("0156.01.02.0010", "156.1.2.9"), 1);
  assert.strictEqual(versionUtils.compareVersions("0156.01.0010.0003", "156.1.2.999"), 1);

  for (const invalidVersion of [
    "",
    "140",
    "140.0.0",
    "140.0.0.0.1",
    "140.x.0.1",
    "-1.0.0.0",
    "+1.0.0.0",
    "1e2.0.0.0",
    "9007199254740992.0.0.0",
    null
  ]) {
    assert.strictEqual(versionUtils.isValidVersion(invalidVersion), false, String(invalidVersion));
  }

  console.log("version utilities: all tests passed");
}

function validatePolicyUtilities() {
  const policyUtils = require(path.join(projectRoot, "policy-utils.js"));
  const leapDay = policyUtils.parseIsoDate("2028-02-29");

  assert.deepStrictEqual(
    { iso: leapDay.iso, year: leapDay.year, month: leapDay.month, day: leapDay.day },
    { iso: "2028-02-29", year: 2028, month: 2, day: 29 }
  );
  assert.strictEqual(policyUtils.parseIsoDate("2027-02-29"), null);
  assert.strictEqual(policyUtils.parseIsoDate("2026-13-01"), null);
  assert.strictEqual(policyUtils.parseIsoDate("2026-04-31"), null);
  assert.strictEqual(policyUtils.parseIsoDate("2026-2-03"), null);
  assert.strictEqual(policyUtils.parseIsoDate("2026/02/03"), null);
  assert.strictEqual(policyUtils.parseIsoDate(null), null);

  const today = { year: 2026, month: 9, day: 28 };
  assert.strictEqual(policyUtils.getDateStatus({ year: 2026, month: 9, day: 29 }, today), "future");
  assert.strictEqual(policyUtils.getDateStatus({ year: 2026, month: 9, day: 28 }, today), "today");
  assert.strictEqual(policyUtils.getDateStatus({ year: 2026, month: 9, day: 27 }, today), "past");
  assert.strictEqual(
    policyUtils.createPolicyKey("140.0.7339.81", "2026-12-31"),
    "140.0.7339.81|2026-12-31"
  );
  assert.strictEqual(
    policyUtils.formatPolicyDate(policyUtils.parseIsoDate("2026-12-31"), "zh-TW"),
    "2026年12月31日"
  );
  assert.strictEqual(
    policyUtils.formatPolicyDate(policyUtils.parseIsoDate("2026-12-31"), "en-US"),
    "December 31, 2026"
  );

  console.log("policy utilities: date validation and status tests passed");
}

function validateLocalizationUtilities() {
  const localizationUtils = require(path.join(projectRoot, "localization.js"));

  for (const language of ["zh-TW", "zh-HK", "zh-MO"]) {
    assert.strictEqual(localizationUtils.getLanguageKey(language), "zhTW", language);
  }
  for (const language of ["zh", "zh-CN", "zh-SG", "zh-Hans-CN", "zh-Hant-TW"]) {
    assert.strictEqual(localizationUtils.getLanguageKey(language), "zhCN", language);
  }
  for (const language of ["en-US", "ja", "de-DE", ""]) {
    assert.strictEqual(localizationUtils.getLanguageKey(language), "en", language);
  }

  const traditional = localizationUtils.getStrings("zh-TW");
  const simplified = localizationUtils.getStrings("zh-CN");
  const english = localizationUtils.getStrings("en-US");
  assert(traditional.description.includes("正常使用"));
  assert(simplified.description.includes("正常使用"));
  assert(english.description.includes("continued access"));
  assert(traditional.policyFuture("2026年12月31日").includes("將無法連線"));
  assert(traditional.policyToday("2026年12月31日").includes("自今天起"));
  assert(traditional.policyPast("2026年12月31日").includes("已無法連線"));
  assert(traditional.compliantTitle.includes("符合公司規範"));
  assert(traditional.compliantDescription.includes("可正常使用"));
  assert(traditional.unavailableTitle.includes("無法確認"));
  assert.strictEqual(traditional.compliantBadgeText, "正常");
  assert(simplified.compliantTitle.includes("符合公司规范"));
  assert(simplified.unavailableDescription.includes("无法确认"));
  assert(english.compliantTitle.includes("Meets Company Requirements"));
  assert(english.unavailableDescription.includes("cannot be confirmed"));
  assert.strictEqual(english.compliantBadgeText, "OK");

  console.log("localization utilities: language mapping and messages passed");
}

function validateManifestAndContentScript() {
  const manifest = parseProjectJson("manifest.json");
  assert.strictEqual(manifest.manifest_version, 3);
  assert.strictEqual(manifest.default_locale, "en");
  assert(manifest.permissions.includes("scripting"));
  assert.deepStrictEqual(manifest.host_permissions, ["http://*/*", "https://*/*"]);
  assert.strictEqual(manifest.content_scripts.length, 1);
  assert.deepStrictEqual(manifest.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
  assert(manifest.content_scripts[0].js.includes("content-reminder.js"));

  const contentScript = readProjectFile("content-reminder.js");
  assert(contentScript.includes("attachShadow({ mode: \"closed\" })"));
  assert(contentScript.includes("position\", \"fixed"));
  assert(contentScript.includes("right\", \"16px"));
  assert(contentScript.includes("SNOOZE_REMINDER"));
  assert(contentScript.includes("[\"outdated\", \"compliant\", \"unavailable\"]"));
  assert(contentScript.includes("status === \"outdated\""));
  assert(contentScript.includes("setTimeout(removeReminder, state.autoCloseMs)"));
  assert(contentScript.includes(".compliant .icon"));
  assert(contentScript.includes(".unavailable .icon"));

  for (const removedFile of ["alert.html", "alert.css", "alert.js"]) {
    assert.strictEqual(fs.existsSync(path.join(projectRoot, removedFile)), false, removedFile);
  }

  console.log("manifest and Shadow DOM content reminder: verified");
}

function validateExtensionId() {
  const manifest = parseProjectJson("manifest.json");
  const publicKey = Buffer.from(manifest.key, "base64");
  const digest = crypto.createHash("sha256").update(publicKey).digest();
  const alphabet = "abcdefghijklmnop";
  let extensionId = "";

  for (const byte of digest.subarray(0, 16)) {
    extensionId += alphabet[byte >> 4] + alphabet[byte & 15];
  }

  assert.strictEqual(extensionId, expectedExtensionId);
  console.log(`extension ID: ${extensionId}`);
}

function validatePolicyConsistency() {
  const schema = parseProjectJson("managed-schema.json");
  assert.strictEqual(schema.properties.ExternalNetworkBlockDate.type, "string");

  for (const file of ["README.md", path.join("examples", "policy-template.reg")]) {
    const content = readProjectFile(file);
    assert(content.includes(expectedExtensionId), `${file} is missing the extension ID`);

    for (const policyName of policyNames) {
      assert(content.includes(policyName), `${file} is missing ${policyName}`);
    }

    console.log(`${file}: policy documentation verified`);
  }

  const worker = readProjectFile("service-worker.js");
  assert(worker.includes("MinimumAllowedVersion or ExternalNetworkBlockDate is missing or invalid"));
  assert(worker.includes("PolicyUtils.createPolicyKey"));
  assert(worker.includes("chrome.action.setBadgeText"));
  assert(worker.includes("manualCheck: true"));
  assert(worker.includes("createManualStatusState(\"compliant\""));
  assert(worker.includes("createManualStatusState(\"unavailable\""));
  assert(worker.includes("COMPLIANT_STATUS_DURATION_MS = 5000"));
  assert(worker.includes("COMPLIANT_BADGE_BACKGROUND_COLOR"));
  assert(worker.includes("UNAVAILABLE_BADGE_BACKGROUND_COLOR"));
  assert(!worker.includes("chrome.windows.create"));
}

function validateReleaseDocumentationAndSnapshotTools() {
  const manifest = parseProjectJson("manifest.json");
  const readme = readProjectFile("README.md");
  const changelog = readProjectFile("CHANGELOG.md");
  const deployment = readProjectFile(path.join("docs", "DEPLOYMENT.md"));
  const snapshotCreator = readProjectFile(path.join("scripts", "New-ProjectSnapshot.ps1"));
  const snapshotRestorer = readProjectFile(path.join("scripts", "Restore-ProjectSnapshot.ps1"));

  assert.strictEqual(manifest.version, "1.2.0");
  assert(changelog.includes("## 1.2.0 - 2026-09-28"));
  assert(deployment.includes("HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\3rdparty\\extensions"));
  assert(deployment.includes(expectedExtensionId));
  assert(deployment.includes("MinimumAllowedVersion"));
  assert(deployment.includes("ExternalNetworkBlockDate"));
  assert(deployment.includes("SopUrl"));
  assert(deployment.includes("DownloadUrl"));
  assert(readme.includes("Restore-ProjectSnapshot.ps1"));

  for (const script of [snapshotCreator, snapshotRestorer]) {
    assert(script.includes("SHA256"));
    assert(script.includes("contentBase64"));
  }

  assert(snapshotCreator.includes(".git/"));
  assert(snapshotRestorer.includes("SHA-256 mismatch before restore"));
  assert(snapshotRestorer.includes("SHA-256 mismatch after restore"));
  assert(snapshotRestorer.includes("Snapshot path escapes the destination root"));

  console.log("release documentation and snapshot tools: verified");
}

validateJsonFiles();
validateJavaScriptSyntax();
validateVersionUtilities();
validatePolicyUtilities();
validateLocalizationUtilities();
validateManifestAndContentScript();
validateExtensionId();
validatePolicyConsistency();
validateReleaseDocumentationAndSnapshotTools();

console.log("All validation checks passed.");