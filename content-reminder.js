(function initializeContentReminder(globalScope) {
"use strict";

if (globalScope.__chromeVersionReminderInitialized) {
  return;
}
globalScope.__chromeVersionReminderInitialized = true;

const REMINDER_HOST_ID = "chrome-version-update-reminder-host";
let currentPolicyKey = null;
let autoCloseTimer = null;

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "SHOW_REMINDER") {
    showReminder(message.state);
  } else if (message.type === "HIDE_REMINDER") {
    removeReminder();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    removeReminder();
  } else {
    requestReminder();
  }
});

requestReminder();

function requestReminder() {
  if (document.hidden) {
    return;
  }

  sendMessage({ type: "PAGE_READY" })
    .then((response) => {
      if (response && response.ok && response.state) {
        showReminder(response.state);
      } else {
        removeReminder();
      }
    })
    .catch(() => {
      removeReminder();
    });
}

function showReminder(state) {
  const status = state && state.status ? state.status : "outdated";
  if (
    !state ||
    document.hidden ||
    !["outdated", "compliant", "unavailable"].includes(status) ||
    (status === "outdated" && !state.policyKey)
  ) {
    removeReminder();
    return;
  }

  removeReminder();
  currentPolicyKey = status === "outdated" ? state.policyKey : null;

  const strings = LocalizationUtils.getStrings(state.uiLanguage);
  const presentation = getPresentation(strings, status);
  const host = document.createElement("div");
  host.id = REMINDER_HOST_ID;
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("top", "16px", "important");
  host.style.setProperty("right", "16px", "important");
  host.style.setProperty("z-index", "2147483647", "important");

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = getReminderCss();

  const card = document.createElement("section");
  card.className = `card ${status}`;
  card.setAttribute("role", "region");
  card.setAttribute("aria-label", presentation.title);
  card.lang = strings.documentLanguage;

  const header = createElement("div", "header");
  const icon = createElement("span", "icon", presentation.icon);
  icon.setAttribute("aria-hidden", "true");
  const title = createElement("h2", "title", presentation.title);
  const closeButton = createButton("close", "×", strings.close);
  closeButton.addEventListener("click", () => {
    if (status === "outdated") {
      snoozeReminder(host);
    } else {
      removeReminder();
    }
  });
  header.append(icon, title, closeButton);

  const description = createElement("p", "description", presentation.description);

  const versions = createElement("dl", "versions");
  if (state.currentVersion) {
    appendVersion(versions, strings.currentVersion, state.currentVersion, "current");
  }
  if (state.minimumVersion) {
    appendVersion(versions, strings.recommendedVersion, state.minimumVersion, "recommended");
  }

  card.append(header, description);
  if (versions.childElementCount > 0) {
    card.append(versions);
  }

  if (status === "outdated") {
    appendOutdatedContent(card, strings, state, host);
  }

  shadow.append(style, card);
  (document.documentElement || document.body).append(host);

  if (Number.isFinite(state.autoCloseMs) && state.autoCloseMs > 0) {
    autoCloseTimer = setTimeout(removeReminder, state.autoCloseMs);
  }
}

function appendOutdatedContent(card, strings, state, host) {
  const policyBox = createElement("div", "policy-box");
  const policyTitle = createElement("div", "policy-title", `◷ ${strings.policyHeading}`);
  const policyText = createElement("p", "policy-text", getPolicyMessage(strings, state));
  policyBox.append(policyTitle, policyText);

  const actions = createElement("div", "actions");
  if (state.sopUrl) {
    const guideButton = createButton("primary", strings.viewGuide);
    guideButton.addEventListener("click", () => openUrl(state.sopUrl));
    actions.append(guideButton);
  }

  const snoozeButton = createButton("secondary", strings.remindLater);
  snoozeButton.addEventListener("click", () => snoozeReminder(host));
  actions.append(snoozeButton);

  if (state.downloadUrl) {
    const downloadButton = createButton("link", strings.downloadChrome);
    downloadButton.addEventListener("click", () => openUrl(state.downloadUrl));
    actions.append(downloadButton);
  } else if (!state.sopUrl) {
    actions.append(createElement("p", "contact-it", strings.contactIt));
  }

  card.append(policyBox, actions);
}

function getPresentation(strings, status) {
  if (status === "compliant") {
    return {
      icon: "✓",
      title: strings.compliantTitle,
      description: strings.compliantDescription
    };
  }
  if (status === "unavailable") {
    return {
      icon: "?",
      title: strings.unavailableTitle,
      description: strings.unavailableDescription
    };
  }
  return {
    icon: "↻",
    title: strings.title,
    description: strings.description
  };
}

