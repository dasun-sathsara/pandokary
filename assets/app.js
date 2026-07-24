function storageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (_) {
    return false;
  }
}

function createButton(className, text, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  if (title) {
    button.title = title;
    button.setAttribute("aria-label", title);
  }
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

function updateScrollLock() {
  const modalSelector = [
    ".table-scroll-container.maximized",
    ".mermaid-container.maximized",
    ".lightbox-backdrop.active",
  ].join(",");
  const mobileTOC =
    window.innerWidth < 1400 && !document.documentElement.classList.contains("toc-collapsed");
  document.body.classList.toggle(
    "scroll-locked",
    Boolean(document.querySelector(modalSelector)) || mobileTOC,
  );
}

function openModal(container) {
  container.classList.add("maximized");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("touchmove", (event) => event.preventDefault(), {
    passive: false,
  });
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    container.classList.add("visible");
    backdrop.classList.add("visible");
  });
  updateScrollLock();
  return backdrop;
}

function closeModal(container) {
  container.classList.remove("visible");
  const backdrop = document.querySelector(".modal-backdrop");
  if (backdrop) backdrop.classList.remove("visible");
  setTimeout(() => {
    container.classList.remove("maximized", "rotated-landscape");
    if (backdrop) backdrop.remove();
    updateScrollLock();
  }, 350);
}

async function loadFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("12px 'Architects Daughter'"),
      document.fonts.load("12px 'Google Sans Flex'"),
    ]);
    await document.fonts.ready;
  } catch (error) {
    console.warn("Font loading failed; CSS fallbacks remain active", error);
  }
}

