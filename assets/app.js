const StorageManager = (() => {
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
    get,
    set,
    getPreference,
    setPreference,
    getScrollKey,
    getScrollPosition,
    saveScrollPosition,
    enableScrollListener,
    flushScrollPosition,
    init,
  };
})();

const COMPACT_LAYOUT_BREAKPOINT = 1200;

function isCompactLayout() {
  return window.innerWidth < COMPACT_LAYOUT_BREAKPOINT;
}

const HapticFeedback = (() => {
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

  return { init, resolveTarget, trigger };
})();

const UIComponentFactory = (() => {
  const ICONS = Object.freeze({
    copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-copy"><path d="M216,32H88A16,16,0,0,0,72,48V72H48A16,16,0,0,0,32,88V216a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V184h24a16,16,0,0,0,16-16V48A16,16,0,0,0,216,32ZM176,216H48V88H176V216Zm40-40H192V88a16,16,0,0,0-16-16H88V48H216V176Z"/></svg>',
    check:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-check"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>',
    caretDown:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ph ph-caret-down"><path d="m6 9 6 6 6-6"/></svg>',
    caretUp:
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="ph ph-caret-up"><path d="m18 15-6-6-6 6"/></svg>',
    table:
      '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-table table-title-icon"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>',
    arrowsOutSimple:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-arrows-out-simple"><path d="M216,48V96a8,8,0,0,1-16,0V67.31l-42.34,42.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM96,152a8,8,0,0,0-5.66,2.34L48,196.69V168a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16H59.31l42.35-42.34A8,8,0,0,0,96,152Z"/></svg>',
    arrowsInSimple:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-arrows-in-simple"><path d="M205.66,61.66,163.31,104H192a8,8,0,0,1,0,16H144a8,8,0,0,1-8-8V64a8,8,0,0,1,16,0V92.69l42.34-42.35a8,8,0,0,1,11.32,11.32ZM112,144H64a8,8,0,0,0,0,16H92.69L50.34,202.34a8,8,0,0,0,11.32,11.32L104,171.31V200a8,8,0,0,0,16,0V152A8,8,0,0,0,112,144Z"/></svg>',
    arrowClockwise:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-arrow-clockwise"><path d="M232,128a8,8,0,0,1-16,0,80,80,0,1,0-23.9,56.5,8,8,0,0,1,11.3,11.3A96,96,0,1,1,232,128ZM224,80V40a8,8,0,0,0-16,0V60.4a95.86,95.86,0,0,0-19.5-24.6,8,8,0,1,0-11.3,11.3A79.88,79.88,0,0,1,192,67.3V48a8,8,0,0,0-16,0V88a8,8,0,0,0,8,8h40a8,8,0,0,0,0-16Z"/></svg>',
    gear: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" class="ph ph-gear settings-icon"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-x"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>',
    bookOpen:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" class="ph ph-book-open"><path d="M224,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h64a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM96,192H32V64H96a24,24,0,0,1,24,24V192A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z"/></svg>',
    link: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-link anchor-icon"><path d="M136,176a8,8,0,0,1-5.66-2.34l-40-40a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,136,176Zm76.69-124.69a48,48,0,0,0-67.89,0L112,84.69a8,8,0,0,0,11.31,11.31l32.8-32.8a32,32,0,0,1,45.26,45.25L168.57,141.26a8,8,0,1,0,11.31,11.31l32.8-32.8A48,48,0,0,0,212.69,51.31ZM132.12,187.58a8,8,0,0,0-11.31-11.31L88,209.07a32,32,0,0,1-45.25-45.26L75.54,131a8,8,0,0,0-11.31-11.31L31.43,152.51a48,48,0,0,0,67.88,67.88Z"/></svg>',
    image:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" class="ph ph-image"><path d="M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.07a16,16,0,0,0-22.63,0L128,172,99.31,143.31a16,16,0,0,0-22.62,0L40,179.31V56ZM40,200l48-48,39.31,39.31a16,16,0,0,0,22.63,0L192,149.31,216,173.31V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z"/></svg>',
  });

  function setButtonContent(button, content) {
    if (typeof content === "string" && content.includes("<svg")) {
      button.innerHTML = content;
    } else if (typeof content === "string") {
      button.textContent = content;
    } else if (content instanceof window.Node) {
      button.replaceChildren(content);
    }
  }

  function setButtonTitle(button, title) {
    button.title = title;
    button.setAttribute("aria-label", title);
  }

  function createButton(className, content, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    setButtonContent(button, content);
    if (title) setButtonTitle(button, title);
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (_error) {
        // Local file exports can expose the API while denying permission.
      }
    }
    if (typeof document.execCommand !== "function") {
      throw new Error("Clipboard API is unavailable");
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    const previousFocus = document.activeElement;
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
    if (!copied) throw new Error("Clipboard copy was rejected");
  }

  function requestFrame(callback) {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }
    return window.setTimeout(callback, 0);
  }

  function updateScrollLock() {
    const modalSelector = [
      ".table-scroll-container.maximized",
      ".mermaid-container.maximized",
      ".lightbox-backdrop.active",
    ].join(",");
    const hasTOC = Boolean(document.querySelector(".toc-sidebar"));
    const compact = isCompactLayout();
    const mobileTOC = hasTOC && compact && document.documentElement.classList.contains("toc-open");
    const mobileSettings =
      window.matchMedia?.("(max-width: 768px)").matches &&
      document.querySelector(".settings-popover.active") !== null;
    document.body.classList.toggle(
      "scroll-locked",
      Boolean(document.querySelector(modalSelector)) || mobileTOC || mobileSettings,
    );
  }

  const dialogStates = new WeakMap();

  function focusDialog(container, label) {
    if (dialogStates.has(container)) return;
    const previousFocus = document.activeElement;
    const previousRole = container.getAttribute("role");
    const previousLabel = container.getAttribute("aria-label");
    const siblings = [];
    for (
      let branch = container;
      branch && branch !== document.body;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (
          sibling === branch ||
          sibling.matches(".modal-backdrop,.toc-backdrop,.settings-backdrop,script,style")
        )
          continue;
        siblings.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
    }
    container.setAttribute("role", "dialog");
    container.setAttribute("aria-modal", "true");
    container.setAttribute("aria-label", label);
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const controls = [
        ...container.querySelectorAll(
          'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length && !element.closest("[inert]"));
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", trap);
    dialogStates.set(container, { previousFocus, previousRole, previousLabel, siblings, trap });
    container
      .querySelector(".btn-maximize,.lightbox-close,a[href],button")
      ?.focus({ preventScroll: true });
  }

  function releaseDialog(container, restoreFocus = true) {
    const state = dialogStates.get(container);
    if (!state) return;
    container.removeEventListener("keydown", state.trap);
    for (const [element, inert] of state.siblings) element.inert = inert;
    for (const [attribute, value] of [
      ["role", state.previousRole],
      ["aria-label", state.previousLabel],
    ]) {
      if (value === null) container.removeAttribute(attribute);
      else container.setAttribute(attribute, value);
    }
    container.removeAttribute("aria-modal");
    dialogStates.delete(container);
    if (restoreFocus && state.previousFocus?.isConnected) {
      state.previousFocus.focus({ preventScroll: true });
    }
  }

  function openModal(container) {
    window.clearTimeout(container._modalTimer);
    delete container._modalTimer;
    container.classList.add("maximized");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.addEventListener("touchmove", (event) => event.preventDefault(), {
      passive: false,
    });
    document.body.append(backdrop);
    container._modalBackdrop = backdrop;
    focusDialog(container, "Expanded table");
    requestFrame(() => {
      container.classList.add("visible");
      backdrop.classList.add("visible");
    });
    updateScrollLock();
    return backdrop;
  }

  function closeModal(container) {
    releaseDialog(container);
    container.classList.remove("visible");
    const backdrop = container._modalBackdrop || document.querySelector(".modal-backdrop");
    backdrop?.classList.remove("visible");
    window.clearTimeout(container._modalTimer);
    container._modalTimer = window.setTimeout(() => {
      container.classList.remove("maximized", "rotated-landscape");
      backdrop?.remove();
      delete container._modalBackdrop;
      delete container._modalTimer;
      updateScrollLock();
    }, 350);
  }

  return {
    ICONS,
    createButton,
    setButtonContent,
    setButtonTitle,
    copyText,
    requestFrame,
    updateScrollLock,
    openModal,
    closeModal,
    focusDialog,
    releaseDialog,
  };
})();

const CodeBlockModule = (() => {
  const { ICONS, copyText, createButton, setButtonTitle } = UIComponentFactory;
  // Phone query must match the ≤768px CSS section styling these classes.
  const phoneMedia = window.matchMedia ? window.matchMedia("(max-width: 768px)") : null;

  function parseLineRange(spec, lineCount = 100000) {
    const lines = new Set();
    if (!spec) return lines;
    const cleaned = String(spec).replace(/[{}]/g, "").replace(/line-/gi, "");
    for (const part of cleaned.split(",")) {
      const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!match) continue;
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2] || match[1], 10);
      for (
        let line = Math.min(start, end);
        line <= Math.min(Math.max(start, end), lineCount);
        line += 1
      ) {
        lines.add(line);
      }
    }
    return lines;
  }

  function formatSingleCodeLine(lineContent, index, highlightedLines, isDiff) {
    const classes = ["code-line"];
    if (highlightedLines.has(index + 1)) classes.push("highlighted-line");
    if (isDiff) {
      const stripped = lineContent.replace(/<[^>]+>/g, "").trim();
      if (stripped.startsWith("+")) classes.push("diff-addition");
      else if (stripped.startsWith("-")) classes.push("diff-deletion");
      else if (stripped.startsWith("@@")) classes.push("diff-meta");
    }
    return `<div class="${classes.join(" ")}" data-line="${index + 1}">${lineContent || " "}</div>`;
  }

  function getLineSpec(pre, code) {
    const lineClassPattern =
      /^\{?(?:(?:line-)?\d+(?:-(?:line-)?\d+)?)(?:,(?:line-)?\d+(?:-(?:line-)?\d+)?)*\}?$/i;
    return (
      pre.dataset.line ||
      code.dataset.line ||
      [...pre.classList, ...code.classList].find((className) => lineClassPattern.test(className))
    );
  }

  function addCollapseControl(pre, lineCount) {
    if (lineCount <= 15) return;
    pre.classList.add("collapsible-code-block");
    const holder = document.createElement("div");
    holder.className = "code-toggle-container";
    holder.append(
      createButton(
        "code-toggle-btn",
        `${ICONS.caretDown}<span>Show More</span>`,
        "Expand code",
        (event) => {
          const button = event.currentTarget;
          const expanded = pre.classList.toggle("expanded");
          button.setAttribute("aria-expanded", String(expanded));
          button.innerHTML = expanded
            ? `${ICONS.caretUp}<span>Show Less</span>`
            : `${ICONS.caretDown}<span>Show More</span>`;
          setButtonTitle(button, expanded ? "Collapse code" : "Expand code");
          if (!expanded)
            pre.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
              block: "nearest",
            });
        },
      ),
    );
    holder.querySelector("button").setAttribute("aria-expanded", "false");
    pre.after(holder);
  }

  function addScrollAffordance(element) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const phone = phoneMedia ? phoneMedia.matches : false;
      const canScroll = phone && element.scrollWidth > element.clientWidth + 2;
      element.classList.toggle("is-scrollable", canScroll);
      element.classList.toggle("at-left", canScroll && element.scrollLeft <= 2);
      element.classList.toggle(
        "at-right",
        canScroll && element.scrollLeft >= element.scrollWidth - element.clientWidth - 2,
      );
      if (canScroll && !element.hasAttribute("tabindex")) {
        element.tabIndex = 0;
        element.setAttribute("role", "region");
        element.setAttribute("aria-label", "Scrollable code");
      }
    };
    const scheduleUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    element.addEventListener("scroll", scheduleUpdate, { passive: true });
    if (phoneMedia?.addEventListener) phoneMedia.addEventListener("change", scheduleUpdate);
    if (window.ResizeObserver) new ResizeObserver(scheduleUpdate).observe(element);
    window.setTimeout(scheduleUpdate, 100);
  }

  function addCopyControl(pre, plainCode) {
    pre.append(
      createButton("copy-btn", `${ICONS.copy}<span>Copy</span>`, "Copy code", async (event) => {
        const button = event.currentTarget;
        try {
          await copyText(plainCode);
          button.innerHTML = `${ICONS.check}<span>Copied!</span>`;
          button.classList.add("success");
          setButtonTitle(button, "Code copied");
        } catch (error) {
          console.error("Copy failed", error);
          button.textContent = "Copy failed";
          setButtonTitle(button, "Could not copy code");
        }
        window.setTimeout(() => {
          button.innerHTML = `${ICONS.copy}<span>Copy</span>`;
          button.classList.remove("success");
          setButtonTitle(button, "Copy code");
        }, 2000);
      }),
    );
  }

  function updateTagStack(line, openTags) {
    const currentLineOpenTags = [...openTags];
    const matches = Array.from(line.matchAll(/<\/?([a-z][a-z0-9-]*)(?:\s+[^>]*?)?>/gi));
    for (const match of matches) {
      const fullTag = match[0];
      const isClosing = fullTag.startsWith("</");
      const tagName = match[1].toLowerCase();
      if (isClosing) {
        if (currentLineOpenTags.length > 0 && currentLineOpenTags.at(-1).name === tagName) {
          currentLineOpenTags.pop();
        }
      } else if (!fullTag.endsWith("/>")) {
        currentLineOpenTags.push({ name: tagName, outer: fullTag });
      }
    }
    return currentLineOpenTags;
  }

  function splitHTMLIntoLines(html) {
    const rawLines = html.split(/\r?\n/);
    const result = [];
    const openTags = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const prefix = openTags.map((tag) => tag.outer).join("");
      const currentLineOpenTags = updateTagStack(line, openTags);
      const suffix = currentLineOpenTags
        .map((t) => `</${t.name}>`)
        .reverse()
        .join("");
      result.push(prefix + line + suffix);
      openTags.length = 0;
      openTags.push(...currentLineOpenTags);
    }
    return result;
  }

  function initBlock(code) {
    if (code.dataset.pdyCodeInitialized === "true") return;
    code.dataset.pdyCodeInitialized = "true";
    const pre = code.parentElement;
    if (!pre) return;
    const plainCode = code.textContent.replace(/\r?\n$/, "");
    const classes = [...code.classList, ...pre.classList];
    const language =
      classes.find((name) => name.startsWith("language-"))?.slice(9) ||
      classes.find((name) => window.hljs?.getLanguage(name));
    if (language) code.classList.add(`language-${language.toLowerCase()}`);
    code.classList.add("hljs");
    // Pandoc places fence languages on <pre>. Unlabelled fences remain plain text.
    if (language && window.hljs?.getLanguage(language)) window.hljs.highlightElement(code);

    const highlightedLines = parseLineRange(getLineSpec(pre, code), plainCode.split("\n").length);
    const isDiff =
      code.classList.contains("language-diff") || pre.classList.contains("language-diff");
    const lines = splitHTMLIntoLines(code.innerHTML);
    if (
      lines
        .at(-1)
        ?.replace(/<[^>]+>/g, "")
        .trim() === ""
    )
      lines.pop();

    const gutter = document.createElement("div");
    gutter.className = "code-gutter";
    gutter.setAttribute("aria-hidden", "true");
    gutter.innerHTML = lines
      .map((_, i) => {
        const lineNum = i + 1;
        const lineClasses = ["code-gutter-line"];
        if (highlightedLines.has(lineNum)) lineClasses.push("highlighted-line");
        return `<span class="${lineClasses.join(" ")}" data-line="${lineNum}">${lineNum}</span>`;
      })
      .join("");

    const scrollArea = document.createElement("div");
    scrollArea.className = "code-scroll-area";

    code.innerHTML = lines
      .map((line, index) => formatSingleCodeLine(line, index, highlightedLines, isDiff))
      .join("");

    scrollArea.append(code);
    pre.innerHTML = "";
    pre.append(gutter, scrollArea);

    pre.addEventListener("click", (event) => {
      const target = event.target.closest(".code-line, .code-gutter-line");
      if (!target) return;
      const lineNum = target.dataset.line;
      if (!lineNum) return;
      const lineElem = pre.querySelector(`.code-line[data-line="${lineNum}"]`);
      const gutterElem = pre.querySelector(`.code-gutter-line[data-line="${lineNum}"]`);
      lineElem?.classList.toggle("focused-line");
      gutterElem?.classList.toggle("focused-line");
    });
    addCollapseControl(pre, lines.length);
    addCopyControl(pre, plainCode);
    addScrollAffordance(scrollArea);
  }

  function init() {
    document.querySelectorAll("pre:not(.mermaid) code").forEach((code) => {
      try {
        initBlock(code);
      } catch (error) {
        console.error("Code block initialization failed", error);
      }
    });
  }

  return { init, parseLineRange };
})();

