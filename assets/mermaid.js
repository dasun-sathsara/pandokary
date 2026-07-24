// Disable Mermaid's built-in auto-init immediately, before DOMContentLoaded fires.
// Without this, Mermaid's default startOnLoad:true races our own render pipeline
// in initMermaid() and replaces pre.mermaid blocks before we read their code text.
if (window.mermaid) {
  try {
    mermaid.initialize({ startOnLoad: false });
  } catch (error) {
    console.error("Failed to disable Mermaid auto-init", error);
  }
}

const MERMAID_DEFAULTS = {
  startOnLoad: false,
  look: "handDrawn",
  fontFamily: "'Architects Daughter', cursive, sans-serif",
  flowchart: { useMaxWidth: false, htmlLabels: true },
  sequence: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
};

const MERMAID_THEMES = {
  light: {
    theme: "default",
    themeVariables: {},
  },
  "github-light": {
    theme: "base",
    themeVariables: {
      darkMode: false,
      background: "#ffffff",
      mainBkg: "#ddf4ff",
      secondBkg: "#f6f8fa",
      tertiaryColor: "#eaeef2",
      primaryColor: "#ddf4ff",
      primaryTextColor: "#1f2328",
      primaryBorderColor: "#0969da",
      secondaryColor: "#f6f8fa",
      secondaryTextColor: "#1f2328",
      secondaryBorderColor: "#d0d7de",
      lineColor: "#57606a",
      textColor: "#1f2328",
      nodeBorder: "#0969da",
      clusterBkg: "#f6f8fa",
      clusterBorder: "#d0d7de",
      edgeLabelBackground: "#ffffff",
      noteBkgColor: "#fff8c5",
      noteTextColor: "#1f2328",
      noteBorderColor: "#d4a72c",
      actorBkg: "#ddf4ff",
      actorBorder: "#0969da",
      actorTextColor: "#1f2328",
      actorLineColor: "#57606a",
      signalColor: "#1f2328",
      signalTextColor: "#1f2328",
      labelBoxBkgColor: "#f6f8fa",
      labelBoxBorderColor: "#d0d7de",
      labelTextColor: "#1f2328",
    },
  },
  "warm-light": {
    theme: "base",
    themeVariables: {
      darkMode: false,
      background: "#faf5ec",
      mainBkg: "#fffdf8",
      secondBkg: "#f2eadd",
      tertiaryColor: "#f3ecdf",
      primaryColor: "#fffdf8",
      primaryTextColor: "#3d3730",
      primaryBorderColor: "rgba(182, 93, 60, 0.45)",
      secondaryColor: "#f2eadd",
      secondaryTextColor: "#3d3730",
      secondaryBorderColor: "rgba(61, 50, 38, 0.22)",
      lineColor: "rgba(61, 50, 38, 0.42)",
      textColor: "#3d3730",
      nodeBorder: "rgba(182, 93, 60, 0.45)",
      clusterBkg: "rgba(182, 93, 60, 0.045)",
      clusterBorder: "rgba(61, 50, 38, 0.18)",
      edgeLabelBackground: "#fffdf8",
      noteBkgColor: "rgba(182, 93, 60, 0.105)",
      noteTextColor: "#2a2520",
      noteBorderColor: "rgba(182, 93, 60, 0.32)",
      actorBkg: "#fffdf8",
      actorBorder: "rgba(182, 93, 60, 0.45)",
      actorTextColor: "#3d3730",
      actorLineColor: "rgba(61, 50, 38, 0.34)",
      signalColor: "#b65d3c",
      signalTextColor: "#3d3730",
      labelBoxBkgColor: "#fffdf8",
      labelBoxBorderColor: "rgba(61, 50, 38, 0.18)",
      labelTextColor: "#3d3730",
    },
  },
  dark: {
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: "#0B0D12",
      primaryColor: "#14171F",
      primaryBorderColor: "#8B7DFF",
      primaryTextColor: "#E4E7EC",
      secondaryColor: "#1A1E27",
      secondaryBorderColor: "rgba(255,255,255,0.08)",
      secondaryTextColor: "#E4E7EC",
      tertiaryColor: "#12151C",
      tertiaryBorderColor: "rgba(255,255,255,0.06)",
      lineColor: "#8A92A6",
      edgeLabelBackground: "#14171F",
      textColor: "#E4E7EC",
      noteBkgColor: "rgba(139,125,255,0.12)",
      noteBorderColor: "#8B7DFF",
      noteTextColor: "#E4E7EC",
      clusterBkg: "#101319",
      clusterBorder: "rgba(255,255,255,0.08)",
      actorBkg: "#14171F",
      actorBorder: "#8B7DFF",
      activationBkgColor: "#1A1E27",
    },
  },
  "vscode-dark": {
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: "#1f1f1f",
      mainBkg: "#252526",
      secondBkg: "#2d2d2d",
      tertiaryColor: "#333333",
      primaryColor: "#264f78",
      primaryTextColor: "#d4d4d4",
      primaryBorderColor: "#0078d4",
      secondaryColor: "#252526",
      secondaryTextColor: "#d4d4d4",
      secondaryBorderColor: "#3c3c3c",
      lineColor: "#858585",
      textColor: "#d4d4d4",
      nodeBorder: "#0078d4",
      clusterBkg: "#252526",
      clusterBorder: "#3c3c3c",
      edgeLabelBackground: "#1f1f1f",
      noteBkgColor: "#3a3d41",
      noteTextColor: "#d4d4d4",
      noteBorderColor: "#569cd6",
      actorBkg: "#264f78",
      actorBorder: "#0078d4",
      actorTextColor: "#d4d4d4",
      actorLineColor: "#858585",
      signalColor: "#d4d4d4",
      signalTextColor: "#d4d4d4",
      labelBoxBkgColor: "#252526",
      labelBoxBorderColor: "#3c3c3c",
      labelTextColor: "#d4d4d4",
    },
  },
  "ayu-dark": {
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: "#0b0e14",
      mainBkg: "#11151d",
      secondBkg: "#171b24",
      tertiaryColor: "#0d1017",
      primaryColor: "#11151d",
      primaryTextColor: "#d9d7ce",
      primaryBorderColor: "rgba(255, 180, 84, 0.45)",
      secondaryColor: "#171b24",
      secondaryTextColor: "#d9d7ce",
      secondaryBorderColor: "rgba(191, 161, 111, 0.22)",
      lineColor: "rgba(191, 161, 111, 0.42)",
      textColor: "#d9d7ce",
      nodeBorder: "rgba(255, 180, 84, 0.45)",
      clusterBkg: "rgba(255, 180, 84, 0.045)",
      clusterBorder: "rgba(191, 161, 111, 0.18)",
      edgeLabelBackground: "#141821",
      noteBkgColor: "rgba(255, 180, 84, 0.105)",
      noteTextColor: "#f3ead3",
      noteBorderColor: "rgba(255, 180, 84, 0.32)",
      actorBkg: "#11151d",
      actorBorder: "rgba(255, 180, 84, 0.45)",
      actorTextColor: "#d9d7ce",
      actorLineColor: "rgba(191, 161, 111, 0.34)",
      signalColor: "#bfa16f",
      signalTextColor: "#d9d7ce",
      labelBoxBkgColor: "#11151d",
      labelBoxBorderColor: "rgba(191, 161, 111, 0.18)",
      labelTextColor: "#d9d7ce",
    },
  },
};

