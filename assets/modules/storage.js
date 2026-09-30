PDY.StorageManager = (() => {
  const fallbackStore = new Map();
  const preferenceKeys = Object.freeze({
    theme: "theme",
    fontSizeAdjust: "font-size-adjust",
    fontWeightAdjustment: "font-weight-adjustment",
    layoutMaxWidth: "layout-max-width",
    tocCollapsed: "tocCollapsed",
  });
  let scrollSaveTimer;

  function get(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        fallbackStore.set(key, value);
        return value;
      }
    } catch (_error) {
      // The in-memory store keeps preferences usable when localStorage is restricted.
    }
    return fallbackStore.has(key) ? fallbackStore.get(key) : fallback;
  }

  function set(key, value) {
    const serialized = String(value);
    fallbackStore.set(key, serialized);
    try {
      window.localStorage.setItem(key, serialized);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getPreference(name, fallback = null) {
    return get(preferenceKeys[name] || name, fallback);
  }

  function setPreference(name, value) {
    return set(preferenceKeys[name] || name, value);
  }

  function getScrollKey(title = document.title) {
    return `pdy_scroll_${title}`;
  }

  function getScrollPosition(title = document.title) {
    const value = Number.parseInt(get(getScrollKey(title), "0"), 10);
    return Number.isFinite(value) ? value : 0;
  }

  function saveScrollPosition(title = document.title) {
    return set(getScrollKey(title), window.scrollY);
  }

  let isScrollListenerEnabled = false;

  function enableScrollListener() {
    isScrollListenerEnabled = true;
  }

  function flushScrollPosition() {
    window.clearTimeout(scrollSaveTimer);
    if (isScrollListenerEnabled) saveScrollPosition();
  }

  function init() {
    window.addEventListener(
      "scroll",
      () => {
        if (!isScrollListenerEnabled) return;
        window.clearTimeout(scrollSaveTimer);
        scrollSaveTimer = window.setTimeout(() => saveScrollPosition(), 150);
      },
      { passive: true },
    );
    window.addEventListener("pagehide", flushScrollPosition, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushScrollPosition();
    });
  }

  return {
    getPreference,
    setPreference,
    getScrollPosition,
    enableScrollListener,
    init,
  };
})();