const TableModule = (() => {
  const { ICONS, closeModal, createButton, openModal, setButtonTitle } = UIComponentFactory;
  const shadowUpdaters = new Set();
  let resizeTimer;
  let resizeBound = false;

  function bindResizeUpdates() {
    if (resizeBound || window.ResizeObserver) return;
    resizeBound = true;
    window.addEventListener(
      "resize",
      () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          shadowUpdaters.forEach((update) => {
            update();
          });
        }, 100);
      },
      { passive: true },
    );
  }

  function isNumericText(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return (
      /^[+-]?[$\u20AC\u00A3\u00A5]?\s*[\d,]+(?:\.\d+)?\s*(?:%|[a-z]{1,4})?$/i.test(trimmed) ||
      /^\d{1,5}$/.test(trimmed) ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(trimmed)
    );
  }

  function isCellShort(cell, maxLen = 22) {
    if (!cell) return true;
    if (cell.querySelector("br, p, ul, ol, blockquote, pre, table")) return false;
    const text = cell.textContent.trim().replace(/\s+/g, " ");
    return text.length <= maxLen;
  }

  function getColumnStats(rows, colIndex) {
    let total = 0;
    let totalLen = 0;
    let numeric = 0;
    let allShort = true;

    for (const row of rows) {
      const cell = row.children[colIndex];
      const text = cell?.textContent.trim().replace(/\s+/g, " ");
      if (!text) continue;
      total += 1;
      totalLen += text.length;
      if (isNumericText(text)) numeric += 1;
      if (allShort && !isCellShort(cell, 22)) allShort = false;
    }

    return { total, avgLen: total ? totalLen / total : 0, numeric, allShort };
  }

  function isColumnCompact(header, stats) {
    if (stats.total === 0 || !stats.allShort) return false;
    const headerText = header?.textContent.trim().replace(/\s+/g, " ") || "";
    return headerText.length <= 22 && stats.avgLen <= 16;
  }

  function applyColumnNumeric(header, rows, colIndex) {
    header?.classList.add("col-numeric");
    for (const row of rows) {
      row.children[colIndex]?.classList.add("col-numeric");
    }
  }

  function applyColumnCompact(header, rows, colIndex) {
    header?.classList.add("col-compact");
    for (const row of rows) {
      row.children[colIndex]?.classList.add("col-compact");
    }
  }

  function autoAlignColumns(table) {
    const rows = [...table.querySelectorAll("tbody tr")];
    if (!rows.length) return;
    const headerCells = [...table.querySelectorAll("thead th")];
    const colCount = Math.max(headerCells.length, ...rows.map((r) => r.children.length));

    for (let c = 0; c < colCount; c++) {
      const header = headerCells[c];
      const stats = getColumnStats(rows, c);
      const isNumeric = stats.total > 0 && stats.numeric / stats.total >= 0.75;

      if (isNumeric && !header?.getAttribute("align") && !header?.style.textAlign) {
        applyColumnNumeric(header, rows, c);
      }

      if (isNumeric || isColumnCompact(header, stats)) {
        applyColumnCompact(header, rows, c);
      }
    }
  }

  function initTable(table) {
    if (table.closest(".table-scroll-container")) return;
    autoAlignColumns(table);
    const container = document.createElement("div");
    container.className = "table-scroll-container";
    const actions = document.createElement("div");
    actions.className = "table-actions";
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", table.caption?.textContent || "Scrollable table");
    const left = document.createElement("div");
    const right = document.createElement("div");
    left.className = "scroll-shadow left";
    right.className = "scroll-shadow right";

    const updateShadows = () => {
      if (!document.body.contains(wrapper)) {
        shadowUpdaters.delete(updateShadows);
        return;
      }
      const canScroll = wrapper.scrollWidth > wrapper.clientWidth;
      container.classList.toggle("is-scrollable", canScroll);
      left.style.opacity = wrapper.scrollLeft > 2 ? "1" : "0";
      right.style.opacity =
        wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth - 2 ? "1" : "0";
    };
    shadowUpdaters.add(updateShadows);

    const maximize = createButton(
      "table-btn btn-maximize",
      ICONS.arrowsOutSimple,
      "Toggle fullscreen",
      (event) => {
        const button = event.currentTarget;
        if (!container.classList.contains("maximized")) {
          const backdrop = openModal(container);
          backdrop.addEventListener("click", () => button.click());
          button.innerHTML = ICONS.arrowsInSimple;
          setButtonTitle(button, "Restore Normal View");
        } else {
          closeModal(container);
          button.innerHTML = ICONS.arrowsOutSimple;
          setButtonTitle(button, "Toggle Fullscreen");
        }
        window.setTimeout(updateShadows, 50);
      },
    );
    const rotate = createButton(
      "table-btn btn-rotate",
      ICONS.arrowClockwise,
      "Rotate landscape",
      () => {
        container.classList.toggle("rotated-landscape");
        window.setTimeout(updateShadows, 50);
      },
    );

    actions.append(maximize, rotate);
    table.before(container);
    wrapper.append(table);
    container.append(actions, wrapper, left, right);
    let scrollTicking = false;
    const scheduleShadows = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        scrollTicking = false;
        updateShadows();
      });
    };
    wrapper.addEventListener("scroll", scheduleShadows, { passive: true });
    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(updateShadows);
      observer.observe(wrapper);
    }
    window.setTimeout(updateShadows, 100);
  }

  function init() {
    bindResizeUpdates();
    document.querySelectorAll("main table").forEach((table) => {
      try {
        initTable(table);
      } catch (error) {
        console.error("Table initialization failed", error);
      }
    });
  }

  return {
    init,
    autoAlignColumns,
    getColumnStats,
    isCellShort,
    isColumnCompact,
    isNumericText,
  };
})();

