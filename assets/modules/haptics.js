PDY.HapticFeedback = (() => {
  const patterns = Object.freeze({ selection: 8, impact: 12, success: [10, 30, 14] });
  const interactiveSelector =
    'button, input[type="checkbox"], input[type="radio"], [role="button"], [role="switch"]';
  const debounceMs = 40;
  let lastPulseAt = Number.NEGATIVE_INFINITY;

  function trigger(kind = "selection") {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return false;
    }
    const now = Date.now();
    if (now - lastPulseAt < debounceMs) return false;
    lastPulseAt = now;
    try {
      return navigator.vibrate(patterns[kind] || patterns.selection) !== false;
    } catch (_error) {
      return false;
    }
  }

  function isDisabled(target) {
    return (
      target.disabled === true ||
      target.matches?.(":disabled") === true ||
      target.getAttribute?.("aria-disabled") === "true"
    );
  }

  function resolveTarget(node) {
    const label = node?.closest?.("label");
    const associatedControl = label?.control || label?.querySelector?.(interactiveSelector);
    if (associatedControl && !isDisabled(associatedControl)) return associatedControl;
    const target = node?.closest?.(interactiveSelector);
    return target && !isDisabled(target) ? target : null;
  }

  function init() {
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType !== "touch" || event.isPrimary === false) return;
        const target = resolveTarget(event.target);
        if (!target) return;
        const kind =
          target.matches?.('input[type="checkbox"], input[type="radio"]') ||
          target.getAttribute?.("role") === "switch"
            ? "impact"
            : "selection";
        trigger(kind);
      },
      { passive: true },
    );
  }

  return { init, trigger };
})();