function getMermaidConfig(theme) {
  const selectedTheme = MERMAID_THEMES[theme] ? theme : "dark";
  const selectedConfig = MERMAID_THEMES[selectedTheme];
  return {
    ...MERMAID_DEFAULTS,
    theme: selectedConfig.theme,
    themeVariables: {
      ...selectedConfig.themeVariables,
      fontFamily: MERMAID_DEFAULTS.fontFamily,
    },
  };
}

function initializeMermaid(theme) {
  window.mermaid.initialize(getMermaidConfig(theme));
}
let mermaidIdCounter = 0;

// biome-ignore lint/correctness/noUnusedVariables: called from app.js as a global entry point.
async function initMermaid() {
  if (!window.mermaid) {
    console.warn("Mermaid library is not loaded; skipping diagram rendering.");
    return;
  }

  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  initializeMermaid(currentTheme);

  const blocks = document.querySelectorAll("pre.mermaid");
  for (const block of blocks) {
    const code = block.querySelector("code").textContent.trim();

    const container = document.createElement("div");
    container.className = "mermaid-container";
    container.dataset.mermaidCode = code;

    const toolbar = document.createElement("div");
    toolbar.className = "mermaid-toolbar";
    const title = document.createElement("span");
    title.className = "mermaid-title";
    title.innerText = "✏️ Sketch Diagram";

    const actions = document.createElement("div");
    actions.className = "mermaid-actions";

    const zoomOutBtn = createButton("mermaid-btn btn-zoom-out", "➖", "Zoom Out");
    const resetBtn = createButton("mermaid-btn btn-zoom-reset", "↺", "Reset View");
    const zoomInBtn = createButton("mermaid-btn btn-zoom-in", "➕", "Zoom In");
    const maximizeBtn = createButton("mermaid-btn btn-maximize", "🔍", "Toggle Fullscreen");
    const rotateBtn = createButton("mermaid-btn btn-rotate", "🔄", "Rotate Landscape");

    actions.append(zoomOutBtn, resetBtn, zoomInBtn, maximizeBtn, rotateBtn);

    toolbar.appendChild(title);
    toolbar.appendChild(actions);

    const viewport = document.createElement("div");
    viewport.className = "mermaid-viewport";

    const content = document.createElement("div");
    content.className = "mermaid-content";

    viewport.appendChild(content);
    container.appendChild(toolbar);
    container.appendChild(viewport);

    block.replaceWith(container);

    await setupInteractiveDiagram(
      container,
      content,
      viewport,
      code,
      zoomInBtn,
      zoomOutBtn,
      resetBtn,
      maximizeBtn,
      rotateBtn,
    );
  }
}