function initCodeBlocks() {
  document.querySelectorAll("pre:not(.mermaid) code").forEach((code) => {
    const language = [...code.classList].find(
      (name) => !["sourceCode", "code", "hljs"].includes(name) && !name.startsWith("language-"),
    );
    if (language) code.classList.add(`language-${language.toLowerCase()}`);
    code.classList.add("hljs");
    if (window.hljs?.highlightElement) hljs.highlightElement(code);

    const lines = code.innerHTML.split(/\r?\n/);
    if (!lines.at(-1)?.trim()) lines.pop();
    if (lines.length >= 3) {
      code.innerHTML = lines.map((line) => `<div class="code-line">${line || " "}</div>`).join("");
      code.addEventListener("click", (event) => {
        const line = event.target.closest(".code-line");
        if (line && event.clientX - line.getBoundingClientRect().left < 55) {
          line.classList.toggle("focused-line");
        }
      });
    }

    const pre = code.parentElement;
    if (lines.length > 15) {
      pre.classList.add("collapsible-code-block");
      const holder = document.createElement("div");
      holder.className = "code-toggle-container";
      holder.append(
        createButton("code-toggle-btn", "Show More", "Expand code", (event) => {
          const expanded = pre.classList.toggle("expanded");
          event.currentTarget.textContent = expanded ? "Show Less" : "Show More";
          if (!expanded) {
            pre.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }),
      );
      pre.after(holder);
    }

    pre.append(
      createButton("copy-btn", "Copy", "Copy code", async (event) => {
        const button = event.currentTarget;
        try {
          await navigator.clipboard.writeText(code.innerText);
          button.textContent = "Copied!";
          button.classList.add("success");
        } catch (error) {
          console.error("Copy failed", error);
          button.textContent = "Error";
        }
        setTimeout(() => {
          button.textContent = "Copy";
          button.classList.remove("success");
        }, 2000);
      }),
    );
  });
}

function initTables() {
  document.querySelectorAll("table").forEach((table) => {
    const container = document.createElement("div");
    container.className = "table-scroll-container";
    const toolbar = document.createElement("div");
    toolbar.className = "table-toolbar";
    toolbar.innerHTML = '<span class="table-title">📊 Data Table</span>';
    const actions = document.createElement("div");
    actions.className = "table-actions";
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    const left = document.createElement("div");
    const right = document.createElement("div");
    left.className = "scroll-shadow left";
    right.className = "scroll-shadow right";

    const updateShadows = () => {
      left.style.opacity = wrapper.scrollLeft > 2 ? "1" : "0";
      right.style.opacity =
        wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth - 2 ? "1" : "0";
    };
    const maximize = createButton("table-btn btn-maximize", "🔍", "Toggle fullscreen", (event) => {
      const button = event.currentTarget;
      if (!container.classList.contains("maximized")) {
        const backdrop = openModal(container);
        backdrop.addEventListener("click", () => button.click());
        button.textContent = "🚪";
        button.title = "Restore Normal View";
      } else {
        closeModal(container);
        button.textContent = "🔍";
        button.title = "Toggle Fullscreen";
      }
      setTimeout(updateShadows, 50);
    });
    const rotate = createButton("table-btn btn-rotate", "🔄", "Rotate landscape", () => {
      container.classList.toggle("rotated-landscape");
      setTimeout(updateShadows, 50);
    });

    actions.append(maximize, rotate);
    toolbar.append(actions);
    table.before(container);
    wrapper.append(table);
    container.append(toolbar, wrapper, left, right);
    wrapper.addEventListener("scroll", updateShadows, { passive: true });
    window.addEventListener("resize", updateShadows, { passive: true });
    setTimeout(updateShadows, 100);
  });
}

const FONT_OPTIONS = {
  "studio-feixen": ["'Studio Feixen Sans TRIAL','Studio Feixen Sans',sans-serif", "normal"],
  "google-sans-flex": ["'Google Sans Flex',sans-serif", '"slnt" 0, "wdth" 100, "GRAD" 0, "ROND" 0'],
};

function setHighlightTheme(theme) {
  const base = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/";
  const file =
    theme === "vscode-dark"
      ? "vs2015.min.css"
      : ["dark", "ayu-dark"].includes(theme)
        ? "tokyo-night-dark.min.css"
        : "github.min.css";
  const existing = document.getElementById("hljs-theme");
  if (existing?.tagName.toLowerCase() === "link") {
    existing.href = base + file;
    return;
  }
  const link = document.createElement("link");
  link.id = "hljs-theme";
  link.rel = "stylesheet";
  link.href = base + file;
  if (existing) existing.replaceWith(link);
  else document.head.appendChild(link);
}

function initSettings() {
  const toggle = document.createElement("button");
  toggle.className = "floating-toggle settings-toggle";
  toggle.setAttribute("aria-label", "Open appearance settings");
  toggle.setAttribute("aria-haspopup", "true");
  toggle.title = "Appearance Settings";
  toggle.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="settings-icon">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;
  toggle.setAttribute("aria-expanded", "false");
  document.body.append(toggle);

  const panel = document.createElement("div");
  panel.className = "settings-popover";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="settings-header">
      <h3>Appearance</h3>
      <button class="close-settings" aria-label="Close settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="settings-section">
      <div class="settings-label">Theme</div>
      <div class="theme-grid">
        ${(
          window.PDY_THEME_MANIFEST || [
            { id: "light", name: "Default" },
            { id: "github-light", name: "GitHub" },
            { id: "warm-light", name: "Paper" },
            { id: "dark", name: "Obsidian" },
            { id: "vscode-dark", name: "VS Code" },
            { id: "ayu-dark", name: "Ayu" },
          ]
        )
          .map(
            (theme) =>
              `<button class="theme-option" data-theme-key="${theme.id}">` +
              `<span class="theme-preview-dot ${theme.id}-dot"></span>${theme.name}` +
              "</button>",
          )
          .join("")}
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Typography</div>
      <div class="font-selector">
        <button class="font-option" data-font-key="studio-feixen">Studio Feixen</button>
        <button class="font-option" data-font-key="google-sans-flex">Google Sans</button>
      </div>
      <div class="control-row">
        <span class="control-name">Text Size</span>
        <div class="stepper-control">
          <button class="stepper-btn dec-font-size" aria-label="Decrease font size">—</button>
          <span class="stepper-val font-size-val">100%</span>
          <button class="stepper-btn inc-font-size" aria-label="Increase font size">+</button>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-label">Layout</div>
      <div class="control-row">
        <span class="control-name">Max Width</span>
        <div class="stepper-control">
          <button class="stepper-btn dec-layout-width" aria-label="Decrease layout width">—</button>
          <span class="stepper-val layout-width-val">1040px</span>
          <button class="stepper-btn inc-layout-width" aria-label="Increase layout width">+</button>
        </div>
      </div>
    </div>`;
  document.body.append(panel);

  const show = (visible) => {
    panel.classList.toggle("active", visible);
    toggle.classList.toggle("active", visible);
    toggle.setAttribute("aria-expanded", String(visible));
    panel.setAttribute("aria-hidden", String(!visible));
  };
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    show(!panel.classList.contains("active"));
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  panel.querySelector(".close-settings").addEventListener("click", (event) => {
    event.stopPropagation();
    show(false);
  });
  window.addEventListener("click", () => show(false));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") show(false);
  });

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    storageSet("theme", theme);
    setHighlightTheme(theme);
    panel.querySelectorAll(".theme-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.themeKey === theme);
    });
    if (typeof updateMermaidTheme === "function") updateMermaidTheme();
  };
  panel.querySelectorAll(".theme-option").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeKey));
  });
  applyTheme(storageGet("theme", "light"));

  const applyFont = (key) => {
    const selectedKey = FONT_OPTIONS[key] ? key : "studio-feixen";
    const font = FONT_OPTIONS[selectedKey];
    document.documentElement.dataset.font = selectedKey;
    document.documentElement.style.setProperty("--font-body", font[0]);
    document.documentElement.style.setProperty("--font-heading", font[0]);
    document.documentElement.style.setProperty("--font-optical-sizing", "auto");
    document.documentElement.style.setProperty("--font-variation-settings", font[1]);
    storageSet("fontChoice", selectedKey);
    panel.querySelectorAll(".font-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.fontKey === selectedKey);
    });
  };
  panel.querySelectorAll(".font-option").forEach((button) => {
    button.addEventListener("click", () => applyFont(button.dataset.fontKey));
  });
  applyFont(storageGet("fontChoice", "studio-feixen"));

  let size = Math.max(-4, Math.min(8, parseInt(storageGet("font-size-adjust", "0"), 10) || 0));
  const decreaseSize = panel.querySelector(".dec-font-size");
  const increaseSize = panel.querySelector(".inc-font-size");
  const updateSize = () => {
    document.documentElement.style.setProperty("--font-size-adjust", `${size}px`);
    panel.querySelector(".font-size-val").textContent = `${Math.round(((18 + size) / 18) * 100)}%`;
    decreaseSize.disabled = size <= -4;
    increaseSize.disabled = size >= 8;
    storageSet("font-size-adjust", size);
  };
  decreaseSize.addEventListener("click", () => {
    size = Math.max(-4, size - 1);
    updateSize();
  });
  increaseSize.addEventListener("click", () => {
    size = Math.min(8, size + 1);
    updateSize();
  });
  updateSize();

  const widths = [800, 920, 1040, 1160, 1280, 1400];
  let width = parseInt(storageGet("layout-max-width", "1040"), 10);
  if (!widths.includes(width)) width = 1040;
  const decreaseWidth = panel.querySelector(".dec-layout-width");
  const increaseWidth = panel.querySelector(".inc-layout-width");
  const updateWidth = () => {
    document.documentElement.style.setProperty("--content-max-width", `${width}px`);
    panel.querySelector(".layout-width-val").textContent = `${width}px`;
    decreaseWidth.disabled = width <= widths[0];
    increaseWidth.disabled = width >= widths.at(-1);
    storageSet("layout-max-width", width);
  };
  decreaseWidth.addEventListener("click", () => {
    width = widths[Math.max(0, widths.indexOf(width) - 1)];
    updateWidth();
  });
  increaseWidth.addEventListener("click", () => {
    width = widths[Math.min(widths.length - 1, widths.indexOf(width) + 1)];
    updateWidth();
  });
  updateWidth();

  return { panel, toggle };
}

function ensureHeadingID(heading) {
  if (!heading.id) {
    heading.id = heading.textContent
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

function initTableOfContents() {
  const headings = [...document.querySelectorAll("main h2,main h3")];
  if (!headings.length) return;

  const aside = document.createElement("aside");
  aside.className = "toc-sidebar";
  aside.innerHTML =
    '<h3 class="toc-sidebar-title">Table of Contents</h3><ul class="toc-list"></ul>';
  const list = aside.querySelector("ul");
  headings.forEach((heading) => {
    ensureHeadingID(heading);
    const item = document.createElement("li");
    item.className = `toc-item-${heading.tagName.toLowerCase()}`;
    const link = document.createElement("a");
    link.className = "toc-link";
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    item.append(link);
    list.append(item);
  });
  document.body.append(aside);

  const backdrop = document.createElement("div");
  backdrop.className = "toc-backdrop";
  backdrop.addEventListener("touchmove", (event) => event.preventDefault(), {
    passive: false,
  });
  document.body.append(backdrop);
  const toggle = createButton("floating-toggle toc-toggle", "📖", "Show Table of Contents");
  document.body.append(toggle);

  let collapsed = window.innerWidth < 1400 || storageGet("tocCollapsed", "false") === "true";
  const setCollapsed = (value) => {
    collapsed = value;
    document.documentElement.classList.toggle("toc-collapsed", value);
    toggle.textContent = value ? "📖" : "✖";
    toggle.title = value ? "Show Table of Contents" : "Hide Table of Contents";
    toggle.setAttribute("aria-label", toggle.title);
    storageSet("tocCollapsed", value);
    updateScrollLock();
  };
  toggle.addEventListener("click", () => setCollapsed(!collapsed));
  backdrop.addEventListener("click", () => setCollapsed(true));
  list.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 1400) setCollapsed(true);
    });
  });
  setCollapsed(collapsed);

  const activeHeadings = new Map();
  let lastActiveID = null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeHeadings.set(entry.target.id, entry.boundingClientRect.top);
        } else {
          activeHeadings.delete(entry.target.id);
        }
      });
      let activeID = null;
      let nearestTop = Infinity;
      activeHeadings.forEach((top, id) => {
        if (top < nearestTop) {
          nearestTop = top;
          activeID = id;
        }
      });
      if (!activeID || activeID === lastActiveID) return;
      lastActiveID = activeID;
      list.querySelectorAll("a").forEach((link) => {
        const active = link.hash === `#${activeID}`;
        link.classList.toggle("active", active);
        if (active) {
          const asideRect = aside.getBoundingClientRect();
          const linkRect = link.getBoundingClientRect();
          if (linkRect.top < asideRect.top || linkRect.bottom > asideRect.bottom) {
            link.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      });
    },
    { rootMargin: "0px 0px -60% 0px", threshold: 0 },
  );
  for (const heading of headings) observer.observe(heading);
}

