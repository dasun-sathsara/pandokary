globalThis.PDY = (() => {
  const COMPACT_LAYOUT_BREAKPOINT = 1200;
  const COMPACT_MEDIA_QUERY = `(max-width: ${COMPACT_LAYOUT_BREAKPOINT - 1}px)`;
  const PHONE_MEDIA_QUERY = "(max-width: 768px)";

  function isCompactLayout() {
    return window.innerWidth < COMPACT_LAYOUT_BREAKPOINT;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function requestFrame(callback) {
    return typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(callback)
      : window.setTimeout(callback, 0);
  }

  function cancelFrame(frame) {
    if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
    else window.clearTimeout(frame);
  }

  function scheduleFrame(callback) {
    let pending = false;
    return () => {
      if (pending) return;
      pending = true;
      requestFrame(() => {
        pending = false;
        callback();
      });
    };
  }

  function debounce(callback, delay) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  function eventElement(event) {
    return event.target instanceof Element ? event.target : event.target?.parentElement;
  }

  function fragmentTarget(hash) {
    const id = hash.replace(/^#/, "");
    try {
      return document.getElementById(decodeURIComponent(id));
    } catch (_error) {
      return document.getElementById(id);
    }
  }

  function runFeature(name, initializer) {
    const reportError = (error) => {
      console.error(`${name} initialization failed`, error);
      return null;
    };
    try {
      const result = initializer();
      return typeof result?.catch === "function" ? result.catch(reportError) : result;
    } catch (error) {
      return reportError(error);
    }
  }

  return {
    COMPACT_MEDIA_QUERY,
    PHONE_MEDIA_QUERY,
    isCompactLayout,
    clamp,
    requestFrame,
    cancelFrame,
    scheduleFrame,
    debounce,
    eventElement,
    fragmentTarget,
    runFeature,
  };
})();