// biome-ignore lint/correctness/noUnusedVariables: called from app.js as a global entry point.
async function updateMermaidTheme() {
  if (!window.mermaid) return;

  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  initializeMermaid(currentTheme);

  const containers = document.querySelectorAll(".mermaid-container");
  for (const container of containers) {
    const code = container.dataset.mermaidCode;
    const content = container.querySelector(".mermaid-content");
    const viewport = container.querySelector(".mermaid-viewport");
    const zoomInBtn = container.querySelector(".btn-zoom-in");
    const zoomOutBtn = container.querySelector(".btn-zoom-out");
    const resetBtn = container.querySelector(".btn-zoom-reset");
    const maximizeBtn = container.querySelector(".btn-maximize");
    const rotateBtn = container.querySelector(".btn-rotate");

    await setupInteractiveDiagram(
      container,
      content,
      viewport,
      code,
      zoomInBtn,
      zoomOutBtn,
      resetBtn,
      maximizeBtn,
      rotateBtn,
    );
  }
}

async function setupInteractiveDiagram(
  container,
  content,
  viewport,
  code,
  zoomInBtn,
  zoomOutBtn,
  resetBtn,
  maximizeBtn,
  rotateBtn,
) {
  const id = `mermaid-svg-${++mermaidIdCounter}`;

  try {
    const { svg } = await mermaid.render(id, code);
    content.innerHTML = svg;

    const renderedSvg = content.querySelector("svg");
    if (!renderedSvg) return;

    renderedSvg.setAttribute("width", "100%");
    renderedSvg.setAttribute("height", "100%");
    renderedSvg.style.maxWidth = "none";

    // Adjust note rectangles in sequence diagrams to have comfortable padding and prevent text overflows
    renderedSvg.querySelectorAll("rect.note").forEach((rect) => {
      const parent = rect.parentElement;
      if (!parent) return;

      const texts = parent.querySelectorAll("text.noteText");
      if (texts.length === 0) return;

      let maxTextW = 0;
      texts.forEach((text) => {
        const textW = text.getBBox().width;
        if (textW > maxTextW) {
          maxTextW = textW;
        }
      });

      const rectW = parseFloat(rect.getAttribute("width"));
      const rectX = parseFloat(rect.getAttribute("x"));

      const padding = 50; // 25px on each side
      const neededW = maxTextW + padding;

      if (neededW > rectW) {
        rect.setAttribute("width", neededW);
        const diff = neededW - rectW;
        const newRectX = rectX - diff / 2;
        rect.setAttribute("x", newRectX);
      }
    });

    const viewBox = renderedSvg.getAttribute("viewBox");
    let svgW = 800;
    let svgH = 600;
    if (viewBox) {
      const parts = viewBox
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      if (parts.length === 4) {
        svgW = parts[2];
        svgH = parts[3];
      }
    }

    viewport.svgW = svgW;
    viewport.svgH = svgH;
    viewport.scale = 1;
    viewport.x = 0;
    viewport.y = 0;

    content.style.width = `${svgW}px`;
    content.style.height = `${svgH}px`;

    const updateTransform = () => {
      content.style.transform = `translate(${viewport.x}px, ${viewport.y}px)`;
      content.style.width = `${viewport.svgW * viewport.scale}px`;
      content.style.height = `${viewport.svgH * viewport.scale}px`;
    };

    const resetView = () => {
      const rect = viewport.getBoundingClientRect();
      const viewW = rect.width;
      const viewH = rect.height;
      if (viewW === 0 || viewH === 0) return;

      const scaleW = viewW / viewport.svgW;
      const scaleH = viewH / viewport.svgH;
      viewport.scale = Math.min(scaleW, scaleH) * 0.9;
      viewport.scale = Math.max(0.05, Math.min(15, viewport.scale));

      viewport.x = (viewW - viewport.svgW * viewport.scale) / 2;
      viewport.y = (viewH - viewport.svgH * viewport.scale) / 2;
      updateTransform();
    };

    const zoomAtPoint = (px, py, factor) => {
      const newScale = Math.max(0.05, Math.min(15, viewport.scale * factor));
      const cx = (px - viewport.x) / viewport.scale;
      const cy = (py - viewport.y) / viewport.scale;
      viewport.x = px - cx * newScale;
      viewport.y = py - cy * newScale;
      viewport.scale = newScale;
      updateTransform();
    };

    viewport.updateTransform = updateTransform;
    viewport.resetView = resetView;
    viewport.zoomAtPoint = zoomAtPoint;

    setTimeout(resetView, 50);

    const newZoomInBtn = zoomInBtn.cloneNode(true);
    zoomInBtn.replaceWith(newZoomInBtn);

    const newZoomOutBtn = zoomOutBtn.cloneNode(true);
    zoomOutBtn.replaceWith(newZoomOutBtn);

    const newResetBtn = resetBtn.cloneNode(true);
    resetBtn.replaceWith(newResetBtn);

    const newMaximizeBtn = maximizeBtn.cloneNode(true);
    maximizeBtn.replaceWith(newMaximizeBtn);

    const newRotateBtn = rotateBtn.cloneNode(true);
    rotateBtn.replaceWith(newRotateBtn);

    newZoomInBtn.addEventListener("click", () => {
      const isRotated = container.classList.contains("rotated-landscape");
      const rect = viewport.getBoundingClientRect();
      const px = isRotated ? rect.height / 2 : rect.width / 2;
      const py = isRotated ? rect.width / 2 : rect.height / 2;
      viewport.zoomAtPoint(px, py, 1.25);
    });

    newZoomOutBtn.addEventListener("click", () => {
      const isRotated = container.classList.contains("rotated-landscape");
      const rect = viewport.getBoundingClientRect();
      const px = isRotated ? rect.height / 2 : rect.width / 2;
      const py = isRotated ? rect.width / 2 : rect.height / 2;
      viewport.zoomAtPoint(px, py, 0.8);
    });

    newResetBtn.addEventListener("click", () => {
      viewport.resetView();
    });

    newMaximizeBtn.addEventListener("click", () => {
      if (!container.classList.contains("maximized")) {
        const backdrop = openModal(container);
        backdrop.addEventListener("click", () => newMaximizeBtn.click());
        newMaximizeBtn.innerText = "🚪";
        newMaximizeBtn.title = "Restore Normal View";
      } else {
        closeModal(container);
        newMaximizeBtn.innerText = "🔍";
        newMaximizeBtn.title = "Toggle Fullscreen";
      }
      setTimeout(viewport.resetView, 50);
    });

    newRotateBtn.addEventListener("click", () => {
      container.classList.toggle("rotated-landscape");
      setTimeout(viewport.resetView, 50);
    });

    if (!viewport.dataset.hasObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (typeof viewport.resetView === "function") {
          viewport.resetView();
        }
      });
      resizeObserver.observe(viewport);
      viewport.dataset.hasObserver = "true";
    }

    if (!viewport.dataset.hasListeners) {
      const activePointers = new Map();
      let isDragging = false;
      let initialPointerDist = 0;
      let initialPointerScale = 1;

      viewport.style.touchAction = "none";

      viewport.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".mermaid-btn")) return;

        const rect = viewport.getBoundingClientRect();
        viewport.cachedRect = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };

        activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        viewport.setPointerCapture(e.pointerId);

        if (activePointers.size === 1) {
          isDragging = true;
          viewport.startTouchX = e.clientX;
          viewport.startTouchY = e.clientY;
          viewport.startXVal = viewport.x;
          viewport.startYVal = viewport.y;
          viewport.style.cursor = "grabbing";
        } else if (activePointers.size === 2) {
          isDragging = false;
          const pts = Array.from(activePointers.values());
          const dx = pts[0].clientX - pts[1].clientX;
          const dy = pts[0].clientY - pts[1].clientY;
          initialPointerDist = Math.sqrt(dx * dx + dy * dy);
          initialPointerScale = viewport.scale;
        }
      });

      viewport.addEventListener("pointermove", (e) => {
        if (!activePointers.has(e.pointerId)) return;

        const pt = activePointers.get(e.pointerId);
        pt.clientX = e.clientX;
        pt.clientY = e.clientY;

        const isRotated = container.classList.contains("rotated-landscape");

        if (activePointers.size === 1 && isDragging) {
          const dx = e.clientX - viewport.startTouchX;
          const dy = e.clientY - viewport.startTouchY;
          if (isRotated) {
            viewport.x = viewport.startXVal + dy;
            viewport.y = viewport.startYVal - dx;
          } else {
            viewport.x = viewport.startXVal + dx;
            viewport.y = viewport.startYVal + dy;
          }
          viewport.updateTransform();
        } else if (activePointers.size === 2) {
          const pts = Array.from(activePointers.values());
          const dx = pts[0].clientX - pts[1].clientX;
          const dy = pts[0].clientY - pts[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (initialPointerDist > 0) {
            const factor = dist / initialPointerDist;
            const rect = viewport.cachedRect || viewport.getBoundingClientRect();

            let px, py;
            if (isRotated) {
              const sx = (pts[0].clientX + pts[1].clientX) / 2 - rect.left;
              const sy = (pts[0].clientY + pts[1].clientY) / 2 - rect.top;
              const cx = sx - rect.width / 2;
              const cy = sy - rect.height / 2;
              px = cy + rect.height / 2;
              py = -cx + rect.width / 2;
            } else {
              px = (pts[0].clientX + pts[1].clientX) / 2 - rect.left;
              py = (pts[0].clientY + pts[1].clientY) / 2 - rect.top;
            }

            viewport.zoomAtPoint(px, py, factor / (viewport.scale / initialPointerScale));
          }
        }
      });

      const handlePointerUp = (e) => {
        if (activePointers.has(e.pointerId)) {
          activePointers.delete(e.pointerId);
          viewport.releasePointerCapture(e.pointerId);
        }
        if (activePointers.size < 1) {
          isDragging = false;
          viewport.style.cursor = "grab";
          viewport.cachedRect = null;
        } else if (activePointers.size === 1) {
          isDragging = true;
          const remaining = Array.from(activePointers.values())[0];
          viewport.startTouchX = remaining.clientX;
          viewport.startTouchY = remaining.clientY;
          viewport.startXVal = viewport.x;
          viewport.startYVal = viewport.y;
        }
      };

      viewport.addEventListener("pointerup", handlePointerUp);
      viewport.addEventListener("pointercancel", handlePointerUp);

      viewport.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();

          if (!viewport.cachedRect) {
            const rect = viewport.getBoundingClientRect();
            viewport.cachedRect = {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            };
          }
          const rect = viewport.cachedRect;

          const isRotated = container.classList.contains("rotated-landscape");
          let px, py;
          if (isRotated) {
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const cx = sx - rect.width / 2;
            const cy = sy - rect.height / 2;
            px = cy + rect.height / 2;
            py = -cx + rect.width / 2;
          } else {
            px = e.clientX - rect.left;
            py = e.clientY - rect.top;
          }

          const factor = Math.exp(-e.deltaY * 0.0015);
          viewport.zoomAtPoint(px, py, factor);

          clearTimeout(viewport.wheelTimeout);
          viewport.wheelTimeout = setTimeout(() => {
            viewport.cachedRect = null;
          }, 300);
        },
        { passive: false },
      );

      viewport.dataset.hasListeners = "true";
    }
  } catch (err) {
    console.error("Failed to render mermaid diagram: ", err);
    content.innerHTML = `
      <div style="color: #ef4444; padding: 1.5rem; font-family: var(--font-mono), monospace; border-left: 4px solid #ef4444; background: var(--color-code-bg); text-align: left;">
        <strong>Mermaid Error:</strong>
        <pre style="border: none; margin: 0; padding: 0.5rem 0; color: #ef4444; background: transparent; font-size: 14px; text-align: left;">${err.message || err}</pre>
      </div>
    `;
  }
}
