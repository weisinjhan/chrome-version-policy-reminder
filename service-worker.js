importScripts("version.js", "policy-utils.js", "localization.js");

"use strict";

const PERIODIC_ALARM_NAME = "periodic-version-check";
const SNOOZE_ALARM_NAME = "snooze-expired";
const TRANSIENT_STATUS_ALARM_NAME = "transient-status-expired";
const PERIODIC_CHECK_MINUTES = 15;
const SNOOZE_DURATION_MS = 8 * 60 * 60 * 1000;
const BADGE_BACKGROUND_COLOR = "#F9AB00";
const COMPLIANT_BADGE_BACKGROUND_COLOR = "#34A853";
const UNAVAILABLE_BADGE_BACKGROUND_COLOR = "#80868B";
const COMPLIANT_STATUS_DURATION_MS = 5000;
const UNAVAILABLE_STATUS_DURATION_MS = 8000;

const LOCAL_KEYS = Object.freeze({
  dismissedPolicyKey: "dismissedPolicyKey",
  dismissedUntil: "dismissedUntil"
});

const LEGACY_LOCAL_KEYS = Object.freeze([
  "alertMinimumVersion",
  "alertWindowId",
  "dismissedMinimumVersion",
  "suppressCloseSnoozeWindowId"
]);

let complianceCheckQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  runInitialization();
});

chrome.runtime.onStartup.addListener(() => {
  runInitialization();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (
    alarm.name === PERIODIC_ALARM_NAME ||
    alarm.name === SNOOZE_ALARM_NAME ||
    alarm.name === TRANSIENT_STATUS_ALARM_NAME
  ) {
    scheduleComplianceCheck();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "managed" && Object.keys(changes).length > 0) {
    scheduleComplianceCheck();
  }
});

