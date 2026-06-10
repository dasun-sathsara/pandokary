if (window.mermaid) {
  try {
    mermaid.initialize({ startOnLoad: false });
  } catch (e) {
    console.error("Failed to initialize Mermaid with startOnLoad: false", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Load custom fonts
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load("12px 'Architects Daughter'"),
        document.fonts.load("12px 'Google Sans Flex'")
      ]);
      await document.fonts.ready;
    } catch (e) {
      console.warn("Font loading failed, proceeding anyway:", e);
    }
  }

  // 2. Syntax highlighting and lines numbering
  document.querySelectorAll("pre:not(.mermaid) code").forEach((block) => {
    const rawSource = block.textContent;
    block.textContent = rawSource;

    const classList = Array.from(block.classList);
    const existingLanguage = classList.find((cls) => cls.startsWith("language-"));
    if (!existingLanguage) {
      const pandocLanguage = classList.find((cls) => !["sourceCode", "code", "hljs"].includes(cls));
      if (pandocLanguage) {
        block.classList.add(`language-${pandocLanguage.toLowerCase()}`);
      }
    }

    if (!block.classList.contains("hljs")) {
      block.classList.add("hljs");
    }

    if (window.hljs && typeof hljs.highlightElement === "function") {
      hljs.highlightElement(block);

      const lines = block.innerHTML.split(/\r?\n/);
      if (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
      }

      if (lines.length >= 3) {
        block.innerHTML = lines.map(line => `<span class="code-line">${line || " "}</span>`).join("");

        block.addEventListener("click", (e) => {
          const line = e.target.closest(".code-line");
          if (!line) return;

          const rect = line.getBoundingClientRect();
          const clickX = e.clientX - rect.left;

          if (clickX < 55) {
            line.classList.toggle("focused-line");
          }
        });
      }

      const lineThreshold = 15;
      if (lines.length > lineThreshold) {
        const pre = block.parentNode;
        pre.classList.add("collapsible-code-block");

        const toggleContainer = document.createElement("div");
        toggleContainer.className = "code-toggle-container";

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "code-toggle-btn";
        toggleBtn.innerText = "Show More";

        toggleContainer.appendChild(toggleBtn);
        pre.parentNode.insertBefore(toggleContainer, pre.nextSibling);

        toggleBtn.addEventListener("click", () => {
          pre.classList.toggle("expanded");
          if (pre.classList.contains("expanded")) {
            toggleBtn.innerText = "Show Less";
          } else {
            toggleBtn.innerText = "Show More";
            pre.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      }
    } else {
      console.warn("Highlight.js is unavailable; skipping highlight pass.");
    }
  });

  // 3. Copy buttons
  document.querySelectorAll("pre:not(.mermaid) > code").forEach((block) => {
    const button = document.createElement("button");
    button.className = "copy-btn";
    button.innerText = "Copy";
    block.parentNode.appendChild(button);

    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(block.innerText);
        button.innerText = "Copied!";
        button.classList.add("success");
        setTimeout(() => {
          button.innerText = "Copy";
          button.classList.remove("success");
        }, 2000);
      } catch (err) {
        console.error("Failed to copy code: ", err);
        button.innerText = "Error";
        setTimeout(() => {
          button.innerText = "Copy";
        }, 2000);
      }
    });
  });

  // 4. Responsive Tables and scroll shadows
  document.querySelectorAll("table").forEach((table) => {
    const container = document.createElement("div");
    container.className = "table-scroll-container";

    const toolbar = document.createElement("div");
    toolbar.className = "table-toolbar";

    const title = document.createElement("span");
    title.className = "table-title";
    title.innerText = "📊 Data Table";

    const actions = document.createElement("div");
    actions.className = "table-actions";

    const maximizeBtn = document.createElement("button");
    maximizeBtn.className = "table-btn btn-maximize";
    maximizeBtn.innerText = "🔍";
    maximizeBtn.title = "Toggle Fullscreen";

    const rotateBtn = document.createElement("button");
    rotateBtn.className = "table-btn btn-rotate";
    rotateBtn.innerText = "🔄";
    rotateBtn.title = "Rotate Landscape";

    actions.appendChild(maximizeBtn);
    actions.appendChild(rotateBtn);
    toolbar.appendChild(title);
    toolbar.appendChild(actions);

    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";

    const shadowLeft = document.createElement("div");
    shadowLeft.className = "scroll-shadow left";

    const shadowRight = document.createElement("div");
    shadowRight.className = "scroll-shadow right";

    table.parentNode.insertBefore(container, table);
    container.appendChild(toolbar);
    container.appendChild(wrapper);
    wrapper.appendChild(table);
    container.appendChild(shadowLeft);
    container.appendChild(shadowRight);

    maximizeBtn.addEventListener("click", () => {
      if (!container.classList.contains("maximized")) {
        container.classList.add("maximized");
        maximizeBtn.innerText = "🚪";
        maximizeBtn.title = "Restore Normal View";
        document.body.style.overflow = "hidden";

        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => {
          maximizeBtn.click();
        });

        setTimeout(() => {
          container.classList.add("visible");
          backdrop.classList.add("visible");
        }, 10);
      } else {
        container.classList.remove("visible");
        const backdrop = document.querySelector(".modal-backdrop");
        if (backdrop) {
          backdrop.classList.remove("visible");
        }

        setTimeout(() => {
          container.classList.remove("maximized");
          container.classList.remove("rotated-landscape");
          if (backdrop) backdrop.remove();
          document.body.style.overflow = "";
          maximizeBtn.innerText = "🔍";
          maximizeBtn.title = "Toggle Fullscreen";
          updateShadows();
        }, 350);
      }
      setTimeout(updateShadows, 50);
    });

    rotateBtn.addEventListener("click", () => {
      container.classList.toggle("rotated-landscape");
      setTimeout(updateShadows, 50);
    });

    const updateShadows = () => {
      const scrollLeft = wrapper.scrollLeft;
      const scrollWidth = wrapper.scrollWidth;
      const clientWidth = wrapper.clientWidth;

      if (scrollLeft > 2) {
        shadowLeft.style.opacity = "1";
      } else {
        shadowLeft.style.opacity = "0";
      }

      if (scrollLeft < scrollWidth - clientWidth - 2) {
        shadowRight.style.opacity = "1";
      } else {
        shadowRight.style.opacity = "0";
      }
    };

    wrapper.addEventListener("scroll", updateShadows);
    window.addEventListener("resize", updateShadows);
    setTimeout(updateShadows, 100);
  });

  // 5. Theme and Font Toggles
  const themeToggle = document.createElement("button");
  themeToggle.className = "floating-toggle theme-toggle";
  themeToggle.setAttribute("aria-label", "Toggle theme");
  document.body.appendChild(themeToggle);

  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  setHighlightTheme(currentTheme);
  updateThemeIcon(currentTheme);

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    let newTheme = "light";
    if (currentTheme === "light") {
      newTheme = "dark";
    } else if (currentTheme === "dark") {
      newTheme = "dark-tokyo";
    } else if (currentTheme === "dark-tokyo") {
      newTheme = "dark-dimmed";
    } else {
      newTheme = "light";
    }
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    setHighlightTheme(newTheme);
    updateThemeIcon(newTheme);
    if (typeof updateMermaidTheme === "function") {
      updateMermaidTheme();
    }
  });

  const fontToggle = document.createElement("button");
  fontToggle.className = "floating-toggle font-toggle";
  fontToggle.setAttribute("aria-label", "Cycle font");
  document.body.appendChild(fontToggle);

  const fontOptions = [
    {
      key: "studio-feixen",
      name: "Studio Feixen Sans",
      label: "Sf",
      body: "'Studio Feixen Sans TRIAL', 'Studio Feixen Sans', sans-serif",
      heading: "'Studio Feixen Sans TRIAL', 'Studio Feixen Sans', sans-serif",
    },
    {
      key: "studio-feixen-serif",
      name: "Studio Feixen Serif",
      label: "Sr",
      body: "'Studio Feixen Serif Trial', 'Studio Feixen Serif', serif",
      heading: "'Studio Feixen Serif Trial', 'Studio Feixen Serif', serif",
    },
    {
      key: "google-sans-flex",
      name: "Google Sans Flex",
      label: "Gf",
      body: "'Google Sans Flex', sans-serif",
      heading: "'Google Sans Flex', sans-serif",
      opticalSizing: "auto",
      variationSettings: '"slnt" 0, "wdth" 100, "GRAD" 0, "ROND" 0',
    },
    {
      key: "architects-daughter",
      name: "Architects Daughter",
      label: "Ad",
      body: "'Architects Daughter', cursive, sans-serif",
      heading: "'Architects Daughter', cursive, sans-serif",
    },
  ];

  let activeFontKey = localStorage.getItem("fontChoice") || fontOptions[0].key;
  applyFontPreference(activeFontKey);

  fontToggle.addEventListener("click", () => {
    const currentIndex = fontOptions.findIndex((option) => option.key === activeFontKey);
    const nextIndex = (currentIndex + 1) % fontOptions.length;
    applyFontPreference(fontOptions[nextIndex].key);
  });

  function applyFontPreference(key) {
    const font = fontOptions.find((option) => option.key === key) || fontOptions[0];
    activeFontKey = font.key;
    document.documentElement.setAttribute("data-font", font.key);
    document.documentElement.style.setProperty("--font-body", font.body);
    document.documentElement.style.setProperty("--font-heading", font.heading || font.body);
    document.documentElement.style.setProperty(
      "--font-optical-sizing",
      font.opticalSizing || "auto",
    );
    document.documentElement.style.setProperty(
      "--font-variation-settings",
      font.variationSettings || "normal",
    );

    fontToggle.textContent = font.label;
    fontToggle.title = `Font: ${font.name}`;
    fontToggle.setAttribute("aria-label", `Cycle font (current: ${font.name})`);
    localStorage.setItem("fontChoice", font.key);
  }

  function setHighlightTheme(theme) {
    const lightHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
    const darkHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css";
    const tokyoHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css";
    const dimmedHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css";

    let nextHref = lightHref;
    if (theme === "dark") {
      nextHref = darkHref;
    } else if (theme === "dark-tokyo") {
      nextHref = tokyoHref;
    } else if (theme === "dark-dimmed") {
      nextHref = dimmedHref;
    }

    let link = document.getElementById("hljs-theme");
    if (!link) {
      link = document.createElement("link");
      link.id = "hljs-theme";
      link.rel = "stylesheet";
      link.href = nextHref;
      document.head.appendChild(link);
      return;
    }

    if (link.tagName.toLowerCase() !== "link") {
      const replacement = document.createElement("link");
      replacement.id = "hljs-theme";
      replacement.rel = "stylesheet";
      replacement.href = nextHref;
      link.replaceWith(replacement);
      return;
    }

    link.href = nextHref;
  }

  function updateThemeIcon(theme) {
    if (theme === "light") {
      themeToggle.innerText = "🌙";
      themeToggle.title = "Switch to Dark Mode";
    } else if (theme === "dark") {
      themeToggle.innerText = "🌌";
      themeToggle.title = "Switch to Tokyo Night";
    } else if (theme === "dark-tokyo") {
      themeToggle.innerText = "🕶️";
      themeToggle.title = "Switch to Dark Dimmed";
    } else {
      themeToggle.innerText = "☀️";
      themeToggle.title = "Switch to Light Mode";
    }
  }

  // 6. MathJax & other items
  document.querySelectorAll(".mjx-svg, mjx-container, .MathJax").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // 7. Interactive Table of Contents (Option 1)
  const headings = document.querySelectorAll("main h2, main h3");
  if (headings.length > 0) {
    const tocSidebar = document.createElement("aside");
    tocSidebar.className = "toc-sidebar";

    const tocTitle = document.createElement("h3");
    tocTitle.className = "toc-sidebar-title";
    tocTitle.innerText = "Table of Contents";
    tocSidebar.appendChild(tocTitle);

    const tocList = document.createElement("ul");
    tocList.className = "toc-list";

    headings.forEach((heading) => {
      if (!heading.id) {
        heading.id = heading.textContent.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }

      const listItem = document.createElement("li");
      listItem.className = heading.tagName.toLowerCase() === "h2" ? "toc-item-h2" : "toc-item-h3";

      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.className = "toc-link";

      listItem.appendChild(link);
      tocList.appendChild(listItem);
    });

    tocSidebar.appendChild(tocList);
    document.body.appendChild(tocSidebar);

    const activeLinks = new Map();
    let lastActiveId = null;

    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -60% 0px",
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        const link = tocList.querySelector(`.toc-link[href="#${id}"]`);
        if (!link) return;

        if (entry.isIntersecting) {
          activeLinks.set(id, entry.boundingClientRect.top);
        } else {
          activeLinks.delete(id);
        }
      });

      let currentActiveId = null;
      let minTop = Infinity;
      activeLinks.forEach((top, id) => {
        if (top < minTop) {
          minTop = top;
          currentActiveId = id;
        }
      });

      if (currentActiveId && currentActiveId !== lastActiveId) {
        lastActiveId = currentActiveId;

        tocList.querySelectorAll(".toc-link").forEach((link) => {
          if (link.getAttribute("href") === `#${currentActiveId}`) {
            link.classList.add("active");
            const parentRect = tocSidebar.getBoundingClientRect();
            const linkRect = link.getBoundingClientRect();
            if (linkRect.top < parentRect.top || linkRect.bottom > parentRect.bottom) {
              link.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          } else {
            link.classList.remove("active");
          }
        });
      }
    }, observerOptions);

    headings.forEach((heading) => observer.observe(heading));

    const tocToggle = document.createElement("button");
    tocToggle.className = "floating-toggle toc-toggle";
    tocToggle.setAttribute("aria-label", "Toggle Table of Contents");

    let tocCollapsed = localStorage.getItem("tocCollapsed") === "true";
    if (tocCollapsed) {
      document.documentElement.classList.add("toc-collapsed");
      tocToggle.innerText = "📖";
      tocToggle.title = "Show Table of Contents";
    } else {
      tocToggle.innerText = "✖";
      tocToggle.title = "Hide Table of Contents";
    }
    document.body.appendChild(tocToggle);

    tocToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("toc-collapsed");
      const isCollapsed = document.documentElement.classList.contains("toc-collapsed");
      localStorage.setItem("tocCollapsed", isCollapsed);
      if (isCollapsed) {
        tocToggle.innerText = "📖";
        tocToggle.title = "Show Table of Contents";
      } else {
        tocToggle.innerText = "✖";
        tocToggle.title = "Hide Table of Contents";
      }
    });
  }

  // 8. Reading Progress & Estimator (Option 3)
  const progressBar = document.createElement("div");
  progressBar.className = "reading-progress";
  document.body.appendChild(progressBar);

  const updateProgress = () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    progressBar.style.width = scrolled + "%";
  };
  window.addEventListener("scroll", updateProgress);
  updateProgress();

  const mainContent = document.querySelector("main");
  if (mainContent) {
    const text = mainContent.innerText || "";
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const minRead = Math.ceil(words / 200);

    const header = document.querySelector("header");
    if (header) {
      const timeContainer = document.createElement("p");
      timeContainer.className = "reading-time";
      timeContainer.innerHTML = `⏱️ <strong>${minRead} min</strong> read`;
      timeContainer.style.fontSize = "0.85em";
      timeContainer.style.opacity = "0.75";
      timeContainer.style.marginTop = "0.5rem";
      header.appendChild(timeContainer);
    }
  }

  // 9. Smooth Image Lightbox Zoom (Option 5)
  document.querySelectorAll("main img").forEach((img) => {
    if (img.closest(".mermaid-container")) return;

    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      const backdrop = document.createElement("div");
      backdrop.className = "lightbox-backdrop";

      const zoomedImg = document.createElement("img");
      zoomedImg.className = "lightbox-img";
      zoomedImg.src = img.src;
      zoomedImg.alt = img.alt || "Zoomed image";

      backdrop.appendChild(zoomedImg);
      document.body.appendChild(backdrop);
      document.body.style.overflow = "hidden";

      setTimeout(() => {
        backdrop.classList.add("active");
      }, 10);

      const closeLightbox = () => {
        backdrop.classList.remove("active");
        setTimeout(() => {
          backdrop.remove();
          document.body.style.overflow = "";
        }, 300);
      };

      backdrop.addEventListener("click", closeLightbox);
      
      const escHandler = (e) => {
        if (e.key === "Escape") {
          closeLightbox();
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);
    });
  });

  // 10. Load and Render Mermaid Diagrams
  try {
    await initMermaid();
  } catch (e) {
    console.error("Failed to load and render Mermaid diagrams:", e);
  } finally {
    // 11. Fade-out and remove the loading spinner/overlay
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("fade-out");
      setTimeout(() => {
        overlay.remove();
      }, 500);
    }
  }
});

