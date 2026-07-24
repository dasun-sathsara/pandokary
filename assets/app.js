const StorageManager = (() => {
  const fallbackStore = new Map();
  const preferenceKeys = Object.freeze({
    theme: "theme",
    fontChoice: "fontChoice",
    fontSizeAdjust: "font-size-adjust",
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
    slidersHorizontal:
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" class="ph ph-sliders-horizontal settings-icon"><path d="M120,80a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16h72A8,8,0,0,1,120,80Zm96,0H160a8,8,0,0,0,0,16h56a8,8,0,0,0,0-16Zm-80,96H40a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16Zm80,0H184a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16ZM136,56a24,24,0,1,0,24,24A24,24,0,0,0,136,56Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,136,88ZM160,152a24,24,0,1,0,24,24A24,24,0,0,0,160,152Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,160,184Z"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-x"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>',
    bookOpen:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" class="ph ph-book-open"><path d="M224,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h64a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM96,192H32V64H96a24,24,0,0,1,24,24V192A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z"/></svg>',
    link: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-link anchor-icon"><path d="M136,176a8,8,0,0,1-5.66-2.34l-40-40a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,136,176Zm76.69-124.69a48,48,0,0,0-67.89,0L112,84.69a8,8,0,0,0,11.31,11.31l32.8-32.8a32,32,0,0,1,45.26,45.25L168.57,141.26a8,8,0,1,0,11.31,11.31l32.8-32.8A48,48,0,0,0,212.69,51.31ZM132.12,187.58a8,8,0,0,0-11.31-11.31L88,209.07a32,32,0,0,1-45.25-45.26L75.54,131a8,8,0,0,0-11.31-11.31L31.43,152.51a48,48,0,0,0,67.88,67.88Z"/></svg>',
    clock:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" class="ph ph-clock reading-time-icon"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>',
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
      await navigator.clipboard.writeText(text);
      return;
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
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
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
    const mobileTOC =
      hasTOC && isCompactLayout() && document.documentElement.classList.contains("toc-open");
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
    document.body.append(backdrop);
    container._modalBackdrop = backdrop;
    requestFrame(() => {
      container.classList.add("visible");
      backdrop.classList.add("visible");
    });
    updateScrollLock();
    return backdrop;
  }

  function closeModal(container) {
    container.classList.remove("visible");
    const backdrop = container._modalBackdrop || document.querySelector(".modal-backdrop");
    backdrop?.classList.remove("visible");
    window.setTimeout(() => {
      container.classList.remove("maximized", "rotated-landscape");
      backdrop?.remove();
      delete container._modalBackdrop;
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
  };
})();

const CodeBlockModule = (() => {
  const { ICONS, copyText, createButton, setButtonTitle } = UIComponentFactory;

  function parseLineRange(spec) {
    const lines = new Set();
    if (!spec) return lines;
    const cleaned = String(spec).replace(/[{}]/g, "").replace(/line-/gi, "");
    for (const part of cleaned.split(",")) {
      const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!match) continue;
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2] || match[1], 10);
      for (let line = Math.min(start, end); line <= Math.max(start, end); line += 1) {
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
    return `<div class="${classes.join(" ")}">${lineContent || " "}</div>`;
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
          button.innerHTML = expanded
            ? `${ICONS.caretUp}<span>Show Less</span>`
            : `${ICONS.caretDown}<span>Show More</span>`;
          setButtonTitle(button, expanded ? "Collapse code" : "Expand code");
          if (!expanded) pre.scrollIntoView({ behavior: "smooth", block: "nearest" });
        },
      ),
    );
    pre.after(holder);
  }

  function addCopyControl(pre, plainCode) {
    pre.append(
      createButton("copy-btn", `${ICONS.copy}<span>Copy</span>`, "Copy code", async (event) => {
        const button = event.currentTarget;
        try {
          await copyText(plainCode);
          button.innerHTML = `${ICONS.check}<span>Copied!</span>`;
          button.classList.add("success");
        } catch (error) {
          console.error("Copy failed", error);
          button.textContent = "Error";
        }
        window.setTimeout(() => {
          button.innerHTML = `${ICONS.copy}<span>Copy</span>`;
          button.classList.remove("success");
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
    const language = [...code.classList].find(
      (name) => !["sourceCode", "code", "hljs"].includes(name) && !name.startsWith("language-"),
    );
    if (language) code.classList.add(`language-${language.toLowerCase()}`);
    code.classList.add("hljs");
    if (window.hljs?.highlightElement) window.hljs.highlightElement(code);

    const highlightedLines = parseLineRange(getLineSpec(pre, code));
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
    code.innerHTML = lines
      .map((line, index) => formatSingleCodeLine(line, index, highlightedLines, isDiff))
      .join("");
    code.addEventListener("click", (event) => {
      const line = event.target.closest(".code-line");
      if (line && event.clientX - line.getBoundingClientRect().left < 55) {
        line.classList.toggle("focused-line");
      }
    });
    addCollapseControl(pre, lines.length);
    addCopyControl(pre, plainCode);
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
    if (resizeBound) return;
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

  function initTable(table) {
    if (table.closest(".table-scroll-container")) return;
    const container = document.createElement("div");
    container.className = "table-scroll-container";
    const toolbar = document.createElement("div");
    toolbar.className = "table-toolbar";
    toolbar.innerHTML = `<span class="table-title">${ICONS.table} <span>Data Table</span></span>`;
    const actions = document.createElement("div");
    actions.className = "table-actions";
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    const left = document.createElement("div");
    const right = document.createElement("div");
    left.className = "scroll-shadow left";
    right.className = "scroll-shadow right";

    const updateShadows = () => {
      if (!document.body.contains(wrapper)) {
        shadowUpdaters.delete(updateShadows);
        return;
      }
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
    toolbar.append(actions);
    table.before(container);
    wrapper.append(table);
    container.append(toolbar, wrapper, left, right);
    wrapper.addEventListener("scroll", updateShadows, { passive: true });
    if (typeof window.ResizeObserver === "function") {
      const observer = new window.ResizeObserver(updateShadows);
      observer.observe(wrapper);
    }
    window.setTimeout(updateShadows, 100);
  }

  function init() {
    bindResizeUpdates();
    document.querySelectorAll("table").forEach((table) => {
      try {
        initTable(table);
      } catch (error) {
        console.error("Table initialization failed", error);
      }
    });
  }

  return { init };
})();

const SettingsModule = (() => {
  const { ICONS, requestFrame } = UIComponentFactory;
  const FONT_OPTIONS = Object.freeze({
    "studio-feixen": ["'Studio Feixen Sans TRIAL','Studio Feixen Sans',sans-serif", "normal"],
    "google-sans-flex": [
      "'Google Sans Flex',sans-serif",
      '"slnt" 0, "wdth" 100, "GRAD" 0, "ROND" 0',
    ],
  });
  const DEFAULT_THEMES = Object.freeze([
    { id: "lumina", name: "Lumina" },
    { id: "primer", name: "Primer" },
    { id: "parchment", name: "Parchment" },
    { id: "verdant-paper", name: "Verdant Paper" },
    { id: "lilac-frost", name: "Lilac Frost" },
    { id: "obsidian", name: "Obsidian" },
    { id: "studio-dark", name: "Studio Dark" },
    { id: "ayu-mirage", name: "Ayu Mirage" },
    { id: "midnight-fjord", name: "Midnight Fjord" },
    { id: "boreal", name: "Boreal" },
  ]);

  async function loadFonts() {
    if (!document.fonts?.load) return;
    const fontLoads = Promise.all([
      document.fonts.load("12px 'Google Sans Flex'"),
      document.fonts.load("12px 'Studio Feixen Sans TRIAL'"),
      document.fonts.load("12px 'Maple Mono NF'"),
    ]).catch((error) => {
      console.warn("Font loading failed; CSS fallbacks remain active", error);
    });
    await Promise.race([fontLoads, new Promise((resolve) => window.setTimeout(resolve, 2000))]);
  }

  function setHighlightTheme(theme) {
    const existing = document.getElementById("hljs-theme");
    const hasEmbeddedOfflineTheme =
      !document.querySelector("[data-external]") &&
      [...document.querySelectorAll("style")].some((style) =>
        style.textContent.includes(".hljs{color:#24292e;background:#fff}"),
      );
    if ((existing && !existing.hasAttribute("data-external")) || hasEmbeddedOfflineTheme) return;

    const base = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/";
    const file =
      theme === "studio-dark"
        ? "vs2015.min.css"
        : ["obsidian", "ayu-mirage", "midnight-fjord", "boreal"].includes(theme)
          ? "tokyo-night-dark.min.css"
          : "github.min.css";
    if (existing?.tagName.toLowerCase() === "link") {
      existing.href = base + file;
      return;
    }
    const link = document.createElement("link");
    link.id = "hljs-theme";
    link.rel = "stylesheet";
    link.href = base + file;
    link.dataset.external = "true";
    if (existing) existing.replaceWith(link);
    else document.head.append(link);
  }

  function getThemes() {
    return Array.isArray(window.PDY_THEME_MANIFEST) && window.PDY_THEME_MANIFEST.length
      ? window.PDY_THEME_MANIFEST
      : DEFAULT_THEMES;
  }

  function createPanel() {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "floating-toggle settings-toggle";
    toggle.setAttribute("aria-label", "Open appearance settings");
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.title = "Appearance Settings";
    toggle.innerHTML = ICONS.slidersHorizontal;
    document.body.append(toggle);

    const panel = document.createElement("div");
    panel.className = "settings-popover";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="settings-header">
        <h3>Appearance</h3>
        <button type="button" class="close-settings" aria-label="Close settings">${ICONS.x}</button>
      </div>
      <div class="settings-section">
        <div class="settings-label">Theme</div>
        <div class="theme-grid">
          ${getThemes()
            .map(
              (theme) =>
                `<button type="button" class="theme-option" data-theme-key="${theme.id}">` +
                `<span class="theme-preview-dot ${theme.id}-dot"></span>${theme.name}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-label">Typography</div>
        <div class="font-selector">
          <button type="button" class="font-option" data-font-key="studio-feixen">Studio Feixen</button>
          <button type="button" class="font-option" data-font-key="google-sans-flex">Google Sans</button>
        </div>
        <div class="control-row">
          <span class="control-name">Text Size</span>
          <div class="stepper-control">
            <button type="button" class="stepper-btn dec-font-size" aria-label="Decrease font size">—</button>
            <span class="stepper-val font-size-val">100%</span>
            <button type="button" class="stepper-btn inc-font-size" aria-label="Increase font size">+</button>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-label">Layout</div>
        <div class="control-row">
          <span class="control-name">Max Width</span>
          <div class="stepper-control">
            <button type="button" class="stepper-btn dec-layout-width" aria-label="Decrease layout width">—</button>
            <span class="stepper-val layout-width-val">1040px</span>
            <button type="button" class="stepper-btn inc-layout-width" aria-label="Increase layout width">+</button>
          </div>
        </div>
      </div>`;
    document.body.append(panel);
    return { panel, toggle };
  }

  function bindPanelVisibility(panel, toggle) {
    const closeButton = panel.querySelector(".close-settings");
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
    const show = (visible, restoreFocus = false) => {
      panel.classList.toggle("active", visible);
      toggle.classList.toggle("active", visible);
      toggle.setAttribute("aria-expanded", String(visible));
      panel.setAttribute("aria-hidden", String(!visible));
      setFocusability(visible);
      if (visible) requestFrame(() => closeButton?.focus());
      else if (restoreFocus) toggle.focus();
    };
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      show(!panel.classList.contains("active"));
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    closeButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      show(false, true);
    });
    window.addEventListener("click", () => show(false));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") show(false, true);
    });
    show(false);
  }

  function bindThemeControls(panel) {
    const applyTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      StorageManager.setPreference("theme", theme);
      setHighlightTheme(theme);
      panel.querySelectorAll(".theme-option").forEach((button) => {
        button.classList.toggle("active", button.dataset.themeKey === theme);
      });
      if (typeof window.updateMermaidTheme === "function") window.updateMermaidTheme();
    };
    panel.querySelectorAll(".theme-option").forEach((button) => {
      button.addEventListener("click", () => applyTheme(button.dataset.themeKey));
    });
    applyTheme(StorageManager.getPreference("theme", "lumina"));
  }

  function bindFontControls(panel) {
    const applyFont = (key) => {
      const selectedKey = FONT_OPTIONS[key] ? key : "studio-feixen";
      const font = FONT_OPTIONS[selectedKey];
      document.documentElement.dataset.font = selectedKey;
      document.documentElement.style.setProperty("--font-body", font[0]);
      document.documentElement.style.setProperty("--font-heading", font[0]);
      document.documentElement.style.setProperty("--font-optical-sizing", "auto");
      document.documentElement.style.setProperty("--font-variation-settings", font[1]);
      StorageManager.setPreference("fontChoice", selectedKey);
      panel.querySelectorAll(".font-option").forEach((button) => {
        button.classList.toggle("active", button.dataset.fontKey === selectedKey);
      });
    };
    panel.querySelectorAll(".font-option").forEach((button) => {
      button.addEventListener("click", () => applyFont(button.dataset.fontKey));
    });
    applyFont(StorageManager.getPreference("fontChoice", "studio-feixen"));
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
      document.documentElement.style.setProperty("--font-size-adjust", `${size}px`);
      value.textContent = `${Math.round(((18 + size) / 18) * 100)}%`;
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
    update();
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
    bindFontControls(settings.panel);
    bindFontSizeControls(settings.panel);
    bindLayoutControls(settings.panel);
    return settings;
  }

  return { init, loadFonts, setHighlightTheme };
})();

const TOCModule = (() => {
  const { ICONS, createButton, updateScrollLock } = UIComponentFactory;

  function ensureHeadingID(heading) {
    if (heading.id) return heading.id;
    heading.id = heading.textContent
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return heading.id;
  }

  function initScrollSpy(headings, aside, list) {
    if (typeof window.IntersectionObserver !== "function") return;
    const activeHeadings = new Map();
    let lastActiveID = null;
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            activeHeadings.set(entry.target.id, entry.boundingClientRect.top);
          else activeHeadings.delete(entry.target.id);
        });
        let activeID = null;
        let nearestTop = Number.POSITIVE_INFINITY;
        activeHeadings.forEach((top, id) => {
          if (top < nearestTop) {
            nearestTop = top;
            activeID = id;
          }
        });
        if (!activeID) {
          if (lastActiveID !== null) {
            lastActiveID = null;
            list.querySelectorAll("a").forEach((link) => {
              link.classList.remove("active");
            });
          }
          return;
        }
        if (activeID === lastActiveID) return;
        lastActiveID = activeID;
        list.querySelectorAll("a").forEach((link) => {
          {
            const active = link.hash === `#${activeID}`;
            link.classList.toggle("active", active);
            if (!active) return;
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
    headings.forEach((heading) => {
      observer.observe(heading);
    });
  }

  function init() {
    const headings = [...document.querySelectorAll("main h2,main h3")];
    if (!headings.length) return null;
    const aside = document.createElement("aside");
    aside.className = "toc-sidebar";
    aside.innerHTML =
      '<h3 class="toc-sidebar-title">Table of Contents</h3><ul class="toc-list"></ul>';
    const list = aside.querySelector(".toc-list");
    headings.forEach((heading) => {
      {
        ensureHeadingID(heading);
        const item = document.createElement("li");
        item.className = `toc-item-${heading.tagName.toLowerCase()}`;
        const link = document.createElement("a");
        link.className = "toc-link";
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent;
        item.append(link);
        list.append(item);
      }
    });
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
    document.body.append(toggle);

    let isOpen =
      !isCompactLayout() && StorageManager.getPreference("tocCollapsed", "false") !== "true";
    const setOpen = (value) => {
      isOpen = value;
      document.documentElement.classList.toggle("toc-open", isOpen);
      toggle.innerHTML = isOpen ? ICONS.x : ICONS.bookOpen;
      UIComponentFactory.setButtonTitle(
        toggle,
        isOpen ? "Hide Table of Contents" : "Show Table of Contents",
      );
      StorageManager.setPreference("tocCollapsed", !isOpen);
      updateScrollLock();
    };
    toggle.addEventListener("click", () => setOpen(!isOpen));
    backdrop.addEventListener("click", () => setOpen(false));
    list.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (isCompactLayout()) setOpen(false);
      });
    });
    setOpen(isOpen);
    initScrollSpy(headings, aside, list);
    return { aside, backdrop, toggle, setOpen };
  }

  return { init, ensureHeadingID };
})();