const SettingsModule = (() => {
  const { ICONS, focusDialog, releaseDialog, updateScrollLock } = UIComponentFactory;
  const FONT_WEIGHT_ADJUSTMENT_MIN = -100;
  const FONT_WEIGHT_ADJUSTMENT_MAX = 100;
  const FONT_WEIGHT_ROLE_BASES = Object.freeze({
    "body-font-weight": Object.freeze({ desktop: 400, mobile: 430 }),
    "strong-font-weight": Object.freeze({ desktop: 550, mobile: 580 }),
    "heading-font-weight": Object.freeze({ desktop: 600, mobile: 630 }),
    "mono-font-weight": Object.freeze({ desktop: 420, mobile: 450 }),
    "mono-emphasis-font-weight": Object.freeze({ desktop: 520, mobile: 550 }),
  });
  const DEFAULT_THEMES = Object.freeze([
    { id: "porcelain", name: "Porcelain" },
    { id: "lumina", name: "Lumina" },
    { id: "parchment", name: "Parchment" },
    { id: "obsidian", name: "Obsidian" },
    { id: "midnight-fjord", name: "Midnight Fjord" },
    { id: "evergreen", name: "Evergreen" },
  ]);

  let fontPromise;
  function loadFonts() {
    fontPromise ??= loadDocumentFonts();
    return fontPromise;
  }

  async function loadDocumentFonts() {
    if (!document.fonts?.load) return;
    const fontLoads = Promise.all([
      ...[400, 550, 600].flatMap((weight) => [
        document.fonts.load(`${weight} 12px 'Studio Feixen Sans'`),
        document.fonts.load(`italic ${weight} 12px 'Studio Feixen Sans'`),
      ]),
      ...[420, 520].flatMap((weight) => [
        document.fonts.load(`${weight} 12px 'Geist Mono'`),
        document.fonts.load(`italic ${weight} 12px 'Geist Mono'`),
      ]),
      ...[400, 420, 520, 540, 550, 580, 600].map((weight) =>
        document.fonts.load(`${weight} 12px 'Noto Sans Sinhala'`, "සිංහල"),
      ),
    ]).catch((error) => {
      console.warn("Font loading failed; CSS fallbacks remain active", error);
    });
    await Promise.race([fontLoads, new Promise((resolve) => window.setTimeout(resolve, 2000))]);
  }

  function getThemes() {
    return Array.isArray(window.PDY_THEME_MANIFEST) && window.PDY_THEME_MANIFEST.length
      ? window.PDY_THEME_MANIFEST
      : DEFAULT_THEMES;
  }

  function getAdjustedFontWeights(adjustment, compact = isCompactLayout()) {
    const layout = compact ? "mobile" : "desktop";
    return Object.fromEntries(
      Object.entries(FONT_WEIGHT_ROLE_BASES).map(([role, weights]) => [
        role,
        weights[layout] + adjustment,
      ]),
    );
  }

  function applyFontWeightAdjustment(adjustment) {
    document.documentElement.style.setProperty("--font-weight-adjustment", String(adjustment));
    for (const [role, weight] of Object.entries(getAdjustedFontWeights(adjustment))) {
      document.documentElement.style.setProperty(`--${role}`, String(weight));
    }
  }

  function createPanel() {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "floating-toggle settings-toggle";
    toggle.setAttribute("aria-label", "Open appearance settings");
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-controls", "appearance-panel");
    toggle.setAttribute("aria-expanded", "false");
    toggle.title = "Appearance Settings";
    toggle.innerHTML = ICONS.gear;
    document.body.append(toggle);

    const panel = document.createElement("div");
    panel.className = "settings-popover";
    panel.id = "appearance-panel";
    panel.setAttribute("aria-labelledby", "appearance-title");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="settings-header">
        <h3 id="appearance-title">Appearance</h3>
        <button type="button" class="close-settings" aria-label="Close settings">${ICONS.x}</button>
      </div>
      <div class="settings-section">
        <div class="settings-label">Theme</div>
        <div class="theme-grid">
          ${getThemes()
            .map(
              (theme) =>
                `<button type="button" class="theme-option" data-theme-key="${theme.id}">` +
                `<span class="theme-preview-dot" data-theme="${theme.id}" aria-hidden="true"></span>${theme.name}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-label">Typography</div>
        <div class="control-row">
          <span class="control-name">Text Size</span>
          <div class="stepper-control">
            <button type="button" class="stepper-btn dec-font-size" aria-label="Decrease font size">—</button>
            <span class="stepper-val font-size-val" aria-live="polite">100%</span>
            <button type="button" class="stepper-btn inc-font-size" aria-label="Increase font size">+</button>
          </div>
        </div>
        <div class="control-row">
          <label class="control-name" for="font-weight-adjustment">Weight Adjustment</label>
          <div class="stepper-control">
            <button type="button" class="stepper-btn dec-font-weight" aria-label="Make font weight lighter">−</button>
            <input id="font-weight-adjustment" type="number" min="-100" max="100" step="1" value="0" class="stepper-val font-weight-input" aria-live="polite" inputmode="numeric">
            <button type="button" class="stepper-btn inc-font-weight" aria-label="Make font weight heavier">+</button>
          </div>
        </div>
      </div>
      <div class="settings-section layout-section">
        <div class="settings-label">Layout</div>
        <div class="control-row">
          <span class="control-name">Max Width</span>
          <div class="stepper-control">
            <button type="button" class="stepper-btn dec-layout-width" aria-label="Decrease layout width">—</button>
            <span class="stepper-val layout-width-val" aria-live="polite">1040px</span>
            <button type="button" class="stepper-btn inc-layout-width" aria-label="Increase layout width">+</button>
          </div>
        </div>
      </div>`;
    document.body.append(panel);
    return { panel, toggle };
  }

  function bindPanelVisibility(panel, toggle) {
    const closeButton = panel.querySelector(".close-settings");
    const backdrop = document.createElement("div");
    const phoneMedia = window.matchMedia("(max-width: 768px)");
    let dialogActive = false;
    let focusSequence = 0;
    backdrop.className = "settings-backdrop";
    backdrop.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
    document.body.append(backdrop);

    const focusableSelector = "a[href], button, input, select, textarea, [tabindex]";
    const restoreTabindex = (element) => {
      if (!Object.hasOwn(element.dataset, "pdyTabindex")) return;
      const previousTabindex = element.dataset.pdyTabindex;
      if (previousTabindex) element.setAttribute("tabindex", previousTabindex);
      else element.removeAttribute("tabindex");
      delete element.dataset.pdyTabindex;
    };
    const disableTabindex = (element) => {
      if (!Object.hasOwn(element.dataset, "pdyTabindex")) {
        element.dataset.pdyTabindex = element.getAttribute("tabindex") || "";
      }
      element.setAttribute("tabindex", "-1");
    };
    const setFocusability = (visible) => {
      if ("inert" in panel) panel.inert = !visible;
      panel
        .querySelectorAll(focusableSelector)
        .forEach(visible ? restoreTabindex : disableTabindex);
    };
    const focusVisiblePanel = () => {
      const sequence = focusSequence;
      let fallbackTimer;
      const finish = () => {
        if (sequence !== focusSequence) return;
        window.clearTimeout(fallbackTimer);
        panel.removeEventListener("transitionend", handleTransitionEnd);
        if (!panel.classList.contains("active")) return;
        if (phoneMedia.matches) {
          focusDialog(panel, "Appearance settings");
          dialogActive = true;
        } else {
          closeButton?.focus({ preventScroll: true });
        }
      };
      const handleTransitionEnd = (event) => {
        if (event.target === panel && event.propertyName === "visibility") finish();
      };
      panel.addEventListener("transitionend", handleTransitionEnd);
      fallbackTimer = window.setTimeout(finish, 400);
    };
    const syncDialogMode = () => {
      if (!panel.classList.contains("active")) return;
      if (phoneMedia.matches) {
        if (!dialogActive) {
          focusDialog(panel, "Appearance settings");
          dialogActive = true;
        }
      } else if (dialogActive) {
        releaseDialog(panel, false);
        dialogActive = false;
        closeButton?.focus({ preventScroll: true });
      }
      updateScrollLock();
    };
    const show = (visible, restoreFocus = false) => {
      focusSequence += 1;
      if (!visible && dialogActive) {
        releaseDialog(panel, restoreFocus);
        dialogActive = false;
      }
      panel.classList.toggle("active", visible);
      backdrop.classList.toggle("active", visible);
      toggle.classList.toggle("active", visible);
      toggle.setAttribute("aria-expanded", String(visible));
      panel.setAttribute("aria-hidden", String(!visible));
      setFocusability(visible);
      updateScrollLock();
      if (visible) focusVisiblePanel();
      else if (restoreFocus) toggle.focus({ preventScroll: true });
      else if (panel.contains(document.activeElement)) document.activeElement.blur();
    };
    backdrop.addEventListener("click", () => show(false));
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      show(!panel.classList.contains("active"));
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    closeButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      // Keyboard-activated buttons dispatch click with detail 0: only then is
      // handing focus back to the toggle correct. A pointer dismissal must not
      // park programmatic (focus-visible-matching) focus on the toggle, or the
      // scroll auto-hide would never engage again.
      show(false, event.detail === 0);
    });
    window.addEventListener("click", () => show(false));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("active")) show(false, true);
    });
    phoneMedia.addEventListener("change", syncDialogMode);
    show(false);
  }

  function bindThemeControls(panel) {
    const applyTheme = (requested) => {
      const legacy = {
        primer: "lumina",
        "verdant-paper": "lumina",
        "lilac-frost": "lumina",
        "studio-dark": "obsidian",
        "ayu-mirage": "obsidian",
        boreal: "midnight-fjord",
      };
      const candidate = legacy[requested] || requested;
      const theme = getThemes().some((entry) => entry.id === candidate) ? candidate : "porcelain";
      const changed = document.documentElement.dataset.theme !== theme;
      document.documentElement.dataset.theme = theme;
      StorageManager.setPreference("theme", theme);
      panel.querySelectorAll(".theme-option").forEach((button) => {
        button.classList.toggle("active", button.dataset.themeKey === theme);
        button.setAttribute("aria-pressed", String(button.dataset.themeKey === theme));
      });
      if (changed && typeof window.updateMermaidTheme === "function") window.updateMermaidTheme();
    };
    panel.querySelectorAll(".theme-option").forEach((button) => {
      button.addEventListener("click", () => applyTheme(button.dataset.themeKey));
    });
    applyTheme(StorageManager.getPreference("theme", "porcelain"));
  }

  function bindFontSizeControls(panel) {
    let size = Math.max(
      -4,
      Math.min(8, Number.parseInt(StorageManager.getPreference("fontSizeAdjust", "0"), 10) || 0),
    );
    const decrease = panel.querySelector(".dec-font-size");
    const increase = panel.querySelector(".inc-font-size");
    const value = panel.querySelector(".font-size-val");
    const update = () => {
      const baseSize =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--font-size-body"),
        ) || (isCompactLayout() ? 14.75 : 16);
      document.documentElement.style.setProperty("--font-size-adjust", `${size}px`);
      value.textContent = `${Math.round(((baseSize + size) / baseSize) * 100)}%`;
      decrease.disabled = size <= -4;
      increase.disabled = size >= 8;
      StorageManager.setPreference("fontSizeAdjust", size);
    };
    decrease.addEventListener("click", () => {
      size = Math.max(-4, size - 1);
      update();
    });
    increase.addEventListener("click", () => {
      size = Math.min(8, size + 1);
      update();
    });
    window.matchMedia("(max-width: 1199px)").addEventListener("change", update);
    update();
  }

  function bindFontWeightControls(panel) {
    const stored = Number.parseInt(StorageManager.getPreference("fontWeightAdjustment", "0"), 10);
    let adjustment = Number.isFinite(stored)
      ? Math.max(FONT_WEIGHT_ADJUSTMENT_MIN, Math.min(FONT_WEIGHT_ADJUSTMENT_MAX, stored))
      : 0;
    const decrease = panel.querySelector(".dec-font-weight");
    const increase = panel.querySelector(".inc-font-weight");
    const input = panel.querySelector(".font-weight-input");
    const update = (requested, persist = true) => {
      const parsed = Number.parseInt(requested, 10);
      adjustment = Number.isFinite(parsed)
        ? Math.max(FONT_WEIGHT_ADJUSTMENT_MIN, Math.min(FONT_WEIGHT_ADJUSTMENT_MAX, parsed))
        : 0;
      applyFontWeightAdjustment(adjustment);
      input.value = String(adjustment);
      decrease.disabled = adjustment <= FONT_WEIGHT_ADJUSTMENT_MIN;
      increase.disabled = adjustment >= FONT_WEIGHT_ADJUSTMENT_MAX;
      if (persist) StorageManager.setPreference("fontWeightAdjustment", adjustment);
    };
    decrease.addEventListener("click", () => update(adjustment - 1));
    increase.addEventListener("click", () => update(adjustment + 1));
    input.addEventListener("change", () => update(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") update(input.value);
    });
    window.matchMedia("(max-width: 1199px)").addEventListener("change", () => {
      applyFontWeightAdjustment(adjustment);
    });
    update(adjustment);
  }

  function bindLayoutControls(panel) {
    const widths = [800, 920, 1040, 1160, 1280, 1400];
    let width = Number.parseInt(StorageManager.getPreference("layoutMaxWidth", "1040"), 10);
    if (!widths.includes(width)) width = 1040;
    const decrease = panel.querySelector(".dec-layout-width");
    const increase = panel.querySelector(".inc-layout-width");
    const value = panel.querySelector(".layout-width-val");
    const update = () => {
      document.documentElement.style.setProperty("--content-max-width", `${width}px`);
      value.textContent = `${width}px`;
      decrease.disabled = width <= widths[0];
      increase.disabled = width >= widths.at(-1);
      StorageManager.setPreference("layoutMaxWidth", width);
    };
    decrease.addEventListener("click", () => {
      width = widths[Math.max(0, widths.indexOf(width) - 1)];
      update();
    });
    increase.addEventListener("click", () => {
      width = widths[Math.min(widths.length - 1, widths.indexOf(width) + 1)];
      update();
    });
    update();
  }

  function init() {
    const settings = createPanel();
    bindPanelVisibility(settings.panel, settings.toggle);
    bindThemeControls(settings.panel);
    bindFontSizeControls(settings.panel);
    bindFontWeightControls(settings.panel);
    bindLayoutControls(settings.panel);
    return settings;
  }

  return { init, loadFonts, getAdjustedFontWeights };
})();