function removeReminder() {
  if (autoCloseTimer !== null) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }
  const existing = document.getElementById(REMINDER_HOST_ID);
  if (existing) {
    existing.remove();
  }
  currentPolicyKey = null;
}

function snoozeReminder(host) {
  const policyKey = currentPolicyKey;
  host.remove();
  currentPolicyKey = null;
  if (policyKey) {
    void sendMessage({ type: "SNOOZE_REMINDER", policyKey });
  }
}

function openUrl(url) {
  void sendMessage({ type: "OPEN_URL", url });
}

function appendVersion(container, label, value, className) {
  const group = createElement("div", `version-row ${className}`);
  group.append(
    createElement("dt", "version-label", label),
    createElement("dd", "version-value", value)
  );
  container.append(group);
}

function getPolicyMessage(strings, state) {
  if (state.dateStatus === "past") {
    return strings.policyPast(state.formattedBlockDate);
  }
  if (state.dateStatus === "today") {
    return strings.policyToday(state.formattedBlockDate);
  }
  return strings.policyFuture(state.formattedBlockDate);
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  if (typeof text === "string") {
    element.textContent = text;
  }
  return element;
}

function createButton(className, text, ariaLabel) {
  const button = createElement("button", `button ${className}`, text);
  button.type = "button";
  if (ariaLabel) {
    button.setAttribute("aria-label", ariaLabel);
  }
  return button;
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function getReminderCss() {
  return `
    :host { color-scheme: light; }
    * { box-sizing: border-box; }
    .card {
      width: min(370px, calc(100vw - 32px));
      padding: 16px;
      border: 1px solid #d9e2ef;
      border-radius: 12px;
      color: #202124;
      background: #ffffff;
      box-shadow: 0 8px 28px rgba(60, 64, 67, 0.22);
      font-family: "Segoe UI", "Microsoft JhengHei", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.55;
      animation: enter 220ms ease-out;
    }
    .header { display: flex; align-items: center; gap: 9px; }
    .icon {
      display: grid; width: 28px; height: 28px; flex: 0 0 28px;
      place-items: center; border-radius: 50%; color: #185abc;
      background: #e8f0fe; font-size: 18px; font-weight: 700;
    }
    .compliant { border-color: #b7dfc2; }
    .compliant .icon { color: #137333; background: #e6f4ea; }
    .compliant .current .version-value,
    .compliant .recommended .version-value { color: #137333; }
    .unavailable { border-color: #cbd3dc; }
    .unavailable .icon { color: #5f6368; background: #f1f3f4; }
    .title { flex: 1; margin: 0; font-size: 15px; line-height: 1.35; font-weight: 650; }
    .close {
      width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%;
      color: #5f6368; background: transparent; font-size: 20px; line-height: 1;
      cursor: pointer;
    }
    .close:hover { background: #f1f3f4; }
    .description { margin: 11px 0 12px; color: #5f6368; font-size: 13px; }
    .versions { display: grid; gap: 5px; margin: 0 0 12px; }
    .version-row { display: grid; grid-template-columns: 112px 1fr; gap: 8px; align-items: center; }
    .version-label { color: #5f6368; }
    .version-value { margin: 0; font-family: Consolas, "Courier New", monospace; font-weight: 700; }
    .current .version-value { color: #9a6700; }
    .recommended .version-value { color: #185abc; }
    .policy-box {
      padding: 10px 11px; border: 1px solid #f1d58a; border-radius: 8px;
      color: #5f4b21; background: #fff8e1;
    }
    .policy-title { margin-bottom: 3px; font-weight: 700; }
    .policy-text { margin: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 13px; }
    .button {
      min-height: 32px; padding: 6px 11px; border-radius: 7px;
      font: inherit; font-weight: 650; cursor: pointer;
    }
    .button:focus-visible { outline: 3px solid rgba(26, 115, 232, 0.25); outline-offset: 1px; }
    .primary { border: 1px solid #1a73e8; color: #ffffff; background: #1a73e8; }
    .primary:hover { background: #185abc; }
    .secondary { border: 1px solid #c7d6ea; color: #3c4043; background: #ffffff; }
    .secondary:hover { background: #f6f8fb; }
    .link { min-height: auto; padding: 4px 2px; border: 0; color: #185abc; background: transparent; }
    .link:hover { text-decoration: underline; }
    .contact-it { flex-basis: 100%; margin: 0; color: #5f6368; font-size: 11px; }
    @keyframes enter { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
  `;
}
})(globalThis);