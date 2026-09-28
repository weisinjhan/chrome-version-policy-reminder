(function initializeVersionUtils(globalScope) {
  "use strict";

  const VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

  function parseVersion(version) {
    if (typeof version !== "string") {
      return null;
    }

    const trimmed = version.trim();
    if (!VERSION_PATTERN.test(trimmed)) {
      return null;
    }

    const parts = trimmed.split(".").map(Number);
    if (parts.some((part) => !Number.isSafeInteger(part))) {
      return null;
    }

    return parts;
  }

  function isValidVersion(version) {
    return parseVersion(version) !== null;
  }

  function normalizeVersion(version) {
    const parts = parseVersion(version);
    return parts ? parts.join(".") : null;
  }

  function compareVersions(leftVersion, rightVersion) {
    const left = parseVersion(leftVersion);
    const right = parseVersion(rightVersion);

    if (!left || !right) {
      throw new TypeError("版本必須是有效的四段式數字，例如 140.0.7339.81 或 0140.00.7339.0081。");
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] > right[index]) {
        return 1;
      }
      if (left[index] < right[index]) {
        return -1;
      }
    }

    return 0;
  }

  const api = Object.freeze({
    compareVersions,
    isValidVersion,
    normalizeVersion,
    parseVersion
  });

  globalScope.VersionUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof self !== "undefined" ? self : globalThis);