const TOCModule = (() => {
  const { ICONS, createButton, updateScrollLock } = UIComponentFactory;

  function ensureHeadingID(heading) {
    if (heading.id) return heading.id;
    const base =
      heading.textContent
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "section";
    let id = base;
    let suffix = 2;
    while (document.getElementById(id)) id = `${base}-${suffix++}`;
    heading.id = id;
    return id;
  }

  function initScrollSpy(headings, aside, list) {
    const links = [...list.querySelectorAll("a")];
    let offsets = [];
    let activeIndex = -1;
    let scheduled = false;
    const update = () => {
      scheduled = false;
      const position = window.scrollY + 48;
      let low = 0;
      let high = offsets.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (offsets[middle] <= position) low = middle + 1;
        else high = middle;
      }
      const index = Math.max(0, low - 1);
      if (index === activeIndex) return;
      links[activeIndex]?.classList.remove("active");
      links[activeIndex]?.removeAttribute("aria-current");
      activeIndex = index;
      const link = links[index];
      link.classList.add("active");
      link.setAttribute("aria-current", "location");
      if (aside.inert) return;
      const scrollTarget = aside.querySelector(".toc-sidebar-body") || aside;
      const bounds = scrollTarget.getBoundingClientRect();
      const linkBounds = link.getBoundingClientRect();
      if (linkBounds.top < bounds.top || linkBounds.bottom > bounds.bottom) {
        // Scroll only the navigation, never the document being read.
        scrollTarget.scrollTop += linkBounds.top - bounds.top - scrollTarget.clientHeight / 2;
      }
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      UIComponentFactory.requestFrame(update);
    };
    const measure = () => {
      offsets = headings.map((heading) => heading.getBoundingClientRect().top + window.scrollY);
      schedule();
    };
    let resizeTimer = 0;
    const scheduleMeasure = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 100);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(scheduleMeasure).observe(document.body);
    window.addEventListener("load", measure, { once: true });
    measure();
  }

  function init() {
    const headings = [...document.querySelectorAll("main h2,main h3")];
    if (!headings.length) {
      document.documentElement.classList.remove("toc-open");
      return null;
    }
    const aside = document.createElement("aside");
    aside.className = "toc-sidebar";
    aside.id = "document-contents";
    aside.setAttribute("aria-label", "Table of contents");

    const header = document.createElement("div");
    header.className = "toc-header-bar";
    const title = document.createElement("h3");
    title.className = "toc-sidebar-title";
    title.textContent = "Table of Contents";
    const close = createButton("toc-close close-settings", ICONS.x, "Close table of contents");
    header.append(title, close);

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "toc-sidebar-body";
    const list = document.createElement("ul");
    list.className = "toc-list";
    bodyWrap.append(list);

    if (
      document.querySelector(".fold-group") &&
      typeof FoldModule !== "undefined" &&
      FoldModule.expandAll
    ) {
      const actions = document.createElement("div");
      actions.className = "toc-fold-actions";
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "toc-fold-btn";
      expand.textContent = "Expand all";
      expand.addEventListener("click", () => FoldModule.expandAll());
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "toc-fold-btn";
      collapse.textContent = "Collapse all";
      collapse.addEventListener("click", () => FoldModule.collapseAll());
      actions.append(expand, collapse);
      bodyWrap.prepend(actions);
    }
    headings.forEach((heading) => {
      {
        ensureHeadingID(heading);
        const item = document.createElement("li");
        item.className = `toc-item-${heading.tagName.toLowerCase()}`;
        const link = document.createElement("a");
        link.className = "toc-link";
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.textContent = heading.textContent;
        item.append(link);
        list.append(item);
      }
    });
    aside.append(header, bodyWrap);
    document.body.append(aside);

    const backdrop = document.createElement("div");
    backdrop.className = "toc-backdrop";
    backdrop.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
    document.body.append(backdrop);
    const toggle = createButton(
      "floating-toggle toc-toggle",
      ICONS.bookOpen,
      "Show Table of Contents",
    );
    toggle.setAttribute("aria-controls", aside.id);
    document.body.append(toggle);

    let isOpen =
      !isCompactLayout() && StorageManager.getPreference("tocCollapsed", "false") !== "true";
    const setOpen = (value) => {
      UIComponentFactory.releaseDialog(aside);
      isOpen = value;
      aside.inert = !value;
      aside.setAttribute("aria-hidden", String(!value));
      toggle.setAttribute("aria-expanded", String(value));
      document.documentElement.classList.toggle("toc-open", isOpen);
      toggle.innerHTML = isOpen ? ICONS.x : ICONS.bookOpen;
      UIComponentFactory.setButtonTitle(
        toggle,
        isOpen ? "Hide Table of Contents" : "Show Table of Contents",
      );
      if (!isCompactLayout()) StorageManager.setPreference("tocCollapsed", !isOpen);
      if (isOpen && isCompactLayout()) UIComponentFactory.focusDialog(aside, "Table of contents");
      updateScrollLock();
    };
    toggle.addEventListener("click", () => {
      setOpen(!isOpen);
      if (isOpen && isCompactLayout()) list.querySelector("a")?.focus();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen && isCompactLayout()) {
        setOpen(false);
        toggle.focus();
      }
    });
    close.addEventListener("click", () => {
      setOpen(false);
      toggle.focus();
    });
    window.matchMedia("(max-width: 1199px)").addEventListener("change", () => {
      UIComponentFactory.releaseDialog(aside);
      setOpen(
        !isCompactLayout() && StorageManager.getPreference("tocCollapsed", "false") !== "true",
      );
    });
    backdrop.addEventListener("click", () => setOpen(false));
    list.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (isCompactLayout()) {
          setOpen(false);
          const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
          heading?.setAttribute("tabindex", "-1");
          heading?.focus({ preventScroll: true });
        }
      });
    });
    setOpen(isOpen);
    initScrollSpy(headings, aside, list);
    return { aside, backdrop, toggle, setOpen };
  }

  return { init, ensureHeadingID };
})();

