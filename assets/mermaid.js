PDY.MermaidModule = (() => {
  const { clamp, requestFrame, cancelFrame, runFeature, PHONE_MEDIA_QUERY } = PDY;

  function getMermaidAPI() {
    const api = window.mermaid;
    return typeof api?.initialize === "function" && typeof api?.render === "function" ? api : null;
  }

  // Disable Mermaid's built-in auto-init before DOMContentLoaded can start its render pass.
  const initialMermaid = getMermaidAPI();
  if (initialMermaid) {
    runFeature("Mermaid auto-init suppression", () => {
      initialMermaid.initialize({ startOnLoad: false });
    });
  }
  const { createButton, setButtonTitle, updateScrollLock, focusDialog, releaseDialog } =
    PDY.UIComponentFactory;
  const FONT_FAMILY = '"Geist Mono", "Noto Sans Sinhala", monospace';
  const MAX_SCALE = 15;
  const VIEW_PADDING = 24;
  const MODAL_TRANSITION_MS = 350;
  const DARK_THEME_IDS = new Set(["obsidian", "midnight-fjord", "evergreen"]);
  const controllers = new Set();
  const controllerByContainer = new WeakMap();
  let activeModalController = null;
  let lifecycleObserver = null;
  let lifecycleFrame = 0;
  let mermaidIdCounter = 0;
  let renderQueue = Promise.resolve();
  let renderVersion = 0;

  const MERMAID_DEFAULTS = {
    startOnLoad: false,
    htmlLabels: false,
    look: "classic",
    fontFamily: FONT_FAMILY,
    flowchart: {
      useMaxWidth: false,
      htmlLabels: false,
      subGraphTitleMargin: { top: 12, bottom: 12 },
      nodeSpacing: 32,
      rankSpacing: 36,
      diagramPadding: 12,
      padding: 6,
    },
    sequence: { useMaxWidth: false, boxMargin: 12, noteMargin: 12 },
    gantt: { useMaxWidth: false },
  };

  function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") || "porcelain";
  }

  function isDarkTheme(theme) {
    const manifest = window.PDY_THEME_MANIFEST;
    const manifestEntry = Array.isArray(manifest)
      ? manifest.find((entry) => entry.id === theme)
      : null;
    if (manifestEntry?.mode) {
      return manifestEntry.mode === "dark";
    }
    if (["lumina", "porcelain", "parchment"].includes(theme)) return false;
    if (DARK_THEME_IDS.has(theme) || theme.toLowerCase().includes("dark")) {
      return true;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  }

  function getMermaidConfig(theme) {
    const themesMap = window.PDY_MERMAID_THEMES || {};
    const fallbackTheme = isDarkTheme(theme) ? "obsidian" : "porcelain";
    const selectedConfig = themesMap[theme] ||
      themesMap[fallbackTheme] || {
        theme: isDarkTheme(theme) ? "dark" : "default",
        themeVariables: {},
      };

    return {
      ...MERMAID_DEFAULTS,
      ...selectedConfig,
      startOnLoad: false,
      htmlLabels: false,
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
      createButton("mermaid-btn btn-zoom-out", ICONS.zoomOut, "Zoom Out"),
      createButton("mermaid-btn btn-zoom-reset", ICONS.zoomReset, "Reset View"),
      createButton("mermaid-btn btn-zoom-in", ICONS.zoomIn, "Zoom In"),
      createButton("mermaid-btn btn-maximize", ICONS.maximize, "Toggle Fullscreen"),
      createButton("mermaid-btn btn-rotate", ICONS.rotate, "Rotate Landscape"),
    );
    toolbar.append(title, actions);

    const viewport = document.createElement("div");
    viewport.className = "mermaid-viewport";
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute(
      "aria-label",
      "Diagram. Drag to pan; use arrow keys to move and plus or minus to zoom.",
    );
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
    if (values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
      return { width: values[2], height: values[3] };
    }
    return null;
  }

  function parseSvgLength(value) {
    const parsed = Number.parseFloat(value || "");
    return !value?.includes("%") && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function getSvgDimensions(svg) {
    const viewBox = parseViewBox(svg);
    return {
      width: viewBox?.width || parseSvgLength(svg.getAttribute("width")) || 800,
      height: viewBox?.height || parseSvgLength(svg.getAttribute("height")) || 600,
    };
  }

  function getSvgBounds(svg, dimensions) {
    try {
      const bounds = svg.getBBox();
      const viewBox = svg.viewBox.baseVal;
      if (bounds.width > 0 && bounds.height > 0 && viewBox.width > 0 && viewBox.height > 0) {
        return {
          x: bounds.x - viewBox.x,
          y: bounds.y - viewBox.y,
          width: bounds.width,
          height: bounds.height,
        };
      }
    } catch (_error) {
      // A hidden or unsupported SVG still has its declared dimensions.
    }
    return { x: 0, y: 0, ...dimensions };
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
      "color: var(--color-danger)",
      "padding: 1.5rem",
      "font-family: var(--font-mono), monospace",
      "font-size: var(--scale-code-inline, 0.87em)",
      "font-weight: var(--mono-font-weight, 420)",
      "letter-spacing: var(--letter-spacing-mono, -0.01em)",
      "border-left: 4px solid var(--color-danger)",
      "background: var(--color-code-bg)",
      "text-align: left",
      "width: 100%",
      "box-sizing: border-box",
    ].join(";");

    const heading = document.createElement("strong");
    heading.textContent = "Mermaid Error:";
    heading.style.fontWeight = "var(--mono-emphasis-font-weight, 520)";
    const details = document.createElement("pre");
    details.style.cssText = [
      "border: none",
      "margin: 0",
      "padding: 0.5rem 0",
      "color: var(--color-danger)",
      "background: transparent",
      "font-family: var(--font-mono), monospace",
      "font-size: 1em",
      "font-weight: var(--mono-font-weight, 420)",
      "letter-spacing: var(--letter-spacing-mono, -0.01em)",
      "text-align: left",
      "white-space: pre-wrap",
    ].join(";");
    details.textContent = getErrorMessage(error);
    box.append(heading, details);
    return box;
  }

  function getPointerMidpoint(first, second) {
    return {
      clientX: (first.clientX + second.clientX) / 2,
      clientY: (first.clientY + second.clientY) / 2,
    };
  }

  function getWheelDelta(event, height) {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    return { x: event.deltaX * unit, y: event.deltaY * unit };
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
      this.diagramBounds = { x: 0, y: 0, width: 800, height: 600 };
      this.scale = 1;
      this.x = 0;
      this.y = 0;
      this.viewSize = null;
      this.isFitted = true;
      this.inlineView = null;
      this.dragStart = null;
      this.pinchStart = null;
      this.isDragging = false;
      this.hasDiagram = false;
      this.transformFrame = 0;
      this.resetTimer = 0;
      this.modalTimer = 0;
      this.modalFrame = 0;
      this.modalBackdrop = null;
      this.modalAbortController = null;
      this.renderToken = 0;
      this.resizeObserver = null;
      this.bindControls();
      this.bindGestures();
      this.observeViewport();
    }

    isRotated() {
      return (
        this.container.classList.contains("rotated-landscape") &&
        window.matchMedia(PHONE_MEDIA_QUERY).matches
      );
    }

    getViewportSize() {
      return { width: this.viewport.clientWidth, height: this.viewport.clientHeight };
    }

    mapClientPoint(clientX, clientY) {
      // clientWidth/Height are untransformed. The bounding rectangle includes
      // modal animation and the mobile rotation, so undo both here.
      const rectangle = this.viewport.getBoundingClientRect();
      const size = this.getViewportSize();
      if (!rectangle.width || !rectangle.height) return { x: 0, y: 0 };
      const x = (clientX - rectangle.left) / rectangle.width;
      const y = (clientY - rectangle.top) / rectangle.height;
      return this.isRotated()
        ? { x: y * size.width, y: (1 - x) * size.height }
        : { x: x * size.width, y: y * size.height };
    }

    getFitScale(size) {
      return Math.max(
        Number.EPSILON,
        Math.min(
          Math.max(1, size.width - VIEW_PADDING * 2) / this.diagramWidth,
          Math.max(1, size.height - VIEW_PADDING * 2) / this.diagramHeight,
          1,
        ),
      );
    }

    captureView() {
      if (!this.hasDiagram || !this.viewSize) return { fitted: true };
      const { width, height } = this.viewSize;
      return {
        fitted: this.isFitted,
        zoom: this.scale / this.getFitScale(this.viewSize),
        centerX: (width / 2 - this.x) / (this.scale * this.diagramWidth),
        centerY: (height / 2 - this.y) / (this.scale * this.diagramHeight),
      };
    }

    restoreView(view) {
      const size = this.getViewportSize();
      if (!this.hasDiagram || size.width <= 0 || size.height <= 0) return;
      this.viewSize = size;
      this.isFitted = view.fitted;
      const fit = this.getFitScale(size);
      this.scale = view.fitted ? fit : clamp(fit * view.zoom, fit * 0.25, MAX_SCALE);
      this.x = size.width / 2 - this.diagramWidth * this.scale * (view.fitted ? 0.5 : view.centerX);
      this.y =
        size.height / 2 - this.diagramHeight * this.scale * (view.fitted ? 0.5 : view.centerY);
      this.scheduleTransform();
    }

    updateLayout() {
      const size = this.getViewportSize();
      if (size.width === this.viewSize?.width && size.height === this.viewSize?.height) return;
      this.clearPointers();
      this.restoreView(this.captureView());
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
      if (this.hasDiagram && this.viewSize) {
        // Keep graphics visible, including SVGs with large viewBox padding.
        const bounds = this.diagramBounds;
        const visible = Math.min(
          VIEW_PADDING,
          bounds.width * this.scale,
          bounds.height * this.scale,
        );
        this.x = clamp(
          this.x,
          visible - (bounds.x + bounds.width) * this.scale,
          this.viewSize.width - visible - bounds.x * this.scale,
        );
        this.y = clamp(
          this.y,
          visible - (bounds.y + bounds.height) * this.scale,
          this.viewSize.height - visible - bounds.y * this.scale,
        );
        // Resize the SVG's native viewport so text and paths are painted at
        // the requested resolution. CSS scaling a composited layer blurs it.
        this.content.style.width = `${this.diagramWidth * this.scale}px`;
        this.content.style.height = `${this.diagramHeight * this.scale}px`;
      }
      this.content.style.transform = `translate(${this.x}px, ${this.y}px)`;
    }

    zoomAtPoint(pointX, pointY, factor) {
      if (!this.hasDiagram || !Number.isFinite(factor) || factor <= 0) {
        return;
      }
      const nextScale = clamp(
        this.scale * factor,
        this.getFitScale(this.getViewportSize()) * 0.25,
        MAX_SCALE,
      );
      const diagramX = (pointX - this.x) / this.scale;
      const diagramY = (pointY - this.y) / this.scale;
      this.x = pointX - diagramX * nextScale;
      this.y = pointY - diagramY * nextScale;
      this.scale = nextScale;
      this.isFitted = false;
      this.scheduleTransform();
    }

    zoomAtCenter(factor) {
      const size = this.getViewportSize();
      this.zoomAtPoint(size.width / 2, size.height / 2, factor);
    }

    resetView() {
      this.clearPointers();
      this.restoreView({ fitted: true });
    }

    queueLayout(delay = 0) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = window.setTimeout(() => this.updateLayout(), delay);
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
      this.viewport.addEventListener("keydown", (event) => this.handleKey(event), { signal });
      window.addEventListener("blur", () => this.clearPointers(), { signal });
      window.addEventListener("resize", () => this.queueLayout(50), {
        passive: true,
        signal,
      });
    }

    observeViewport() {
      if (!("ResizeObserver" in window)) {
        return;
      }
      this.resizeObserver = new ResizeObserver(() => {
        if (this.hasDiagram) {
          const resetDelay = this.container.classList.contains("maximized")
            ? MODAL_TRANSITION_MS
            : 50;
          this.queueLayout(resetDelay);
        }
      });
      this.resizeObserver.observe(this.viewport);
    }

    handlePointerDown(event) {
      if (!this.hasDiagram || event.target.closest?.("a,button")) {
        return;
      }
      // Embedded diagrams retain one-finger page scrolling. Touch interaction
      // belongs to the expanded viewer, whose viewport has touch-action: none.
      if (!this.acceptsPointer(event)) return;
      event.preventDefault();
      this.viewport.focus({ preventScroll: true });
      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      try {
        this.viewport.setPointerCapture(event.pointerId);
      } catch (error) {
        console.debug("Pointer capture was unavailable", error);
      }

      this.startGesture();
    }

    acceptsPointer(event) {
      return event.pointerType === "mouse"
        ? event.button === 0
        : this.container.classList.contains("maximized");
    }

    startGesture() {
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
        point: this.mapClientPoint(pointer.clientX, pointer.clientY),
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
      const point = this.mapClientPoint(pointer.clientX, pointer.clientY);
      this.x = start.x + point.x - start.point.x;
      this.y = start.y + point.y - start.point.y;
      this.isFitted = false;
      this.scheduleTransform();
    }

    startPinch() {
      const [first, second] = [...this.activePointers.values()];
      if (!first || !second) {
        return;
      }
      const midpoint = getPointerMidpoint(first, second);
      const localPoint = this.mapClientPoint(midpoint.clientX, midpoint.clientY);
      this.pinchStart = {
        distance: this.getPointerDistance(first, second),
        scale: this.scale,
        diagramX: (localPoint.x - this.x) / this.scale,
        diagramY: (localPoint.y - this.y) / this.scale,
      };
      this.stopDragging();
    }

    getPointerDistance(first, second) {
      const a = this.mapClientPoint(first.clientX, first.clientY);
      const b = this.mapClientPoint(second.clientX, second.clientY);
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    updatePinch() {
      const [first, second] = [...this.activePointers.values()];
      const start = this.pinchStart;
      if (!first || !second || !start || start.distance <= 0) {
        return;
      }
      const distance = this.getPointerDistance(first, second);
      const midpoint = getPointerMidpoint(first, second);
      const localPoint = this.mapClientPoint(midpoint.clientX, midpoint.clientY);
      this.scale = clamp(
        start.scale * (distance / start.distance),
        this.getFitScale(this.getViewportSize()) * 0.25,
        MAX_SCALE,
      );
      this.x = localPoint.x - start.diagramX * this.scale;
      this.y = localPoint.y - start.diagramY * this.scale;
      this.isFitted = false;
      this.scheduleTransform();
    }

    stopDragging() {
      this.dragStart = null;
      this.isDragging = false;
      this.viewport.style.cursor = "";
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
      } else this.startGesture();
    }

    clearPointers() {
      const pointerIds = [...this.activePointers.keys()];
      this.activePointers.clear();
      for (const pointerId of pointerIds) {
        this.releasePointer(pointerId);
      }
      this.stopDragging();
      this.pinchStart = null;
    }

    handleWheel(event) {
      const zoom = event.ctrlKey || event.metaKey;
      if (!this.hasDiagram || (!zoom && !this.container.classList.contains("maximized"))) {
        return;
      }
      event.preventDefault();
      const delta = getWheelDelta(event, this.getViewportSize().height);
      if (zoom) {
        const point = this.mapClientPoint(event.clientX, event.clientY);
        this.zoomAtPoint(point.x, point.y, Math.exp(-clamp(delta.y, -120, 120) * 0.01));
      } else {
        const point = this.mapClientPoint(event.clientX, event.clientY);
        const moved = this.mapClientPoint(event.clientX - delta.x, event.clientY - delta.y);
        this.x += moved.x - point.x;
        this.y += moved.y - point.y;
        this.isFitted = false;
        this.scheduleTransform();
      }
    }

    handleKey(event) {
      if (
        !this.hasDiagram ||
        event.target !== this.viewport ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const move = {
        ArrowLeft: [40, 0],
        ArrowRight: [-40, 0],
        ArrowUp: [0, 40],
        ArrowDown: [0, -40],
      }[event.key];
      if (move) {
        const [x, y] = move;
        this.x += this.isRotated() ? y : x;
        this.y += this.isRotated() ? -x : y;
        this.isFitted = false;
        this.scheduleTransform();
      } else if (!this.handleZoomKey(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    handleZoomKey(key) {
      if (["+", "="].includes(key)) this.zoomAtCenter(1.25);
      else if (key === "-") this.zoomAtCenter(0.8);
      else if (key === "0" || key === "Home") this.resetView();
      else return false;
      return true;
    }

    toggleRotation() {
      this.clearPointers();
      this.container.classList.toggle("rotated-landscape");
      this.updateLayout();
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
      this.inlineView = this.captureView();
      this.clearPointers();

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
      this.viewport.style.touchAction = "none";
      document.body.append(backdrop);
      this.setMaximizeButtonState(true);
      focusDialog(this.container, "Expanded diagram");
      updateScrollLock();
      this.modalFrame = requestFrame(() => {
        this.modalFrame = 0;
        this.container.classList.add("visible");
        backdrop.classList.add("visible");
      });
      this.resetView();
      this.queueLayout(MODAL_TRANSITION_MS);
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
      releaseDialog(this.container);
      this.clearPointers();
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
        this.viewport.style.touchAction = "";
        this.clearPointers();
        updateScrollLock();
        window.clearTimeout(this.resetTimer);
        this.restoreView(this.inlineView || { fitted: true });
        this.inlineView = null;
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
      setButtonTitle(this.maximizeButton, title);
      this.maximizeButton.setAttribute("aria-expanded", String(isMaximized));
    }

    async render(mermaid, code, version) {
      const token = ++this.renderToken;
      const id = `mermaid-svg-${++mermaidIdCounter}`;
      try {
        const { svg, bindFunctions } = await mermaid.render(id, code);
        if (
          token !== this.renderToken ||
          version !== renderVersion ||
          !this.container.isConnected
        ) {
          return;
        }
        const view = this.captureView();
        this.content.innerHTML = svg;
        const renderedSvg = this.content.querySelector("svg");
        if (!renderedSvg) {
          throw new Error("Mermaid did not return an SVG diagram.");
        }

        const dimensions = getSvgDimensions(renderedSvg);
        this.diagramBounds = getSvgBounds(renderedSvg, dimensions);
        this.diagramWidth = dimensions.width;
        this.diagramHeight = dimensions.height;
        this.hasDiagram = true;
        this.content.style.width = `${this.diagramWidth}px`;
        this.content.style.height = `${this.diagramHeight}px`;
        renderedSvg.setAttribute("width", "100%");
        renderedSvg.setAttribute("height", "100%");
        renderedSvg.style.maxWidth = "none";
        this.content.style.transformOrigin = "0 0";
        bindFunctions?.(this.content);
        this.setDiagramControls(true);
        this.restoreView(view);
      } catch (error) {
        document.querySelectorAll(`#d${id}, #${id}`).forEach((el) => {
          el.remove();
        });
        if (token === this.renderToken && version === renderVersion) {
          this.showRenderError(error);
        }
        console.error("Failed to render Mermaid diagram", error);
      }
    }

    showRenderError(error) {
      this.clearPointers();
      this.setDiagramControls(false);
      this.hasDiagram = false;
      this.x = 0;
      this.y = 0;
      this.scale = 1;
      if (this.transformFrame) {
        cancelFrame(this.transformFrame);
        this.transformFrame = 0;
      }
      this.content.style.width = "100%";
      this.content.style.height = "auto";
      this.content.style.transform = "none";
      const message = createRenderError(error);
      const source = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Diagram source";
      const code = document.createElement("pre");
      code.textContent = this.container.dataset.mermaidCode || "";
      source.append(summary, code);
      message.append(source);
      this.content.replaceChildren(message);
    }

    setDiagramControls(enabled) {
      for (const button of [this.zoomInButton, this.zoomOutButton, this.resetButton])
        button.disabled = !enabled;
      this.viewport.classList.toggle("has-diagram", enabled);
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
    const target = document.querySelector("main") || document.body;
    lifecycleObserver = new MutationObserver(scheduleControllerCleanup);
    lifecycleObserver.observe(target, { childList: true, subtree: true });
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

  function showRenderErrors(diagramControllers, error) {
    console.error("Failed to initialize Mermaid", error);
    for (const controller of diagramControllers) controller.showRenderError(error);
  }

  async function loadDiagramFonts() {
    if (!document.fonts?.load) return;
    await Promise.all([
      document.fonts.load('14px "Geist Mono"'),
      document.fonts.load('14px "Noto Sans Sinhala"', "සිංහල"),
    ]).catch((error) => console.warn("Diagram fonts unavailable; using fallbacks", error));
    await document.fonts.ready;
  }

  async function renderControllers(theme, diagramControllers, version) {
    const mermaid = getMermaidAPI();
    if (!mermaid) return;

    try {
      await loadDiagramFonts();
      if (version !== renderVersion) return;
      mermaid.initialize(getMermaidConfig(theme));
    } catch (error) {
      showRenderErrors(diagramControllers, error);
      return;
    }

    for (const controller of diagramControllers) {
      if (version !== renderVersion) return;
      if (!controller.container.isConnected) continue;
      await controller.render(mermaid, controller.container.dataset.mermaidCode || "", version);
    }
  }

  function enqueueRender(theme, diagramControllers) {
    const version = ++renderVersion;
    const operation = () => {
      if (version !== renderVersion || !diagramControllers.length) return;
      return renderControllers(theme, diagramControllers, version);
    };
    const result = renderQueue.then(operation, operation);
    // A failed render must not poison later theme changes; callers report its error.
    renderQueue = result.catch(() => undefined);
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
    if (newControllers.length) await enqueueRender(getCurrentTheme(), [...controllers]);
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

  return { init: initMermaid, updateTheme: updateMermaidTheme };
})();
