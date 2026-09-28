(function initializeLocalizationUtils(globalScope) {
  "use strict";

  const translations = Object.freeze({
    en: Object.freeze({
      locale: "en-US",
      documentLanguage: "en",
      badgeText: "UPD",
      actionTitle: "Chrome update reminder",
      title: "Chrome Update Reminder",
      description: "To ensure continued access to web services, please update Chrome to the company-recommended version.",
      compliantBadgeText: "OK",
      compliantActionTitle: "Chrome version meets company requirements",
      compliantTitle: "Chrome Version Meets Company Requirements",
      compliantDescription: "Your current Chrome version meets company requirements and can continue accessing web services.",
      unavailableBadgeText: "?",
      unavailableActionTitle: "Unable to verify the Chrome version",
      unavailableTitle: "Unable to Verify Chrome Version",
      unavailableDescription: "The Chrome version status cannot be confirmed right now. Please make sure company policy is loaded and try again.",
      currentVersion: "Current version",
      recommendedVersion: "Recommended version",
      policyHeading: "Company network policy",
      policyFuture: (date) => `Starting ${date}, outdated Chrome versions will be unable to access external networks.`,
      policyToday: (date) => `Starting today, outdated Chrome versions will be unable to access external networks. Effective date: ${date}.`,
      policyPast: (date) => `Outdated Chrome versions have been unable to access external networks since ${date}.`,
      viewGuide: "View update guide",
      downloadChrome: "Download Chrome",
      remindLater: "Remind me in 8 hours",
      contactIt: "No update link is configured. Please contact IT for assistance.",
      close: "Close reminder"
    }),
    zhCN: Object.freeze({
      locale: "zh-CN",
      documentLanguage: "zh-CN",
      badgeText: "更新",
      actionTitle: "Chrome 版本更新提醒",
      title: "Chrome 版本更新提醒",
      description: "为确保网页服务正常使用，请将 Chrome 更新至公司建议版本。",
      compliantBadgeText: "正常",
      compliantActionTitle: "Chrome 版本符合公司规范",
      compliantTitle: "Chrome 版本符合公司规范",
      compliantDescription: "当前使用的 Chrome 版本符合公司要求，可正常使用网页服务。",
      unavailableBadgeText: "?",
      unavailableActionTitle: "无法确认 Chrome 版本",
      unavailableTitle: "无法确认 Chrome 版本",
      unavailableDescription: "目前无法确认 Chrome 版本状态，请确认公司政策已加载后再试一次。",
      currentVersion: "当前版本",
      recommendedVersion: "建议版本",
      policyHeading: "公司网络政策",
      policyFuture: (date) => `根据公司政策，自 ${date} 起，过旧的 Chrome 版本将无法连接外部网络。`,
      policyToday: (date) => `根据公司政策，自今天起，过旧的 Chrome 版本将无法连接外部网络。生效日期：${date}。`,
      policyPast: (date) => `根据公司政策，自 ${date} 起，过旧的 Chrome 版本已无法连接外部网络。`,
      viewGuide: "查看更新方式",
      downloadChrome: "下载 Chrome",
      remindLater: "8 小时后提醒",
      contactIt: "目前没有设置更新链接，请联系信息部门协助更新。",
      close: "关闭提醒"
    }),
    zhTW: Object.freeze({
      locale: "zh-TW",
      documentLanguage: "zh-Hant",
      badgeText: "更新",
      actionTitle: "Chrome 版本更新提醒",
      title: "Chrome 版本更新提醒",
      description: "為確保網頁服務正常使用，請將 Chrome 更新至公司建議版本。",
      compliantBadgeText: "正常",
      compliantActionTitle: "Chrome 版本符合公司規範",
      compliantTitle: "Chrome 版本符合公司規範",
      compliantDescription: "目前使用的 Chrome 版本符合公司要求，可正常使用網頁服務。",
      unavailableBadgeText: "?",
      unavailableActionTitle: "無法確認 Chrome 版本",
      unavailableTitle: "無法確認 Chrome 版本",
      unavailableDescription: "目前無法確認 Chrome 版本狀態，請確認公司政策已載入後再試一次。",
      currentVersion: "目前版本",
      recommendedVersion: "建議版本",
      policyHeading: "公司網路政策",
      policyFuture: (date) => `依公司政策，自 ${date} 起，過舊的 Chrome 版本將無法連線外部網路。`,
      policyToday: (date) => `依公司政策，自今天起，過舊的 Chrome 版本將無法連線外部網路。生效日期：${date}。`,
      policyPast: (date) => `依公司政策，自 ${date} 起，過舊的 Chrome 版本已無法連線外部網路。`,
      viewGuide: "查看更新方式",
      downloadChrome: "下載 Chrome",
      remindLater: "8 小時後提醒",
      contactIt: "目前沒有設定更新連結，請聯絡資訊單位協助更新。",
      close: "關閉提醒"
    })
  });

  function getLanguageKey(uiLanguage) {
    const normalized = typeof uiLanguage === "string" ? uiLanguage.toLowerCase() : "";
    if (/^zh-(tw|hk|mo)(-|$)/.test(normalized)) {
      return "zhTW";
    }
    if (normalized === "zh" || normalized.startsWith("zh-")) {
      return "zhCN";
    }
    return "en";
  }

  function getStrings(uiLanguage) {
    return translations[getLanguageKey(uiLanguage)];
  }

  const api = Object.freeze({
    getLanguageKey,
    getStrings
  });

  globalScope.LocalizationUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);