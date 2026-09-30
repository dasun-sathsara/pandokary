PDY.UIComponentFactory = (() => {
  const { isCompactLayout, PHONE_MEDIA_QUERY, requestFrame, cancelFrame } = PDY;
  const MODAL_TRANSITION_MS = 350;
  const MODAL_SELECTOR =
    ".table-scroll-container.maximized,.mermaid-container.maximized,.lightbox-backdrop.active,.shortcuts-backdrop.visible";
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

  function setButtonTitle(button, title) {
    button.title = title;
    button.setAttribute("aria-label", title);
  }

  function createButton(className, iconHtml, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.innerHTML = iconHtml;
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
    try {
      if (!document.execCommand("copy")) throw new Error("Clipboard copy was rejected");
    } finally {
      textarea.remove();
      previousFocus?.focus({ preventScroll: true });
    }
  }

  function updateScrollLock() {
    const hasTOC = Boolean(document.querySelector(".toc-sidebar"));
    const compact = isCompactLayout();
    const mobileTOC = hasTOC && compact && document.documentElement.classList.contains("toc-open");
    const mobileSettings =
      window.matchMedia?.(PHONE_MEDIA_QUERY).matches &&
      document.querySelector(".settings-popover.active") !== null;
    document.body.classList.toggle(
      "scroll-locked",
      Boolean(document.querySelector(MODAL_SELECTOR)) || mobileTOC || mobileSettings,
    );
  }

  const dialogStates = new WeakMap();

  function trapDialogFocus(container, event) {
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
    const edge = event.shiftKey ? first : last;
    if (!container.contains(document.activeElement) || document.activeElement === edge) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  function focusDialog(container, label) {
    if (dialogStates.has(container)) return;
    const previousFocus = document.activeElement;
    const attributes = ["role", "aria-label", "aria-modal"].map((name) => [
      name,
      container.getAttribute(name),
    ]);
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
    const trap = (event) => trapDialogFocus(container, event);
    container.addEventListener("keydown", trap);
    dialogStates.set(container, { previousFocus, attributes, siblings, trap });
    container
      .querySelector(".btn-maximize,.lightbox-close,a[href],button")
      ?.focus({ preventScroll: true });
  }

  function releaseDialog(container, restoreFocus = true) {
    const state = dialogStates.get(container);
    if (!state) return;
    container.removeEventListener("keydown", state.trap);
    for (const [element, inert] of state.siblings) element.inert = inert;
    for (const [attribute, value] of state.attributes) {
      if (value === null) container.removeAttribute(attribute);
      else container.setAttribute(attribute, value);
    }
    dialogStates.delete(container);
    if (restoreFocus && state.previousFocus?.isConnected) {
      state.previousFocus.focus({ preventScroll: true });
    }
  }

  let activeModal = null;

  function openModal(container, { label = "Expanded table", onDismiss, onClose } = {}) {
    if (activeModal?.container === container) return activeModal.backdrop;
    if (activeModal) closeModal(activeModal.container, true);
    container.classList.add("maximized");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const events = new AbortController();
    const dismiss = onDismiss || (() => closeModal(container));
    backdrop.addEventListener("click", dismiss, { signal: events.signal });
    backdrop.addEventListener("touchmove", (event) => event.preventDefault(), {
      passive: false,
      signal: events.signal,
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
      },
      { signal: events.signal },
    );
    document.body.append(backdrop);
    const state = { container, backdrop, events, onClose, frame: 0, timer: null, observer: null };
    activeModal = state;
    focusDialog(container, label);
    state.frame = requestFrame(() => {
      state.frame = 0;
      container.classList.add("visible");
      backdrop.classList.add("visible");
    });
    if (window.MutationObserver) {
      state.observer = new MutationObserver(() => {
        if (!container.isConnected) closeModal(container, true);
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
    }
    updateScrollLock();
    return backdrop;
  }

  function closeModal(container, immediate = false) {
    const state = activeModal;
    if (state?.container !== container || (state.timer !== null && !immediate)) return;
    cancelFrame(state.frame);
    state.events.abort();
    releaseDialog(container);
    container.classList.remove("visible");
    state.backdrop.classList.remove("visible");
    window.clearTimeout(state.timer);
    const finish = () => {
      state.observer?.disconnect();
      container.classList.remove("maximized", "rotated-landscape");
      state.backdrop.remove();
      activeModal = null;
      updateScrollLock();
      state.onClose?.();
    };
    if (immediate) finish();
    else state.timer = window.setTimeout(finish, MODAL_TRANSITION_MS);
  }

  return {
    ICONS,
    createButton,
    setButtonTitle,
    copyText,
    MODAL_TRANSITION_MS,
    updateScrollLock,
    openModal,
    closeModal,
    focusDialog,
    releaseDialog,
  };
})();
