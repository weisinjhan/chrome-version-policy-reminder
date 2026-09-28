(function initializePolicyUtils(globalScope) {
  "use strict";

  const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

  function parseIsoDate(value) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    const match = ISO_DATE_PATTERN.exec(normalized);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return null;
    }

    return Object.freeze({
      iso: normalized,
      year,
      month,
      day
    });
  }

  function getLocalDateParts(date = new Date()) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }

  function compareDateParts(left, right) {
    const leftNumber = left.year * 10000 + left.month * 100 + left.day;
    const rightNumber = right.year * 10000 + right.month * 100 + right.day;
    return Math.sign(leftNumber - rightNumber);
  }

  function getDateStatus(policyDate, today = getLocalDateParts()) {
    const comparison = compareDateParts(policyDate, today);
    if (comparison > 0) {
      return "future";
    }
    if (comparison < 0) {
      return "past";
    }
    return "today";
  }

  function formatPolicyDate(policyDate, locale) {
    const date = new Date(policyDate.year, policyDate.month - 1, policyDate.day, 12, 0, 0, 0);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function createPolicyKey(minimumVersion, blockDateIso) {
    return `${minimumVersion}|${blockDateIso}`;
  }

  const api = Object.freeze({
    compareDateParts,
    createPolicyKey,
    formatPolicyDate,
    getDateStatus,
    getLocalDateParts,
    parseIsoDate
  });

  globalScope.PolicyUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);