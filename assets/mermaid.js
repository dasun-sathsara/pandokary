function getMermaidAPI() {
  const api = window.mermaid;
  return typeof api?.initialize === "function" && typeof api?.render === "function" ? api : null;
}

// Disable Mermaid's built-in auto-init before DOMContentLoaded can start its render pass.
const initialMermaid = getMermaidAPI();
if (initialMermaid) {
  try {
    initialMermaid.initialize({ startOnLoad: false });
  } catch (_error) {}
}

(() => {
  const FONT_FAMILY = '"Maple Mono NF", "Maple Mono", monospace';
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 15;
  const NOTE_PADDING = 50;
  const MODAL_TRANSITION_MS = 350;
  const WHEEL_SETTLE_MS = 180;
  const DARK_THEME_IDS = new Set(["obsidian", "studio-dark", "ayu-mirage"]);
  const controllers = new Set();
  const controllerByContainer = new WeakMap();
  let activeModalController = null;
  let lifecycleObserver = null;
  let lifecycleFrame = 0;
  let mermaidIdCounter = 0;
  let renderQueue = Promise.resolve();

  const MERMAID_DEFAULTS = {
    startOnLoad: false,
    look: "classic",
    fontFamily: FONT_FAMILY,
    flowchart: {
      useMaxWidth: false,
      htmlLabels: false,
      subGraphTitleMargin: { top: 16, bottom: 16 },
      nodeSpacing: 50,
      rankSpacing: 50,
      diagramPadding: 20,
    },
    sequence: { useMaxWidth: false, boxMargin: 12, noteMargin: 12 },
    gantt: { useMaxWidth: false },
  };

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function requestFrame(callback) {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }
    return window.setTimeout(callback, 0);
  }

  function cancelFrame(frame) {
    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(frame);
      return;
    }
    window.clearTimeout(frame);
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") || "lumina";
  }

  function isDarkTheme(theme) {
    const manifest = window.PDY_THEME_MANIFEST;
    const manifestEntry = Array.isArray(manifest)
      ? manifest.find((entry) => entry.id === theme)
      : null;
    if (manifestEntry?.mode) {
      return manifestEntry.mode === "dark";
    }
    if (DARK_THEME_IDS.has(theme) || theme.toLowerCase().includes("dark")) {
      return true;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }

  function getMermaidConfig(theme) {
    const themesMap = window.PDY_MERMAID_THEMES || {};
    const fallbackTheme = isDarkTheme(theme) ? "obsidian" : "lumina";
    const selectedConfig = themesMap[theme] ||
      themesMap[fallbackTheme] || {
        theme: isDarkTheme(theme) ? "dark" : "default",
        themeVariables: {},
      };

    return {
      ...MERMAID_DEFAULTS,
      ...selectedConfig,
      startOnLoad: false,
      look: "classic",
      fontFamily: FONT_FAMILY,
      flowchart: {
        ...MERMAID_DEFAULTS.flowchart,
        ...(selectedConfig.flowchart || {}),
        subGraphTitleMargin: {
          top: 16,
          bottom: 16,
          ...(selectedConfig.flowchart?.subGraphTitleMargin || {}),
        },
      },
      sequence: {
        ...MERMAID_DEFAULTS.sequence,
        ...(selectedConfig.sequence || {}),
      },
      gantt: {
        ...MERMAID_DEFAULTS.gantt,
        ...(selectedConfig.gantt || {}),
      },
      themeVariables: {
        fontSize: "14px",
        ...(selectedConfig.themeVariables || {}),
        fontFamily: FONT_FAMILY,
      },
    };
  }
  const ICONS = {
    zoomIn:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-magnifying-glass-plus"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zoomOut:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-magnifying-glass-minus"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zoomReset:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-arrow-counter-clockwise"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    maximize:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-arrows-out-simple"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    minimize:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-arrows-in-simple"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    rotate:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-arrow-clockwise"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    diagram:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ph ph-diagram mermaid-title-icon"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  };

  function createMermaidButton(className, iconHtml, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.innerHTML = iconHtml;
    button.title = title;
    button.setAttribute("aria-label", title);
    return button;
  }

  function createDiagramContainer(code) {
    const container = document.createElement("div");
    container.className = "mermaid-container";
    container.dataset.mermaidCode = code;

    const toolbar = document.createElement("div");
    toolbar.className = "mermaid-toolbar";

    const title = document.createElement("span");
    title.className = "mermaid-title";
    title.innerHTML = `${ICONS.diagram} <span>Diagram</span>`;

    const actions = document.createElement("div");
    actions.className = "mermaid-actions";
    actions.append(
      createMermaidButton("mermaid-btn btn-zoom-out", ICONS.zoomOut, "Zoom Out"),
      createMermaidButton("mermaid-btn btn-zoom-reset", ICONS.zoomReset, "Reset View"),
      createMermaidButton("mermaid-btn btn-zoom-in", ICONS.zoomIn, "Zoom In"),
      createMermaidButton("mermaid-btn btn-maximize", ICONS.maximize, "Toggle Fullscreen"),
      createMermaidButton("mermaid-btn btn-rotate", ICONS.rotate, "Rotate Landscape"),
    );
    toolbar.append(title, actions);

    const viewport = document.createElement("div");
    viewport.className = "mermaid-viewport";
    const content = document.createElement("div");
    content.className = "mermaid-content";
    viewport.append(content);
    container.append(toolbar, viewport);
    return container;
  }

  function getRequiredElements(container) {
    const elements = {
      content: container.querySelector(".mermaid-content"),
      viewport: container.querySelector(".mermaid-viewport"),
      zoomInButton: container.querySelector(".btn-zoom-in"),
      zoomOutButton: container.querySelector(".btn-zoom-out"),
      resetButton: container.querySelector(".btn-zoom-reset"),
      maximizeButton: container.querySelector(".btn-maximize"),
      rotateButton: container.querySelector(".btn-rotate"),
    };
    return Object.values(elements).every(Boolean) ? elements : null;
  }

  function parseViewBox(svg) {
    const values = svg
      .getAttribute("viewBox")
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    if (values?.length === 4 && values.every(Number.isFinite)) {
      return { width: values[2], height: values[3] };
    }
    return null;
  }

  function parseSvgLength(value) {
    const parsed = Number.parseFloat(value || "");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function getSvgDimensions(svg) {
    const viewBox = parseViewBox(svg);
    return {
      width: viewBox?.width || parseSvgLength(svg.getAttribute("width")) || 800,
      height: viewBox?.height || parseSvgLength(svg.getAttribute("height")) || 600,
    };
  }

  function getTextWidth(text) {
    try {
      return text.getBBox().width;
    } catch (_error) {
      return 0;
    }
  }

  function adjustSequenceNotePadding(svg) {
    for (const rectangle of svg.querySelectorAll("rect.note")) {
      const parent = rectangle.parentElement;
      const texts = parent ? parent.querySelectorAll("text.noteText") : [];
      let maximumTextWidth = 0;
      for (const text of texts) {
        maximumTextWidth = Math.max(maximumTextWidth, getTextWidth(text));
      }

      const currentWidth = parseSvgLength(rectangle.getAttribute("width"));
      const currentX = Number.parseFloat(rectangle.getAttribute("x") || "");
      const neededWidth = maximumTextWidth + NOTE_PADDING;
      if (!currentWidth || !Number.isFinite(currentX) || neededWidth <= currentWidth) {
        continue;
      }

      rectangle.setAttribute("width", String(neededWidth));
      rectangle.setAttribute("x", String(currentX - (neededWidth - currentWidth) / 2));
    }
  }

  function getErrorMessage(error) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  function createRenderError(error) {
    const box = document.createElement("div");
    box.style.cssText = [
      "color: #ef4444",
      "padding: 1.5rem",
      "font-family: var(--font-mono), monospace",
      "border-left: 4px solid #ef4444",
      "background: var(--color-code-bg)",
      "text-align: left",
      "width: 100%",
      "box-sizing: border-box",
    ].join(";");

    const heading = document.createElement("strong");
    heading.textContent = "Mermaid Error:";
    const details = document.createElement("pre");
    details.style.cssText = [
      "border: none",
      "margin: 0",
      "padding: 0.5rem 0",
      "color: #ef4444",
      "background: transparent",
      "font-size: 14px",
      "text-align: left",
      "white-space: pre-wrap",
    ].join(";");
    details.textContent = getErrorMessage(error);
    box.append(heading, details);
    return box;
  }

  function mapClientPoint(clientX, clientY, rectangle, isRotated) {
    const screenX = clientX - rectangle.left;
    const screenY = clientY - rectangle.top;
    if (isRotated) {
      return { x: screenY, y: rectangle.width - screenX };
    }
    return { x: screenX, y: screenY };
  }

  function getLogicalViewportSize(rectangle, isRotated) {
    return isRotated
      ? { width: rectangle.height, height: rectangle.width }
      : { width: rectangle.width, height: rectangle.height };
  }

  function getPointerDistance(first, second) {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  }

  function getPointerMidpoint(first, second) {
    return {
      clientX: (first.clientX + second.clientX) / 2,
      clientY: (first.clientY + second.clientY) / 2,
    };
  }

  function getWheelScaleFactor(event, rectangle) {
    let deltaY = event.deltaY;
    if (!event.ctrlKey) {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        deltaY *= 16;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        deltaY *= rectangle.height;
      }
      deltaY = clamp(deltaY, -120, 120);
    }
    return Math.exp(-deltaY * 0.0015);
  }

  function updateScrollLockFallback() {
    if (typeof window.updateScrollLock === "function") {
      window.updateScrollLock();
      return;
    }
    const hasModal = document.querySelector(
      ".mermaid-container.maximized,.table-scroll-container.maximized,.lightbox-backdrop.active",
    );
    document.body.classList.toggle("scroll-locked", Boolean(hasModal));
  }

  class MermaidController {
    constructor(container, elements) {
      this.container = container;
      this.content = elements.content;
      this.viewport = elements.viewport;
      this.zoomInButton = elements.zoomInButton;
      this.zoomOutButton = elements.zoomOutButton;
      this.resetButton = elements.resetButton;
      this.maximizeButton = elements.maximizeButton;
      this.rotateButton = elements.rotateButton;
      this.abortController = new AbortController();
      this.activePointers = new Map();
      this.diagramWidth = 800;
      this.diagramHeight = 600;
      this.scale = 1;
      this.x = 0;
      this.y = 0;
      this.cachedRectangle = null;
      this.dragStart = null;
      this.pinchStart = null;
      this.isDragging = false;
      this.hasDiagram = false;
      this.transformFrame = 0;
      this.resetTimer = 0;
      this.wheelTimer = 0;
      this.modalTimer = 0;
      this.modalFrame = 0;
      this.modalBackdrop = null;
      this.modalAbortController = null;
      this.renderToken = 0;
      this.resizeObserver = null;
      this.viewport.style.touchAction = "none";
      this.bindControls();
      this.bindGestures();
      this.observeViewport();
    }

    isRotated() {
      return this.container.classList.contains("rotated-landscape");
    }

    getRectangle() {
      if (!this.cachedRectangle) {
        const rectangle = this.viewport.getBoundingClientRect();
        this.cachedRectangle = {
          left: rectangle.left,
          top: rectangle.top,
          width: rectangle.width,
          height: rectangle.height,
        };
      }
      return this.cachedRectangle;
    }

    invalidateRectangle() {
      this.cachedRectangle = null;
    }

    scheduleTransform() {
      if (this.transformFrame) {
        return;
      }
      this.transformFrame = requestFrame(() => {
        this.transformFrame = 0;
        this.applyTransform();
      });
    }

    applyTransform() {
      this.content.style.width = `${this.diagramWidth}px`;
      this.content.style.height = `${this.diagramHeight}px`;
      this.content.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;
    }

    zoomAtPoint(pointX, pointY, factor) {
      if (!Number.isFinite(factor) || factor <= 0) {
        return;
      }
      const nextScale = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
      const diagramX = (pointX - this.x) / this.scale;
      const diagramY = (pointY - this.y) / this.scale;
      this.x = pointX - diagramX * nextScale;
      this.y = pointY - diagramY * nextScale;
      this.scale = nextScale;
      this.scheduleTransform();
    }

    zoomAtCenter(factor) {
      this.invalidateRectangle();
      const rectangle = this.getRectangle();
      const size = getLogicalViewportSize(rectangle, this.isRotated());
      this.zoomAtPoint(size.width / 2, size.height / 2, factor);
    }

    resetView() {
      this.invalidateRectangle();
      const rectangle = this.getRectangle();
      const size = getLogicalViewportSize(rectangle, this.isRotated());
      if (!this.hasDiagram || size.width <= 0 || size.height <= 0) {
        return;
      }

      const widthScale = size.width / this.diagramWidth;
      const heightScale = size.height / this.diagramHeight;
      this.scale = clamp(Math.min(widthScale, heightScale) * 0.9, MIN_SCALE, MAX_SCALE);
      this.x = (size.width - this.diagramWidth * this.scale) / 2;
      this.y = (size.height - this.diagramHeight * this.scale) / 2;
      this.scheduleTransform();
    }

    queueReset(delay = 0) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = window.setTimeout(() => this.resetView(), delay);
    }

    bindControls() {
      const signal = this.abortController.signal;
      this.zoomInButton.addEventListener("click", () => this.zoomAtCenter(1.25), { signal });
      this.zoomOutButton.addEventListener("click", () => this.zoomAtCenter(0.8), { signal });
      this.resetButton.addEventListener("click", () => this.resetView(), { signal });
      this.maximizeButton.addEventListener("click", () => this.toggleModal(), { signal });
      this.rotateButton.addEventListener("click", () => this.toggleRotation(), { signal });
    }

    bindGestures() {
      const signal = this.abortController.signal;
      this.viewport.addEventListener("pointerdown", (event) => this.handlePointerDown(event), {
        signal,
      });
      this.viewport.addEventListener("pointermove", (event) => this.handlePointerMove(event), {
        signal,
      });
      this.viewport.addEventListener("pointerup", (event) => this.finishPointer(event.pointerId), {
        signal,
      });
      this.viewport.addEventListener(
        "pointercancel",
        (event) => this.finishPointer(event.pointerId),
        { signal },
      );
      this.viewport.addEventListener(
        "lostpointercapture",
        (event) => this.finishPointer(event.pointerId, false),
        { signal },
      );
      this.viewport.addEventListener("wheel", (event) => this.handleWheel(event), {
        passive: false,
        signal,
      });
      window.addEventListener("blur", () => this.clearPointers(), { signal });
      window.addEventListener("resize", () => this.invalidateRectangle(), {
        passive: true,
        signal,
      });
    }

    observeViewport() {
      if (!("ResizeObserver" in window)) {
        return;
      }
      this.resizeObserver = new ResizeObserver(() => {
        this.invalidateRectangle();
        if (this.hasDiagram) {
          const resetDelay = this.container.classList.contains("maximized")
            ? MODAL_TRANSITION_MS
            : 50;
          this.queueReset(resetDelay);
        }
      });
      this.resizeObserver.observe(this.viewport);
    }

    handlePointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      event.preventDefault();
      if (this.activePointers.size === 0) {
        this.invalidateRectangle();
      }
      this.getRectangle();
      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      try {
        this.viewport.setPointerCapture(event.pointerId);
      } catch (error) {
        console.debug("Pointer capture was unavailable", error);
      }

      if (this.activePointers.size === 1) {
        this.startDrag();
      } else if (this.activePointers.size === 2) {
        this.startPinch();
      } else {
        this.stopDragging();
      }
    }

    handlePointerMove(event) {
      const pointer = this.activePointers.get(event.pointerId);
      if (!pointer) {
        return;
      }
      event.preventDefault();
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
      if (this.activePointers.size === 1 && this.isDragging) {
        this.updateDrag(pointer);
      } else if (this.activePointers.size === 2) {
        this.updatePinch();
      }
    }

    startDrag() {
      const pointer = this.activePointers.values().next().value;
      if (!pointer) {
        return;
      }
      this.dragStart = {
        clientX: pointer.clientX,
        clientY: pointer.clientY,
        x: this.x,
        y: this.y,
      };
      this.pinchStart = null;
      this.isDragging = true;
      this.viewport.style.cursor = "grabbing";
    }

    updateDrag(pointer) {
      const start = this.dragStart;
      if (!start) {
        return;
      }
      const deltaX = pointer.clientX - start.clientX;
      const deltaY = pointer.clientY - start.clientY;
      if (this.isRotated()) {
        this.x = start.x + deltaY;
        this.y = start.y - deltaX;
      } else {
        this.x = start.x + deltaX;
        this.y = start.y + deltaY;
      }
      this.scheduleTransform();
    }

    startPinch() {
      const [first, second] = [...this.activePointers.values()];
      if (!first || !second) {
        return;
      }
      const rectangle = this.getRectangle();
      const midpoint = getPointerMidpoint(first, second);
      const localPoint = mapClientPoint(
        midpoint.clientX,
        midpoint.clientY,
        rectangle,
        this.isRotated(),
      );
      this.pinchStart = {
        distance: getPointerDistance(first, second),
        scale: this.scale,
        diagramX: (localPoint.x - this.x) / this.scale,
        diagramY: (localPoint.y - this.y) / this.scale,
      };
      this.stopDragging();
    }

    updatePinch() {
      const [first, second] = [...this.activePointers.values()];
      const start = this.pinchStart;
      if (!first || !second || !start || start.distance <= 0) {
        return;
      }
      const distance = getPointerDistance(first, second);
      const midpoint = getPointerMidpoint(first, second);
      const localPoint = mapClientPoint(
        midpoint.clientX,
        midpoint.clientY,
        this.getRectangle(),
        this.isRotated(),
      );
      this.scale = clamp(start.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE);
      this.x = localPoint.x - start.diagramX * this.scale;
      this.y = localPoint.y - start.diagramY * this.scale;
      this.scheduleTransform();
    }

    stopDragging() {
      this.dragStart = null;
      this.isDragging = false;
      this.viewport.style.cursor = "grab";
    }

    releasePointer(pointerId) {
      try {
        if (this.viewport.hasPointerCapture(pointerId)) {
          this.viewport.releasePointerCapture(pointerId);
        }
      } catch (error) {
        console.debug("Pointer capture was already released", error);
      }
    }

    finishPointer(pointerId, shouldRelease = true) {
      if (!this.activePointers.has(pointerId)) {
        return;
      }
      this.activePointers.delete(pointerId);
      if (shouldRelease) {
        this.releasePointer(pointerId);
      }

      if (this.activePointers.size === 0) {
        this.stopDragging();
        this.pinchStart = null;
        this.invalidateRectangle();
      } else if (this.activePointers.size === 1) {
        this.startDrag();
      } else if (this.activePointers.size === 2) {
        this.startPinch();
      }
    }

    clearPointers() {
      const pointerIds = [...this.activePointers.keys()];
      this.activePointers.clear();
      for (const pointerId of pointerIds) {
        this.releasePointer(pointerId);
      }
      this.stopDragging();
      this.pinchStart = null;
      this.invalidateRectangle();
    }

    handleWheel(event) {
      if (!this.container.classList.contains("maximized")) {
        return;
      }
      event.preventDefault();
      if (!this.wheelTimer) {
        this.invalidateRectangle();
      }
      const rectangle = this.getRectangle();
      const point = mapClientPoint(event.clientX, event.clientY, rectangle, this.isRotated());
      this.zoomAtPoint(point.x, point.y, getWheelScaleFactor(event, rectangle));
      window.clearTimeout(this.wheelTimer);
      this.wheelTimer = window.setTimeout(() => {
        this.wheelTimer = 0;
        this.invalidateRectangle();
      }, WHEEL_SETTLE_MS);
    }

    toggleRotation() {
      this.container.classList.toggle("rotated-landscape");
      this.clearPointers();
      this.invalidateRectangle();
      this.queueReset(this.container.classList.contains("maximized") ? MODAL_TRANSITION_MS : 50);
    }

    toggleModal() {
      if (this.modalBackdrop || this.modalTimer) {
        this.closeModal();
      } else {
        this.openModal();
      }
    }

    openModal() {
      if (activeModalController && activeModalController !== this) {
        activeModalController.closeModal(true);
      }
      window.clearTimeout(this.modalTimer);
      cancelFrame(this.modalFrame);
      this.modalTimer = 0;
      this.modalAbortController?.abort();
      this.modalAbortController = new AbortController();

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      const signal = this.modalAbortController.signal;
      backdrop.addEventListener(
        "click",
        (event) => {
          if (event.target === backdrop) {
            this.closeModal();
          }
        },
        { signal },
      );
      backdrop.addEventListener("touchmove", (event) => event.preventDefault(), {
        passive: false,
        signal,
      });

      this.modalBackdrop = backdrop;
      activeModalController = this;
      this.container.classList.add("maximized");
      document.body.append(backdrop);
      this.setMaximizeButtonState(true);
      updateScrollLockFallback();
      this.modalFrame = requestFrame(() => {
        this.modalFrame = 0;
        this.container.classList.add("visible");
        backdrop.classList.add("visible");
      });
      this.invalidateRectangle();
      this.queueReset(MODAL_TRANSITION_MS);
    }

    closeModal(immediate = false) {
      const backdrop = this.modalBackdrop;
      if (!backdrop && !this.modalTimer) {
        return;
      }
      if (activeModalController === this) {
        activeModalController = null;
      }
      cancelFrame(this.modalFrame);
      this.modalFrame = 0;
      this.container.classList.remove("visible");
      backdrop?.classList.remove("visible");
      this.setMaximizeButtonState(false);

      const finishClose = () => {
        this.modalTimer = 0;
        this.modalAbortController?.abort();
        this.modalAbortController = null;
        backdrop?.remove();
        if (this.modalBackdrop === backdrop) {
          this.modalBackdrop = null;
        }
        this.container.classList.remove("maximized", "rotated-landscape");
        this.clearPointers();
        updateScrollLockFallback();
        this.queueReset();
      };

      window.clearTimeout(this.modalTimer);
      if (immediate) {
        finishClose();
      } else {
        this.modalTimer = window.setTimeout(finishClose, MODAL_TRANSITION_MS);
      }
    }

    setMaximizeButtonState(isMaximized) {
      const title = isMaximized ? "Restore Normal View" : "Toggle Fullscreen";
      this.maximizeButton.innerHTML = isMaximized ? ICONS.minimize : ICONS.maximize;
      this.maximizeButton.title = title;
      this.maximizeButton.setAttribute("aria-label", title);
      this.maximizeButton.setAttribute("aria-expanded", String(isMaximized));
    }

    async render(mermaid, code) {
      const token = ++this.renderToken;
      const id = `mermaid-svg-${++mermaidIdCounter}`;
      try {
        const { svg } = await mermaid.render(id, code);
        if (token !== this.renderToken) {
          return;
        }
        this.content.innerHTML = svg;
        const renderedSvg = this.content.querySelector("svg");
        if (!renderedSvg) {
          throw new Error("Mermaid did not return an SVG diagram.");
        }

        adjustSequenceNotePadding(renderedSvg);
        const dimensions = getSvgDimensions(renderedSvg);
        this.diagramWidth = dimensions.width;
        this.diagramHeight = dimensions.height;
        this.hasDiagram = true;
        renderedSvg.setAttribute("width", "100%");
        renderedSvg.setAttribute("height", "100%");
        renderedSvg.style.maxWidth = "none";
        this.content.style.transformOrigin = "0 0";
        this.queueReset();
      } catch (error) {
        document.querySelectorAll(`#d${id}, #${id}`).forEach((el) => {
          el.remove();
        });
        if (token === this.renderToken) {
          this.showRenderError(error);
        }
        console.error("Failed to render Mermaid diagram", error);
      }
    }

    showRenderError(error) {
      this.hasDiagram = false;
      this.x = 0;
      this.y = 0;
      this.scale = 1;
      if (this.transformFrame) {
        cancelFrame(this.transformFrame);
        this.transformFrame = 0;
      }
      this.content.style.width = "100%";
      this.content.style.height = "100%";
      this.content.style.transform = "none";
      this.content.replaceChildren(createRenderError(error));
    }

    destroy() {
      ++this.renderToken;
      this.abortController.abort();
      this.resizeObserver?.disconnect();
      this.clearPointers();
      this.closeModal(true);
      cancelFrame(this.transformFrame);
      cancelFrame(this.modalFrame);
      window.clearTimeout(this.resetTimer);
      window.clearTimeout(this.wheelTimer);
      window.clearTimeout(this.modalTimer);
      controllerByContainer.delete(this.container);
      controllers.delete(this);
    }
  }

  function cleanDetachedControllers() {
    for (const controller of controllers) {
      if (!controller.container.isConnected) {
        controller.destroy();
      }
    }
  }

  function scheduleControllerCleanup() {
    if (lifecycleFrame) {
      return;
    }
    lifecycleFrame = requestFrame(() => {
      lifecycleFrame = 0;
      cleanDetachedControllers();
    });
  }

  function ensureLifecycleObserver() {
    if (lifecycleObserver || !document.body || !("MutationObserver" in window)) {
      return;
    }
    lifecycleObserver = new MutationObserver(scheduleControllerCleanup);
    lifecycleObserver.observe(document.body, { childList: true, subtree: true });
  }

  function registerController(container) {
    const existing = controllerByContainer.get(container);
    if (existing) {
      return existing;
    }
    const elements = getRequiredElements(container);
    if (!elements) {
      return null;
    }
    const controller = new MermaidController(container, elements);
    controllerByContainer.set(container, controller);
    controllers.add(controller);
    ensureLifecycleObserver();
    return controller;
  }

  async function renderControllers(theme, diagramControllers) {
    const mermaid = getMermaidAPI();
    if (!mermaid) return;

    try {
      mermaid.initialize(getMermaidConfig(theme));
    } catch (error) {
      console.error("Failed to initialize Mermaid", error);
      for (const controller of diagramControllers) {
        controller.showRenderError(error);
      }
      return;
    }

    for (const controller of diagramControllers) {
      if (controller.container.isConnected) {
        await controller.render(mermaid, controller.container.dataset.mermaidCode || "");
      }
    }
  }

  function enqueueRender(theme, diagramControllers) {
    const operation = () => renderControllers(theme, diagramControllers);
    const result = renderQueue.then(operation, operation);
    renderQueue = result.catch(() => {});
    return result;
  }

  function extractMermaidCode(block) {
    const source = block.dataset.mermaidCode;
    return (source ?? block.querySelector("code")?.textContent ?? block.textContent ?? "").trim();
  }

  async function initMermaid() {
    if (!getMermaidAPI()) {
      console.warn("Mermaid library is not loaded; skipping diagram rendering.");
      return;
    }

    cleanDetachedControllers();
    const newControllers = [];
    for (const block of document.querySelectorAll("pre.mermaid")) {
      const code = extractMermaidCode(block);
      const container = createDiagramContainer(code);
      block.replaceWith(container);
      const controller = registerController(container);
      if (controller) {
        newControllers.push(controller);
      }
    }
    await enqueueRender(getCurrentTheme(), newControllers);
  }

  async function updateMermaidTheme() {
    if (!getMermaidAPI()) {
      return;
    }

    cleanDetachedControllers();
    const diagramControllers = [];
    for (const container of document.querySelectorAll(".mermaid-container")) {
      const controller = registerController(container);
      if (controller) {
        diagramControllers.push(controller);
      }
    }
    await enqueueRender(getCurrentTheme(), diagramControllers);
  }

  document.addEventListener("keydown", (event) => {
    const isEscape =
      event.key === "Escape" || event.code === "Escape" || event.code === "KeyEscape";
    if (!isEscape || !activeModalController) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    activeModalController.closeModal();
  });

  window.initMermaid = initMermaid;
  window.updateMermaidTheme = updateMermaidTheme;
})();