function initFloatingButtonAutoHide(settings) {
  let lastScrollTop = 0;
  window.addEventListener(
    "scroll",
    () => {
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
      const mobile = window.innerWidth < 768;
      settings.toggle.classList.toggle(
        "hidden",
        mobile && hide && !settings.panel.classList.contains("active"),
      );

      const tocToggle = document.querySelector(".toc-toggle");
      if (tocToggle) {
        const tocOpen =
          window.innerWidth < 1400 && !document.documentElement.classList.contains("toc-collapsed");
        tocToggle.classList.toggle("hidden", mobile && hide && !tocOpen);
      }
      lastScrollTop = scrollTop;
    },
    { passive: true },
  );
  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth >= 768) {
        settings.toggle.classList.remove("hidden");
        document.querySelector(".toc-toggle")?.classList.remove("hidden");
      }
    },
    { passive: true },
  );
}

function initMathJaxInteractionGuard() {
  const guard = (event) => {
    if (event.target.closest(".mjx-svg, mjx-container, .MathJax")) {
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
  const update = () => {
    const height = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${height > 0 ? (window.scrollY / height) * 100 : 0}%`;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();

  const main = document.querySelector("main");
  const header = document.querySelector("header");
  if (main && header) {
    const words = main.innerText.trim().split(/\s+/).filter(Boolean).length;
    const label = document.createElement("p");
    label.className = "reading-time";
    label.innerHTML = `⏱️ <strong>${Math.ceil(words / 200)} min</strong> read`;
    header.append(label);
  }
}

function initLightbox() {
  document.querySelectorAll("main img").forEach((image) => {
    if (image.closest(".mermaid-container")) return;
    image.style.cursor = "zoom-in";
    image.addEventListener("click", () => openLightbox(image));
  });
}

function openLightbox(image) {
  const backdrop = document.createElement("div");
  backdrop.className = "lightbox-backdrop";
  const zoomed = image.cloneNode();
  zoomed.className = "lightbox-img";
  const close = createButton("lightbox-close", "×", "Close image");
  backdrop.append(close, zoomed);
  document.body.append(backdrop);
  requestAnimationFrame(() => {
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

  const draw = (transition = false) => {
    zoomed.style.transition = transition ? "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)" : "none";
    zoomed.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  };
  const stopMouseDrag = () => {
    dragging = false;
  };
  const dismiss = () => {
    backdrop.classList.remove("active");
    window.removeEventListener("mousemove", moveMouse);
    window.removeEventListener("mouseup", stopMouseDrag);
    setTimeout(() => {
      backdrop.remove();
      updateScrollLock();
    }, 300);
  };
  const moveMouse = (event) => {
    if (!dragging) return;
    x = event.clientX - startX;
    y = event.clientY - startY;
    draw();
  };

  backdrop.addEventListener("click", dismiss);
  backdrop.addEventListener("touchmove", (event) => event.preventDefault(), {
    passive: false,
  });
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    dismiss();
  });
  zoomed.addEventListener("click", (event) => event.stopPropagation());
  zoomed.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    if (scale > 1.5) {
      scale = 1;
      x = 0;
      y = 0;
    } else {
      scale = 2.5;
      const rect = zoomed.getBoundingClientRect();
      x = -(event.clientX - rect.left - rect.width / 2) * 1.5;
      y = -(event.clientY - rect.top - rect.height / 2) * 1.5;
    }
    draw(true);
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
        dragging = true;
        startX = event.touches[0].clientX - x;
        startY = event.touches[0].clientY - y;
      } else if (event.touches.length === 2) {
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
  zoomed.addEventListener("touchend", () => {
    dragging = false;
    if (scale < 1) {
      scale = 1;
      x = 0;
      y = 0;
      draw(true);
    }
  });
}

function initHeadingLinks() {
  document.querySelectorAll("main h2,main h3,main h4,main h5").forEach((heading) => {
    ensureHeadingID(heading);
    heading.classList.add("heading-with-anchor");
    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.textContent = "🔗";
    anchor.title = "Copy link to this section";
    anchor.setAttribute("aria-label", `Link to ${heading.textContent}`);
    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      history.pushState(null, "", anchor.hash);
      try {
        await navigator.clipboard.writeText(window.location.href);
        anchor.textContent = "✔️";
        anchor.classList.add("copied");
        setTimeout(() => {
          anchor.textContent = "🔗";
          anchor.classList.remove("copied");
        }, 1500);
      } catch (error) {
        console.error("Copy link failed", error);
      }
    });
    heading.append(anchor);
  });
}

function initScrollPosition() {
  let timer;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => storageSet(`pdy_scroll_${document.title}`, window.scrollY), 150);
    },
    { passive: true },
  );
}

function initKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const container of document.querySelectorAll(
      ".table-scroll-container.maximized,.mermaid-container.maximized",
    )) {
      container.querySelector(".btn-maximize")?.click();
    }
    document.querySelector(".lightbox-close")?.click();
  });
  window.addEventListener("resize", updateScrollLock, { passive: true });
}

function finishLoading() {
  const restore = () => {
    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" });
      return;
    }
    const saved = parseInt(storageGet(`pdy_scroll_${document.title}`, "0"), 10);
    if (saved) window.scrollTo(0, saved);
  };
  const overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    restore();
    return;
  }
  overlay.classList.add("fade-out");
  setTimeout(() => {
    overlay.remove();
    restore();
  }, 500);
}

async function main() {
  await loadFonts();
  initCodeBlocks();
  initTables();
  const settings = initSettings();
  initTableOfContents();
  initFloatingButtonAutoHide(settings);
  initMathJaxInteractionGuard();
  initReadingProgress();
  initLightbox();
  initHeadingLinks();
  initScrollPosition();
  initKeyboardShortcuts();
  try {
    await initMermaid();
  } catch (error) {
    console.error("Mermaid initialization failed", error);
  }
  finishLoading();
}

document.addEventListener("DOMContentLoaded", main);