let mermaidIdCounter = 0;

async function initMermaid() {
  if (!window.mermaid) {
    console.warn("Mermaid library is not loaded; skipping diagram rendering.");
    return;
  }

  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const mermaidTheme = currentTheme === "light" ? "default" : "dark";

  mermaid.initialize({
    startOnLoad: false,
    look: "handDrawn",
    theme: mermaidTheme,
    fontFamily: "'Architects Daughter', cursive, sans-serif",
    flowchart: { useMaxWidth: false, htmlLabels: true },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    themeVariables: {
      fontFamily: "'Architects Daughter', cursive, sans-serif",
    }
  });

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

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "mermaid-btn btn-zoom-out";
    zoomOutBtn.innerText = "➖";
    zoomOutBtn.title = "Zoom Out";

    const resetBtn = document.createElement("button");
    resetBtn.className = "mermaid-btn btn-zoom-reset";
    resetBtn.innerText = "↺";
    resetBtn.title = "Reset View";

    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "mermaid-btn btn-zoom-in";
    zoomInBtn.innerText = "➕";
    zoomInBtn.title = "Zoom In";

    const maximizeBtn = document.createElement("button");
    maximizeBtn.className = "mermaid-btn btn-maximize";
    maximizeBtn.innerText = "🔍";
    maximizeBtn.title = "Toggle Fullscreen";

    const rotateBtn = document.createElement("button");
    rotateBtn.className = "mermaid-btn btn-rotate";
    rotateBtn.innerText = "🔄";
    rotateBtn.title = "Rotate Landscape";

    actions.appendChild(zoomOutBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(zoomInBtn);
    actions.appendChild(maximizeBtn);
    actions.appendChild(rotateBtn);

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

    await setupInteractiveDiagram(container, content, viewport, code, zoomInBtn, zoomOutBtn, resetBtn, maximizeBtn, rotateBtn);
  }
}