const SectionLinkModule = (() => {
  const HEADING_NUMBER = /^\s*(\d+[A-Za-z]?(?:\.\d+[A-Za-z]?)*)\b/;
  const REF_SOURCE =
    "§§?\\s*\\d+[A-Za-z]?(?:\\.\\d+[A-Za-z]?)*(?:\\s*[–—-]\\s*\\d+[A-Za-z]?(?:\\.\\d+[A-Za-z]?)*)?";
  const FIRST_NUMBER = /\d+[A-Za-z]?(?:\.\d+[A-Za-z]?)*/;
  const LEADING_MARKS = /^§§?\s*/;
  const SKIP_SELECTOR = "pre,code,a,script,style";

  function extractHeadingNumber(text) {
    const match = String(text).match(HEADING_NUMBER);
    return match ? match[1] : null;
  }

  function buildSectionMap(headings) {
    const map = new Map();
    for (const heading of headings) {
      const number = extractHeadingNumber(heading.textContent);
      if (!number || !heading.id || map.has(number)) continue;
      map.set(number, heading.id);
    }
    return map;
  }

  function findSectionRefs(text, sectionMap) {
    const pattern = new RegExp(REF_SOURCE, "g");
    const refs = [];
    for (const match of text.matchAll(pattern)) {
      const first = match[0].match(FIRST_NUMBER);
      const section = first ? first[0] : null;
      const target = section ? sectionMap.get(section) : undefined;
      refs.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        display: match[0].replace(LEADING_MARKS, ""),
        section,
        target: target || null,
      });
    }
    return refs;
  }

  function linkifyTextNode(node, sectionMap) {
    const text = node.nodeValue;
    if (!text?.includes("§")) return false;
    const refs = findSectionRefs(text, sectionMap).filter((ref) => ref.target);
    if (!refs.length) return false;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const ref of refs) {
      if (ref.start > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, ref.start)));
      }
      const link = document.createElement("a");
      link.className = "section-link";
      link.href = `#${encodeURIComponent(ref.target)}`;
      link.textContent = ref.display;
      link.setAttribute("aria-label", `Link to section ${ref.section}`);
      fragment.append(link);
      cursor = ref.end;
    }
    if (cursor < text.length) {
      fragment.append(document.createTextNode(text.slice(cursor)));
    }
    node.parentNode.replaceChild(fragment, node);
    return true;
  }

  function ensureHeadingIDs(headings) {
    if (typeof TOCModule === "undefined" || !TOCModule.ensureHeadingID) return;
    for (const heading of headings) {
      if (!heading.id) TOCModule.ensureHeadingID(heading);
    }
  }

  function collectCandidateNodes(main) {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.includes("§")) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIP_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function init() {
    const main = document.querySelector("main");
    if (!main) return null;
    const headings = [...main.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    ensureHeadingIDs(headings);
    const sectionMap = buildSectionMap(headings);
    if (!sectionMap.size) return sectionMap;
    for (const node of collectCandidateNodes(main)) {
      try {
        linkifyTextNode(node, sectionMap);
      } catch (error) {
        console.error("Section link failed", error);
      }
    }
    return sectionMap;
  }

  return { init, extractHeadingNumber, buildSectionMap, findSectionRefs };
})();

