PDY.ShortcutsModule = (() => {
  const { SettingsModule, FoldModule, isCompactLayout, debounce, requestFrame } = PDY;
  const { ICONS, updateScrollLock, focusDialog, releaseDialog, MODAL_TRANSITION_MS } =
    PDY.UIComponentFactory;

  // Keep in sync with handleReaderShortcuts + handleFoldShortcut.
  const SHORTCUT_ROWS = [
    ["Toggle section fold", ["E"]],
    ["Expand all sections", ["Shift", "E"]],
    ["Collapse all sections", ["Shift", "C"]],
    ["Cycle theme", ["T"]],
    ["Table of contents", ["M"]],
    ["Next / previous heading", ["J", "K"]],
    ["This panel", ["?"]],
    ["Close dialogs", ["Esc"]],
  ];

  let shortcutsBackdrop = null;

  function closeShortcuts() {
    if (!shortcutsBackdrop) return;
    const backdrop = shortcutsBackdrop;
    shortcutsBackdrop = null;
    releaseDialog(backdrop.querySelector(".shortcuts-panel"));
    backdrop.classList.remove("visible");
    updateScrollLock();
    window.setTimeout(() => backdrop.remove(), MODAL_TRANSITION_MS);
  }

  function openShortcuts() {
    if (isCompactLayout() || shortcutsBackdrop) return;
    const backdrop = document.createElement("div");
    backdrop.className = "shortcuts-backdrop";
    const rows = SHORTCUT_ROWS.map(
      ([label, keys]) =>
        `<li><span>${label}</span><span class="shortcuts-keys">${keys.map((key) => `<kbd>${key}</kbd>`).join("")}</span></li>`,
    ).join("");
    backdrop.innerHTML =
      `<div class="shortcuts-panel" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">` +
      `<div class="shortcuts-header"><h3 id="shortcuts-title">Keyboard shortcuts</h3>` +
      `<button type="button" class="close-settings" aria-label="Close shortcuts">${ICONS.x}</button></div>` +
      `<ul class="shortcuts-list">${rows}</ul></div>`;
    backdrop.querySelector(".close-settings").addEventListener("click", (event) => {
      event.stopPropagation();
      closeShortcuts();
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeShortcuts();
    });
    document.body.append(backdrop);
    shortcutsBackdrop = backdrop;
    requestFrame(() => {
      if (backdrop !== shortcutsBackdrop) return;
      backdrop.classList.add("visible");
      focusDialog(backdrop.querySelector(".shortcuts-panel"), "Keyboard shortcuts");
      updateScrollLock();
    });
  }

  function toggleShortcuts() {
    if (shortcutsBackdrop) closeShortcuts();
    else openShortcuts();
  }

  function handleEscapeKey() {
    closeShortcuts();
    document
      .querySelectorAll(".table-scroll-container.maximized,.mermaid-container.maximized")
      .forEach((container) => {
        container.querySelector(".btn-maximize")?.click();
      });
    document.querySelector(".lightbox-close")?.click();
  }

  function jumpToHeading(direction) {
    const headings = [...document.querySelectorAll("main :is(h2, h3, h4, h5, h6)")].filter(
      FoldModule.isVisible,
    );
    const target =
      direction > 0
        ? headings.find((h) => h.getBoundingClientRect().top > 80)
        : headings.filter((h) => h.getBoundingClientRect().top < -20).at(-1);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function isInputActive(target) {
    return (
      Boolean(target) &&
      (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
    );
  }

  function handleFoldShortcut(event) {
    if (isCompactLayout()) return false;
    const key = event.key.toLowerCase();
    if (key === "e") {
      event.preventDefault();
      if (event.shiftKey) FoldModule.expandAll();
      else FoldModule.toggleCurrent();
      return true;
    }
    if (key === "c" && event.shiftKey) {
      event.preventDefault();
      FoldModule.collapseAll();
      return true;
    }
    return false;
  }

  function shortcutsBlocked(event) {
    return (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isInputActive(event.target) ||
      Boolean(
        document.querySelector(
          ".modal-backdrop.visible, .lightbox-backdrop.active, .shortcuts-backdrop.visible",
        ),
      )
    );
  }

  const actions = {
    t: () => SettingsModule.cycleTheme(),
    "[": () => document.querySelector(".toc-toggle")?.click(),
    m: () => document.querySelector(".toc-toggle")?.click(),
    j: () => jumpToHeading(1),
    k: () => jumpToHeading(-1),
    "?": toggleShortcuts,
  };

  function handleReaderShortcuts(event) {
    if (event.key === "Escape") {
      handleEscapeKey();
      return;
    }
    if (event.key === "?" && shortcutsBackdrop) {
      event.preventDefault();
      closeShortcuts();
      return;
    }
    if (shortcutsBlocked(event) || handleFoldShortcut(event)) return;
    const key = event.key.toLowerCase();
    if (key === "?" && isCompactLayout()) return;
    const action = actions[key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function initKeyboardShortcuts() {
    window.addEventListener("keydown", handleReaderShortcuts);
    window.addEventListener("resize", debounce(updateScrollLock, 100), { passive: true });
  }

  return { init: initKeyboardShortcuts };
})();