async function updateMermaidTheme() {
  if (!window.mermaid) return;

  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const mermaidTheme = currentTheme === "light" ? "default" : "dark";

  mermaid.initialize({
    startOnLoad: false,
    look: "handDrawn",
    theme: mermaidTheme,
    fontFamily: "'Architects Daughter', cursive, sans-serif",
    flowchart: { useMaxWidth: false, htmlLabels: true },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    themeVariables: {
      fontFamily: "'Architects Daughter', cursive, sans-serif",
    }
  });

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

    await setupInteractiveDiagram(container, content, viewport, code, zoomInBtn, zoomOutBtn, resetBtn, maximizeBtn, rotateBtn);
  }
}

async function setupInteractiveDiagram(container, content, viewport, code, zoomInBtn, zoomOutBtn, resetBtn, maximizeBtn, rotateBtn) {
  const id = `mermaid-svg-${++mermaidIdCounter}`;
  content.innerHTML = "";

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
      const parts = viewBox.split(/\s+/).map(Number);
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

    content.style.width = svgW + "px";
    content.style.height = svgH + "px";

    const updateTransform = () => {
      content.style.transform = `translate(${viewport.x}px, ${viewport.y}px)`;
      content.style.width = (viewport.svgW * viewport.scale) + "px";
      content.style.height = (viewport.svgH * viewport.scale) + "px";
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
    zoomInBtn = newZoomInBtn;

    const newZoomOutBtn = zoomOutBtn.cloneNode(true);
    zoomOutBtn.replaceWith(newZoomOutBtn);
    zoomOutBtn = newZoomOutBtn;

    const newResetBtn = resetBtn.cloneNode(true);
    resetBtn.replaceWith(newResetBtn);
    resetBtn = newResetBtn;

    const newMaximizeBtn = maximizeBtn.cloneNode(true);
    maximizeBtn.replaceWith(newMaximizeBtn);
    maximizeBtn = newMaximizeBtn;

    const newRotateBtn = rotateBtn.cloneNode(true);
    rotateBtn.replaceWith(newRotateBtn);
    rotateBtn = newRotateBtn;

    zoomInBtn.addEventListener("click", () => {
      const isRotated = container.classList.contains("rotated-landscape");
      const rect = viewport.getBoundingClientRect();
      const px = isRotated ? rect.height / 2 : rect.width / 2;
      const py = isRotated ? rect.width / 2 : rect.height / 2;
      viewport.zoomAtPoint(px, py, 1.25);
    });

    zoomOutBtn.addEventListener("click", () => {
      const isRotated = container.classList.contains("rotated-landscape");
      const rect = viewport.getBoundingClientRect();
      const px = isRotated ? rect.height / 2 : rect.width / 2;
      const py = isRotated ? rect.width / 2 : rect.height / 2;
      viewport.zoomAtPoint(px, py, 0.8);
    });

    resetBtn.addEventListener("click", () => {
      viewport.resetView();
    });

    // Maximize/Minimize click handler with fluid animations
    maximizeBtn.addEventListener("click", () => {
      if (!container.classList.contains("maximized")) {
        container.classList.add("maximized");
        maximizeBtn.innerText = "🚪";
        maximizeBtn.title = "Restore Normal View";
        document.body.style.overflow = "hidden";

        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => {
          maximizeBtn.click();
        });

        setTimeout(() => {
          container.classList.add("visible");
          backdrop.classList.add("visible");
        }, 10);
      } else {
        container.classList.remove("visible");
        const backdrop = document.querySelector(".modal-backdrop");
        if (backdrop) {
          backdrop.classList.remove("visible");
        }

        setTimeout(() => {
          container.classList.remove("maximized");
          container.classList.remove("rotated-landscape");
          if (backdrop) backdrop.remove();
          document.body.style.overflow = "";
          maximizeBtn.innerText = "🔍";
          maximizeBtn.title = "Toggle Fullscreen";
        }, 350);
      }
      setTimeout(viewport.resetView, 50);
    });

    rotateBtn.addEventListener("click", () => {
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
        viewport.cachedRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

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
              const sx = ((pts[0].clientX + pts[1].clientX) / 2) - rect.left;
              const sy = ((pts[0].clientY + pts[1].clientY) / 2) - rect.top;
              const cx = sx - rect.width / 2;
              const cy = sy - rect.height / 2;
              px = cy + rect.height / 2;
              py = -cx + rect.width / 2;
            } else {
              px = ((pts[0].clientX + pts[1].clientX) / 2) - rect.left;
              py = ((pts[0].clientY + pts[1].clientY) / 2) - rect.top;
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

      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        
        if (!viewport.cachedRect) {
          const rect = viewport.getBoundingClientRect();
          viewport.cachedRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
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
      }, { passive: false });

      viewport.dataset.hasListeners = "true";
    }
  } catch (err) {
    console.error("Failed to render mermaid diagram: ", err);
    content.innerHTML = `
      <div style="color: #ef4444; padding: 1.5rem; font-family: 'Architects Daughter', cursive, monospace; border-left: 4px solid #ef4444; background: var(--color-code-bg); text-align: left;">
        <strong>Mermaid Error:</strong>
        <pre style="border: none; margin: 0; padding: 0.5rem 0; color: #ef4444; background: transparent; font-size: 14px; text-align: left;">${err.message || err}</pre>
      </div>
    `;
  }
}