const FoldModule = (() => {
  const { ICONS, createButton, setButtonTitle } = UIComponentFactory;
  const FOLDABLE_SELECTOR = "main > h2,main > h3,main > h4,main > h5,main > h6";
  const VIEWPORT_OFFSET = 96;
  let uid = 0;
  const groups = [];

  function headingLevel(tagName) {
    return Number.parseInt(String(tagName).slice(1), 10);
  }

  // Pure: exclusive end of section i — the first later heading at least as high.
  function sectionEnd(levels, i) {
    for (let j = i + 1; j < levels.length; j += 1) {
      if (levels[j] <= levels[i]) return j;
    }
    return levels.length;
  }

  function planGroups(levels) {
    return levels.map((level, i) => ({ level, start: i, end: sectionEnd(levels, i) }));
  }

  function setCollapsed(entry, collapsed) {
    entry.group.classList.toggle("collapsed", collapsed);
    entry.button.setAttribute("aria-expanded", String(!collapsed));
    setButtonTitle(entry.button, collapsed ? "Expand section" : "Fold section");
  }

  function toggleGroup(entry) {
    setCollapsed(entry, !entry.group.classList.contains("collapsed"));
  }

  function toggleCurrent() {
    if (!groups.length) return null;
    let current = groups[0];
    for (const entry of groups) {
      if (entry.heading.getBoundingClientRect().top <= VIEWPORT_OFFSET) current = entry;
      else break;
    }
    toggleGroup(current);
    return current;
  }

  // Bulk ops skip the collapse animation: N simultaneous grid animations jank
  // on long docs, and an instant switch reads better for "show/hide everything".
  function setAllInstant(collapsed) {
    document.documentElement.classList.add("fold-instant");
    for (const entry of groups) setCollapsed(entry, collapsed);
    void document.documentElement.offsetHeight;
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove("fold-instant");
    });
  }

  function expandAll() {
    setAllInstant(false);
  }

  function collapseAll() {
    setAllInstant(true);
  }

  function expandAncestors(element) {
    let branch = element.parentElement;
    while (branch) {
      if (branch.classList?.contains("fold-group") && branch.classList.contains("collapsed")) {
        const entry = groups.find((candidate) => candidate.group === branch);
        if (entry) setCollapsed(entry, false);
        else branch.classList.remove("collapsed");
      }
      branch = branch.parentElement;
    }
  }

  // Reveal anything a fragment link points at: collapsed ancestor groups plus,
  // when the target is a section heading, that heading's own content group
  // (groups are siblings that follow their heading, not ancestors of it).
  function revealElement(element) {
    expandAncestors(element);
    const heading = element.closest?.("h1,h2,h3,h4,h5,h6");
    const entry = groups.find((candidate) => candidate.heading === heading);
    if (entry) setCollapsed(entry, false);
  }

  function nextGroupId() {
    uid += 1;
    return `fold-group-${uid}`;
  }

  function isSectionBoundary(node, level) {
    return (
      node.nodeType === Node.ELEMENT_NODE &&
      /^H[1-6]$/.test(node.tagName) &&
      headingLevel(node.tagName) <= level
    );
  }

  function collectSectionNodes(group, inner, level) {
    let node = group.nextSibling;
    while (node && !isSectionBoundary(node, level)) {
      const next = node.nextSibling;
      inner.append(node);
      node = next;
    }
  }

  function attachFoldControl(heading, group) {
    if (!heading.id && TOCModule.ensureHeadingID) TOCModule.ensureHeadingID(heading);
    heading.classList.add("foldable");
    const button = createButton("fold-btn", ICONS.caretDown, "Fold section", () => {
      const entry = groups.find((candidate) => candidate.heading === heading);
      if (entry) toggleGroup(entry);
    });
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", group.id);
    heading.prepend(button);
    return button;
  }

  function buildGroups(headings) {
    for (const heading of headings) {
      const level = headingLevel(heading.tagName);
      const group = document.createElement("div");
      group.className = "fold-group";
      group.id = nextGroupId();
      const inner = document.createElement("div");
      inner.className = "fold-group-inner";
      group.append(inner);
      heading.after(group);
      collectSectionNodes(group, inner, level);
      if (!inner.querySelector("*")) {
        group.remove();
        continue;
      }
      const button = attachFoldControl(heading, group);
      groups.push({ heading, button, group, level });
    }
  }

  function init() {
    const main = document.querySelector("main");
    if (!main) return groups;
    buildGroups([...main.querySelectorAll(FOLDABLE_SELECTOR)]);
    if (window.location?.hash) {
      try {
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        if (target) revealElement(target);
      } catch (_error) {
        // A malformed hash must never break reader startup.
      }
    }
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const link = target?.closest('a[href^="#"]');
        if (!link || link.classList.contains("heading-anchor")) return;
        try {
          const destination = document.getElementById(decodeURIComponent(link.hash.slice(1)));
          if (destination) revealElement(destination);
        } catch (_error) {
          // Ignore malformed fragment links.
        }
      },
      true,
    );
    // Headings toggle their own section. Text selection and interactive
    // descendants (links, buttons, code) keep working: those clicks are ignored.
    // Folding is a desktop affordance; compact layouts keep every section open.
    main.addEventListener("click", (event) => {
      if (isCompactLayout()) return;
      const target = event.target instanceof Element ? event.target : null;
      const heading = target?.closest(".foldable");
      if (!heading || !main.contains(heading)) return;
      if (target.closest("a,button,code,pre,input,textarea,select")) return;
      if (window.getSelection()?.toString()) return;
      const entry = groups.find((candidate) => candidate.heading === heading);
      if (entry) toggleGroup(entry);
    });
    return groups;
  }

  return { init, headingLevel, planGroups, toggleCurrent, expandAll, collapseAll };
})();