chrome.action.onClicked.addListener((tab) => {
  scheduleComplianceCheck({ manualCheck: true, targetTabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "PAGE_READY") {
    void getReminderState()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "OPEN_URL") {
    void openAllowedUrl(message.url)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "SNOOZE_REMINDER") {
    void snoozeReminder(message.policyKey)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

runInitialization();

function runInitialization() {
  void initializeExtension().catch((error) => {
    console.error("Failed to initialize the Chrome update reminder.", error);
  });
}

function scheduleComplianceCheck(options = {}) {
  complianceCheckQueue = complianceCheckQueue
    .then(() => checkCompliance(options))
    .catch((error) => {
      console.error("Failed to check the Chrome version policy.", error);
    });
}

async function initializeExtension() {
  await ensurePeriodicAlarm();
  await chrome.storage.local.remove(LEGACY_LOCAL_KEYS);
  scheduleComplianceCheck();
}

async function ensurePeriodicAlarm() {
  const existingAlarm = await chrome.alarms.get(PERIODIC_ALARM_NAME);
  if (!existingAlarm || existingAlarm.periodInMinutes !== PERIODIC_CHECK_MINUTES) {
    await chrome.alarms.create(PERIODIC_ALARM_NAME, {
      delayInMinutes: PERIODIC_CHECK_MINUTES,
      periodInMinutes: PERIODIC_CHECK_MINUTES
    });
  }
}

async function getManagedPolicy() {
  const policy = await chrome.storage.managed.get([
    "MinimumAllowedVersion",
    "ExternalNetworkBlockDate",
    "SopUrl",
    "DownloadUrl"
  ]);

  const minimumVersion = VersionUtils.normalizeVersion(policy.MinimumAllowedVersion);
  const blockDate = PolicyUtils.parseIsoDate(policy.ExternalNetworkBlockDate);

  if (!minimumVersion || !blockDate) {
    return null;
  }

  return {
    minimumVersion,
    blockDate,
    policyKey: PolicyUtils.createPolicyKey(minimumVersion, blockDate.iso),
    sopUrl: normalizeHttpUrl(policy.SopUrl),
    downloadUrl: normalizeHttpUrl(policy.DownloadUrl)
  };
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

async function getCurrentChromeVersion() {
  const userAgentData = navigator.userAgentData;

  if (userAgentData && typeof userAgentData.getHighEntropyValues === "function") {
    try {
      const values = await userAgentData.getHighEntropyValues(["fullVersionList"]);
      const versions = Array.isArray(values.fullVersionList) ? values.fullVersionList : [];
      const chromeBrand = versions.find((item) => item.brand === "Google Chrome");

      const normalizedVersion = chromeBrand && VersionUtils.normalizeVersion(chromeBrand.version);
      if (normalizedVersion) {
        return normalizedVersion;
      }
    } catch (error) {
      console.warn("Unable to read the full Chrome version from User-Agent Client Hints.", error);
    }
  }

  const fallbackMatch = navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  if (fallbackMatch) {
    const normalizedVersion = VersionUtils.normalizeVersion(fallbackMatch[1]);
    const parts = VersionUtils.parseVersion(normalizedVersion);
    if (!parts) {
      return null;
    }
    const appearsReduced = parts[1] === 0 && parts[2] === 0 && parts[3] === 0;
    if (!appearsReduced) {
      return normalizedVersion;
    }
  }

  return null;
}

async function checkCompliance(options = {}) {
  const { manualCheck = false, targetTabId } = options;
  const result = await evaluateCompliance({ ignoreSnooze: manualCheck });

  if (manualCheck && result.compliant) {
    await clearSnoozeState();
    await showManualStatus(
      createManualStatusState("compliant", result.policy, result.currentVersion),
      targetTabId
    );
    return;
  }

  if (manualCheck && !result.state) {
    await showManualStatus(
      createManualStatusState("unavailable", result.policy, result.currentVersion),
      targetTabId
    );
    return;
  }

  if (!result.state) {
    await clearReminderUi();
    if (!result.policy || result.compliant) {
      await clearSnoozeState();
    }
    return;
  }

  await chrome.alarms.clear(TRANSIENT_STATUS_ALARM_NAME);
  await setOutdatedBadge(result.state.uiLanguage);
  await hideReminderCards();
  await showReminderInTab(result.state, targetTabId);
}

async function evaluateCompliance(options = {}) {
  const { ignoreSnooze = false } = options;
  const policy = await getManagedPolicy();

  if (!policy) {
    console.info("MinimumAllowedVersion or ExternalNetworkBlockDate is missing or invalid; remaining silent.");
    return { policy: null, currentVersion: null, compliant: false, state: null };
  }

  const currentVersion = await getCurrentChromeVersion();
  if (!currentVersion) {
    console.warn("Unable to determine the full Google Chrome version; no reminder will be shown.");
    return { policy, currentVersion: null, compliant: false, state: null };
  }

  if (VersionUtils.compareVersions(currentVersion, policy.minimumVersion) >= 0) {
    return { policy, currentVersion, compliant: true, state: null };
  }

  const localState = await chrome.storage.local.get([
    LOCAL_KEYS.dismissedPolicyKey,
    LOCAL_KEYS.dismissedUntil
  ]);
  const dismissedUntil = Number(localState[LOCAL_KEYS.dismissedUntil]) || 0;
  const isSnoozed =
    localState[LOCAL_KEYS.dismissedPolicyKey] === policy.policyKey &&
    dismissedUntil > Date.now();

  if (isSnoozed && !ignoreSnooze) {
    await ensureSnoozeAlarm(dismissedUntil);
    return { policy, currentVersion, compliant: false, state: null };
  }

  if (localState[LOCAL_KEYS.dismissedPolicyKey] !== policy.policyKey || dismissedUntil <= Date.now()) {
    await clearSnoozeState();
  }

  return {
    policy,
    currentVersion,
    compliant: false,
    state: createReminderState(policy, currentVersion)
  };
}

function createReminderState(policy, currentVersion) {
  const uiLanguage = chrome.i18n.getUILanguage();
  const strings = LocalizationUtils.getStrings(uiLanguage);

  return {
    status: "outdated",
    policyKey: policy.policyKey,
    currentVersion,
    minimumVersion: policy.minimumVersion,
    blockDate: policy.blockDate.iso,
    formattedBlockDate: PolicyUtils.formatPolicyDate(policy.blockDate, strings.locale),
    dateStatus: PolicyUtils.getDateStatus(policy.blockDate),
    sopUrl: policy.sopUrl,
    downloadUrl: policy.downloadUrl,
    uiLanguage
  };
}

function createManualStatusState(status, policy, currentVersion) {
  return {
    status,
    currentVersion: currentVersion || null,
    minimumVersion: policy ? policy.minimumVersion : null,
    uiLanguage: chrome.i18n.getUILanguage(),
    autoCloseMs: status === "compliant" ? COMPLIANT_STATUS_DURATION_MS : 0
  };
}

async function showManualStatus(state, targetTabId) {
  await hideReminderCards();
  await setManualStatusBadge(state.status, state.uiLanguage);
  await chrome.alarms.create(TRANSIENT_STATUS_ALARM_NAME, {
    when: Date.now() + (
      state.status === "compliant"
        ? COMPLIANT_STATUS_DURATION_MS
        : UNAVAILABLE_STATUS_DURATION_MS
    )
  });
  await showReminderInTab(state, targetTabId);
}

async function getReminderState() {
  const result = await evaluateCompliance();
  return result.state;
}

async function showReminderInTab(state, targetTabId) {
  let tabId = Number.isInteger(targetTabId) ? targetTabId : null;

  if (!Number.isInteger(tabId)) {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    tabId = tabs[0] && tabs[0].id;
  }

  if (!Number.isInteger(tabId)) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_REMINDER",
      state
    });
  } catch {
    await injectAndShowReminder(tabId, state);
  }
}

async function injectAndShowReminder(tabId, state) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["localization.js", "content-reminder.js"]
    });
    await chrome.tabs.sendMessage(tabId, {
      type: "SHOW_REMINDER",
      state
    });
  } catch {
    // Chrome internal pages, the Web Store, and some built-in viewers cannot host content scripts.
    // The toolbar badge remains visible as the fallback reminder.
  }
}