const TaskListModule = (() => {
  function initMarkdownTasks() {
    document.querySelectorAll(".task-list li").forEach((item) => {
      {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        checkbox.removeAttribute("disabled");
        const updateState = () => item.classList.toggle("task-completed", checkbox.checked);
        updateState();
        checkbox.addEventListener("change", updateState);
      }
    });
  }

  function initInlineTasks() {
    document.querySelectorAll("main p, main li:not(.task-list li)").forEach((element) => {
      if (!/(?:\[\s?\]|\[x\])/i.test(element.innerHTML)) return;
      element.innerHTML = element.innerHTML.replace(
        /(\[\s?\]|\[x\])\s*([^[]+)/gi,
        (_match, mark, text) => {
          const checked = mark.toLowerCase().includes("x");
          return `<div class="inline-task-item${checked ? " task-completed" : ""}"><input type="checkbox" class="inline-task-checkbox"${checked ? " checked" : ""}><span>${text.trim()}</span></div>`;
        },
      );
      element.querySelectorAll(".inline-task-item").forEach((item) => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox?.addEventListener("change", () => {
          item.classList.toggle("task-completed", checkbox.checked);
        });
      });
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
      settingsToggle?.classList.toggle(
        "hidden",
        compactLayout && hide && !settingsPanel?.classList.contains("active"),
      );
      const tocToggle = document.querySelector(".toc-toggle");
      const tocOpen = compactLayout && document.documentElement.classList.contains("toc-open");
      tocToggle?.classList.toggle("hidden", compactLayout && hide && !tocOpen);
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
    const update = () => {
      scheduled = false;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = `${height > 0 ? (window.scrollY / height) * 100 : 0}%`;
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
    window.addEventListener("resize", debounce(update, 100), { passive: true });
    update();

    const main = document.querySelector("main");
    const header = document.querySelector("header");
    if (!main || !header) return;
    const words = main.innerText.trim().split(/\s+/).filter(Boolean).length;
    const label = document.createElement("p");
    label.className = "reading-time";
    label.innerHTML = `${ICONS.clock} <strong>${Math.ceil(words / 200)} min</strong> read`;
    header.append(label);
  }

  function openLightbox(image) {
    const backdrop = document.createElement("div");
    backdrop.className = "lightbox-backdrop";
    const zoomed = image.cloneNode();
    zoomed.className = "lightbox-img";
    const close = createButton("lightbox-close", ICONS.x, "Close image");
    backdrop.append(close, zoomed);
    document.body.append(backdrop);
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
      zoomed.style.transition = transition
        ? "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        : "none";
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
    const dismiss = () => {
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

  function initLightbox() {
    document.querySelectorAll("main img").forEach((image) => {
      if (image.closest(".mermaid-container")) return;
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
        anchor.href = `#${heading.id}`;
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

  function initKeyboardShortcuts() {
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      document
        .querySelectorAll(".table-scroll-container.maximized,.mermaid-container.maximized")
        .forEach((container) => {
          container.querySelector(".btn-maximize")?.click();
        });
      document.querySelector(".lightbox-close")?.click();
    });
    window.addEventListener("resize", debounce(updateScrollLock, 100), { passive: true });
  }

  function restoreLocation() {
    if (window.location.hash) {
      try {
        document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" });
      } catch (_error) {
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
      }
      return;
    }
    const saved = StorageManager.getScrollPosition();
    if (saved) window.scrollTo(0, saved);
  }

  function finishLoading() {
    const overlay = document.getElementById("loading-overlay");
    if (!overlay) {
      restoreLocation();
      StorageManager.enableScrollListener();
      return;
    }
    overlay.classList.add("fade-out");
    window.setTimeout(() => {
      overlay.remove();
      restoreLocation();
      StorageManager.enableScrollListener();
    }, 500);
  }

  function init(settings) {
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
    finishLoading,
  };
})();

// Mermaid predates the module boundary and calls this hook when closing fullscreen dialogs.
window.updateScrollLock = UIComponentFactory.updateScrollLock;

function reportModuleError(moduleName, error) {
  console.error(`${moduleName} initialization failed`, error);
}

async function main() {
  let settings = null;
  try {
    try {
      StorageManager.init();
    } catch (error) {
      reportModuleError("StorageManager", error);
    }
    try {
      await SettingsModule.loadFonts();
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
      ReaderExtrasModule.init(settings);
    } catch (error) {
      reportModuleError("ReaderExtrasModule", error);
    }
    try {
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