const TaskListModule = (() => {
  function initMarkdownTasks() {
    document.querySelectorAll('main li input[type="checkbox"]').forEach((checkbox) => {
      const item = checkbox.closest("li");
      item.classList.add("task-item");
      checkbox.removeAttribute("disabled");
      checkbox.setAttribute("aria-label", item.textContent.trim());
      const label = checkbox.closest("label");
      if (label && !label.querySelector(".task-text")) {
        const span = document.createElement("span");
        span.className = "task-text";
        const nodes = [...label.childNodes].filter((n) => n !== checkbox);
        span.append(...nodes);
        label.append(span);
      }
      const updateState = () => item.classList.toggle("task-completed", checkbox.checked);
      updateState();
      checkbox.addEventListener("change", updateState);
    });
    document.querySelectorAll("main ul").forEach((list) => {
      if ([...list.children].every((item) => item.classList.contains("task-item")))
        list.classList.add("task-list");
    });
  }

  function initInlineTasks() {
    document.querySelectorAll("main p, main li").forEach((element) => {
      if (element.closest("pre,code,.task-item,.inline-task-item")) return;
      const first = element.firstChild;
      if (first?.nodeType !== Node.TEXT_NODE) return;
      const match = first.textContent.match(/^\s*\[([ x])\]\s+/i);
      if (!match) return;
      first.textContent = first.textContent.slice(match[0].length);
      const label = document.createElement("label");
      label.className = "inline-task-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "inline-task-checkbox";
      checkbox.checked = match[1].toLowerCase() === "x";
      const text = document.createElement("span");
      text.append(...element.childNodes);
      label.append(checkbox, text);
      element.append(label);
      const update = () => label.classList.toggle("task-completed", checkbox.checked);
      checkbox.addEventListener("change", update);
      update();
    });
  }

  function init() {
    initMarkdownTasks();
    initInlineTasks();
  }

  return { init };
})();

const ReaderExtrasModule = (() => {
  const { ICONS, copyText, createButton, requestFrame, updateScrollLock } = UIComponentFactory;

  function debounce(callback, delay) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  function runFeature(name, initializer) {
    try {
      initializer();
    } catch (error) {
      console.error(`${name} initialization failed`, error);
    }
  }

  function initFloatingButtonAutoHide(settings) {
    const settingsToggle = settings?.toggle || document.querySelector(".settings-toggle");
    const settingsPanel = settings?.panel || document.querySelector(".settings-popover");
    let lastScrollTop = 0;
    let scheduled = false;
    // Only a keyboard-visible focus pins a button on screen. Mouse/touch
    // activation parks DOM focus on the toggle without ever matching
    // :focus-visible — that stale focus must not pin it, nor should hiding
    // strand focus on an invisible control.
    function focusPinned(element) {
      return (
        Boolean(element) && document.activeElement === element && element.matches(":focus-visible")
      );
    }
    const update = () => {
      scheduled = false;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = document.documentElement.clientHeight;
      if (
        scrollTop < 0 ||
        scrollTop + viewportHeight > documentHeight ||
        Math.abs(scrollTop - lastScrollTop) < 10
      ) {
        return;
      }
      const hide = scrollTop > lastScrollTop && scrollTop > 150;
      const compactLayout = isCompactLayout();
      const updateToggle = (toggle, blocked) => {
        const hideIt = compactLayout && hide && !focusPinned(toggle) && !blocked;
        if (hideIt && document.activeElement === toggle) toggle.blur();
        toggle?.classList.toggle("hidden", hideIt);
      };
      updateToggle(settingsToggle, settingsPanel?.classList.contains("active"));
      updateToggle(
        document.querySelector(".toc-toggle"),
        document.documentElement.classList.contains("toc-open"),
      );
      lastScrollTop = scrollTop;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (scheduled) return;
        scheduled = true;
        requestFrame(update);
      },
      { passive: true },
    );
    window.addEventListener(
      "resize",
      debounce(() => {
        if (!isCompactLayout()) {
          settingsToggle?.classList.remove("hidden");
          document.querySelector(".toc-toggle")?.classList.remove("hidden");
        }
      }, 100),
      { passive: true },
    );
  }

  function initMathJaxInteractionGuard() {
    const guard = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (target?.closest(".mjx-svg, mjx-container, .MathJax")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guard);
    document.addEventListener("contextmenu", guard);
  }

  function initReadingProgress() {
    const bar = document.createElement("div");
    bar.className = "reading-progress";
    document.body.append(bar);
    let scheduled = false;
    let maxScroll = 1;
    const measure = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    const update = () => {
      scheduled = false;
      const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      bar.style.transform = `scaleX(${progress})`;
    };
    measure();
    window.addEventListener(
      "scroll",
      () => {
        if (scheduled) return;
        scheduled = true;
        requestFrame(update);
      },
      { passive: true },
    );
    window.addEventListener(
      "resize",
      debounce(() => {
        measure();
        update();
      }, 100),
      { passive: true },
    );
    if (window.ResizeObserver)
      new ResizeObserver(() => {
        measure();
        update();
      }).observe(document.body);
    update();
  }

  function openLightbox(image) {
    const backdrop = document.createElement("div");
    backdrop.className = "lightbox-backdrop";
    const zoomed = image.cloneNode();
    zoomed.className = "lightbox-img";
    zoomed.removeAttribute("id");
    zoomed.removeAttribute("tabindex");
    zoomed.removeAttribute("role");
    zoomed.loading = "eager";
    const close = createButton("lightbox-close", ICONS.x, "Close image");
    backdrop.append(close, zoomed);
    document.body.append(backdrop);
    UIComponentFactory.focusDialog(backdrop, image.alt || "Image viewer");
    requestFrame(() => {
      backdrop.classList.add("active");
      updateScrollLock();
    });

    let scale = 1;
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let initialDistance = 0;
    let initialScale = 1;
    let lastTap = 0;
    let pinching = false;

    const draw = (transition = false) => {
      zoomed.style.transition = transition ? "transform var(--dur-ui) var(--ease-out)" : "none";
      zoomed.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    };
    const toggleZoom = (clientX, clientY) => {
      if (scale > 1.5) {
        scale = 1;
        x = 0;
        y = 0;
      } else {
        scale = 2.5;
        const rect = zoomed.getBoundingClientRect();
        x = -(clientX - rect.left - rect.width / 2) * 1.5;
        y = -(clientY - rect.top - rect.height / 2) * 1.5;
      }
      draw(true);
    };
    const stopMouseDrag = () => {
      dragging = false;
    };
    const moveMouse = (event) => {
      if (!dragging) return;
      x = event.clientX - startX;
      y = event.clientY - startY;
      draw();
    };
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      UIComponentFactory.releaseDialog(backdrop);
      backdrop.classList.remove("active");
      window.removeEventListener("mousemove", moveMouse);
      window.removeEventListener("mouseup", stopMouseDrag);
      window.setTimeout(() => {
        backdrop.remove();
        updateScrollLock();
      }, 300);
    };

    backdrop.addEventListener("click", dismiss);
    backdrop.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      dismiss();
    });
    zoomed.addEventListener("click", (event) => event.stopPropagation());
    zoomed.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      toggleZoom(event.clientX, event.clientY);
    });
    zoomed.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      startX = event.clientX - x;
      startY = event.clientY - y;
    });
    window.addEventListener("mousemove", moveMouse);
    window.addEventListener("mouseup", stopMouseDrag);
    zoomed.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        scale = Math.max(0.8, Math.min(5, scale * Math.exp(-event.deltaY * 0.001)));
        draw();
      },
      { passive: false },
    );
    zoomed.addEventListener(
      "touchstart",
      (event) => {
        event.stopPropagation();
        if (event.touches.length === 1) {
          pinching = false;
          dragging = true;
          startX = event.touches[0].clientX - x;
          startY = event.touches[0].clientY - y;
        } else if (event.touches.length === 2) {
          pinching = true;
          dragging = false;
          initialDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
          initialScale = scale;
        }
      },
      { passive: true },
    );
    zoomed.addEventListener(
      "touchmove",
      (event) => {
        event.stopPropagation();
        if (dragging && event.touches.length === 1) {
          x = event.touches[0].clientX - startX;
          y = event.touches[0].clientY - startY;
          draw();
        } else if (event.touches.length === 2 && initialDistance > 0) {
          pinching = true;
          const distance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
          scale = Math.max(0.8, Math.min(5, initialScale * (distance / initialDistance)));
          draw();
        }
      },
      { passive: true },
    );
    zoomed.addEventListener(
      "touchend",
      (event) => {
        dragging = false;
        if (!pinching && event.changedTouches.length === 1) {
          const now = Date.now();
          if (now - lastTap < 300) {
            const touch = event.changedTouches[0];
            toggleZoom(touch.clientX, touch.clientY);
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }
        if (event.touches.length === 0) pinching = false;
        if (scale < 1) {
          scale = 1;
          x = 0;
          y = 0;
          draw(true);
        }
      },
      { passive: true },
    );
  }

  function handleImageError(image) {
    const fallback = document.createElement("div");
    fallback.className = "image-fallback-card";
    fallback.setAttribute("role", "img");
    const label = image.alt || image.src.split("/").pop() || "Image unavailable";
    fallback.setAttribute("aria-label", label);
    fallback.innerHTML = `<span class="image-fallback-icon">${ICONS.image}</span><span class="image-fallback-text">${label}</span>`;
    image.replaceWith(fallback);
  }

  function initLightbox() {
    document.querySelectorAll("main img").forEach((image) => {
      if (image.closest(".mermaid-container,a,button")) return;
      if (image.complete && image.naturalWidth === 0 && image.src) {
        handleImageError(image);
        return;
      }
      image.addEventListener("error", () => handleImageError(image), { once: true });
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Enlarge image${image.alt ? `: ${image.alt}` : ""}`);
      image.decoding = "async";
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(image);
        }
      });
      image.style.cursor = "zoom-in";
      image.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openLightbox(image);
      });
    });
  }

  function initHeadingLinks() {
    document.querySelectorAll("main h2,main h3,main h4,main h5").forEach((heading) => {
      {
        if (heading.querySelector(".heading-anchor")) return;
        TOCModule.ensureHeadingID(heading);
        heading.classList.add("heading-with-anchor");
        const anchor = document.createElement("a");
        anchor.className = "heading-anchor";
        anchor.href = `#${encodeURIComponent(heading.id)}`;
        anchor.innerHTML = ICONS.link;
        anchor.title = "Copy link to this section";
        anchor.setAttribute("aria-label", `Link to ${heading.textContent}`);
        anchor.addEventListener("click", async (event) => {
          event.preventDefault();
          try {
            window.history.pushState(null, "", anchor.hash);
          } catch (error) {
            console.warn("Could not update section URL", error);
          }
          try {
            await copyText(window.location.href);
            anchor.innerHTML = ICONS.check;
            anchor.classList.add("copied");
            window.setTimeout(() => {
              anchor.innerHTML = ICONS.link;
              anchor.classList.remove("copied");
            }, 1500);
          } catch (error) {
            console.error("Copy link failed", error);
          }
        });
        heading.append(anchor);
      }
    });
  }

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
    backdrop.classList.remove("visible");
    window.setTimeout(() => backdrop.remove(), 350);
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
      backdrop.classList.add("visible");
      backdrop.querySelector(".close-settings")?.focus();
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

  function cycleTheme() {
    const themes = ["porcelain", "lumina", "parchment", "obsidian", "midnight-fjord", "evergreen"];
    const current = document.documentElement.dataset.theme || "porcelain";
    const index = themes.indexOf(current);
    const next = themes[(index + 1) % themes.length];
    const panel = document.getElementById("appearance-panel");
    const btn = panel?.querySelector(`.theme-option[data-theme-key="${next}"]`);
    if (btn) {
      btn.click();
    } else {
      document.documentElement.dataset.theme = next;
      StorageManager.setPreference("theme", next);
      if (typeof window.updateMermaidTheme === "function") window.updateMermaidTheme();
    }
  }

  function jumpToHeading(direction) {
    const headings = [...document.querySelectorAll("main :is(h2, h3, h4, h5, h6)")];
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

  function handleReaderShortcuts(event) {
    if (event.key === "Escape") {
      handleEscapeKey();
      return;
    }
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isInputActive(event.target)) return;
    if (document.querySelector(".modal-backdrop.visible, .lightbox-backdrop.active")) return;

    if (handleFoldShortcut(event)) return;
    switch (event.key.toLowerCase()) {
      case "t":
        event.preventDefault();
        cycleTheme();
        break;
      case "[":
      case "m":
        event.preventDefault();
        document.querySelector(".toc-toggle")?.click();
        break;
      case "j":
        event.preventDefault();
        jumpToHeading(1);
        break;
      case "k":
        event.preventDefault();
        jumpToHeading(-1);
        break;
      case "?":
        if (isCompactLayout()) break;
        event.preventDefault();
        toggleShortcuts();
        break;
    }
  }

  function initKeyboardShortcuts() {
    window.addEventListener("keydown", handleReaderShortcuts);
    window.addEventListener("resize", debounce(updateScrollLock, 100), { passive: true });
  }

  function restoreLocation() {
    if (window.location.hash) {
      try {
        document
          .getElementById(decodeURIComponent(window.location.hash.slice(1)))
          ?.scrollIntoView({ block: "start", behavior: "instant" });
      } catch (_error) {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
      }
      return;
    }
    const saved = StorageManager.getScrollPosition();
    if (saved) window.scrollTo(0, saved);
  }

  let loadingFinished = false;
  let readerInteracted = false;
  let restorationController;

  function revealDocument() {
    const overlay = document.getElementById("loading-overlay");
    if (!overlay || overlay.classList.contains("fade-out")) return;
    overlay.classList.add("fade-out");
    window.setTimeout(() => overlay.remove(), 200);
  }

  function finishLoading() {
    if (loadingFinished) return;
    loadingFinished = true;
    revealDocument();
    requestFrame(() => {
      // Diagram sizing can move deep links. Restore once layout is ready,
      // unless the reader has already started navigating.
      if (!readerInteracted) restoreLocation();
      StorageManager.enableScrollListener();
      restorationController?.abort();
    });
  }

  function init(settings) {
    restorationController = new AbortController();
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) {
      document.addEventListener(
        type,
        () => {
          readerInteracted = true;
        },
        {
          once: true,
          passive: true,
          signal: restorationController.signal,
        },
      );
    }
    runFeature("Floating button auto-hide", () => initFloatingButtonAutoHide(settings));
    runFeature("MathJax interaction guard", initMathJaxInteractionGuard);
    runFeature("Reading progress", initReadingProgress);
    runFeature("Image lightbox", initLightbox);
    runFeature("Heading links", initHeadingLinks);
    runFeature("Keyboard shortcuts", initKeyboardShortcuts);
  }

  return {
    init,
    initFloatingButtonAutoHide,
    initMathJaxInteractionGuard,
    initReadingProgress,
    initLightbox,
    initHeadingLinks,
    initKeyboardShortcuts,
    openLightbox,
    revealDocument,
    finishLoading,
  };
})();