async function hideReminderCards() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => chrome.tabs.sendMessage(tab.id, { type: "HIDE_REMINDER" }))
  );
}

async function setOutdatedBadge(uiLanguage) {
  const strings = LocalizationUtils.getStrings(uiLanguage);
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
  await chrome.action.setBadgeText({ text: strings.badgeText });
  await chrome.action.setTitle({ title: strings.actionTitle });
}

async function setManualStatusBadge(status, uiLanguage) {
  const strings = LocalizationUtils.getStrings(uiLanguage);
  const isCompliant = status === "compliant";
  await chrome.action.setBadgeBackgroundColor({
    color: isCompliant
      ? COMPLIANT_BADGE_BACKGROUND_COLOR
      : UNAVAILABLE_BADGE_BACKGROUND_COLOR
  });
  await chrome.action.setBadgeText({
    text: isCompliant ? strings.compliantBadgeText : strings.unavailableBadgeText
  });
  await chrome.action.setTitle({
    title: isCompliant ? strings.compliantActionTitle : strings.unavailableActionTitle
  });
}

async function clearReminderUi() {
  await chrome.alarms.clear(TRANSIENT_STATUS_ALARM_NAME);
  await chrome.action.setBadgeText({ text: "" });
  await chrome.action.setTitle({ title: chrome.i18n.getMessage("actionTitle") });
  await hideReminderCards();
}

async function snoozeReminder(policyKey) {
  const policy = await getManagedPolicy();
  if (!policy || policy.policyKey !== policyKey) {
    await clearReminderUi();
    return;
  }

  const dismissedUntil = Date.now() + SNOOZE_DURATION_MS;
  await chrome.storage.local.set({
    [LOCAL_KEYS.dismissedPolicyKey]: policy.policyKey,
    [LOCAL_KEYS.dismissedUntil]: dismissedUntil
  });
  await ensureSnoozeAlarm(dismissedUntil);
  await clearReminderUi();
}

async function ensureSnoozeAlarm(when) {
  const existingAlarm = await chrome.alarms.get(SNOOZE_ALARM_NAME);
  if (!existingAlarm || Math.abs(existingAlarm.scheduledTime - when) > 1000) {
    await chrome.alarms.create(SNOOZE_ALARM_NAME, { when });
  }
}

async function clearSnoozeState() {
  await chrome.storage.local.remove([
    LOCAL_KEYS.dismissedPolicyKey,
    LOCAL_KEYS.dismissedUntil
  ]);
  await chrome.alarms.clear(SNOOZE_ALARM_NAME);
}

async function openAllowedUrl(value) {
  const url = normalizeHttpUrl(value);
  if (!url) {
    throw new Error("Only valid HTTP or HTTPS URLs can be opened.");
  }

  const policy = await getManagedPolicy();
  if (!policy || (url !== policy.sopUrl && url !== policy.downloadUrl)) {
    throw new Error("The URL is not part of the current managed policy.");
  }

  await chrome.tabs.create({ url });
}