// Mermaid predates the module boundary and calls this hook when closing fullscreen dialogs.
window.updateScrollLock = UIComponentFactory.updateScrollLock;
window.pdyFocusDialog = UIComponentFactory.focusDialog;
window.pdyReleaseDialog = UIComponentFactory.releaseDialog;
window.pdyHapticFeedback = HapticFeedback;

function reportModuleError(moduleName, error) {
  console.error(`${moduleName} initialization failed`, error);
}

async function main() {
  let settings = null;
  window.mermaid?.initialize?.({ startOnLoad: false });
  try {
    try {
      StorageManager.init();
    } catch (error) {
      reportModuleError("StorageManager", error);
    }
    try {
      HapticFeedback.init();
    } catch (error) {
      reportModuleError("HapticFeedback", error);
    }
    try {
      // Fold first: it wraps raw Pandoc blocks so later modules keep working inside groups.
      FoldModule.init();
    } catch (error) {
      reportModuleError("FoldModule", error);
    }
    try {
      void SettingsModule.loadFonts();
    } catch (error) {
      reportModuleError("SettingsModule fonts", error);
    }
    try {
      CodeBlockModule.init();
    } catch (error) {
      reportModuleError("CodeBlockModule", error);
    }
    try {
      TableModule.init();
    } catch (error) {
      reportModuleError("TableModule", error);
    }
    try {
      TaskListModule.init();
    } catch (error) {
      reportModuleError("TaskListModule", error);
    }
    try {
      settings = SettingsModule.init();
    } catch (error) {
      reportModuleError("SettingsModule", error);
    }
    try {
      TOCModule.init();
    } catch (error) {
      reportModuleError("TOCModule", error);
    }
    try {
      SectionLinkModule.init();
    } catch (error) {
      reportModuleError("SectionLinkModule", error);
    }
    try {
      ReaderExtrasModule.init(settings);
    } catch (error) {
      reportModuleError("ReaderExtrasModule", error);
    }
    ReaderExtrasModule.revealDocument();
    try {
      await SettingsModule.loadFonts();
      if (typeof window.initMermaid === "function") await window.initMermaid();
    } catch (error) {
      reportModuleError("Mermaid", error);
    }
  } finally {
    try {
      ReaderExtrasModule.finishLoading();
    } catch (error) {
      reportModuleError("Loading overlay", error);
      document.getElementById("loading-overlay")?.remove();
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main, { once: true });
} else {
  void main();
}
