if (window.mermaid) {
  try {
    mermaid.initialize({ startOnLoad: false });
  } catch (e) {
    console.error("Failed to initialize Mermaid with startOnLoad: false", e);
  }
}

// Central scroll-locking utility for overlays and drawers (globally scoped)
function updateScrollLock() {
  const isTableMaximized = document.querySelector(".table-scroll-container.maximized") !== null;
  const isMermaidMaximized = document.querySelector(".mermaid-container.maximized") !== null;
  const isLightboxActive = document.querySelector(".lightbox-backdrop") !== null;
  const isTOCOpenMobile = !document.documentElement.classList.contains("toc-collapsed") && window.innerWidth < 1400;

  if (isTableMaximized || isMermaidMaximized || isLightboxActive || isTOCOpenMobile) {
    document.body.classList.add("scroll-locked");
  } else {
    document.body.classList.remove("scroll-locked");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Update scroll lock on resize in case mobile layout state toggles
  window.addEventListener("resize", updateScrollLock, { passive: true });

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
        block.innerHTML = lines.map(line => `<div class="code-line">${line || " "}</div>`).join("");

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
        updateScrollLock();

        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("touchmove", (e) => {
          e.preventDefault();
        }, { passive: false });
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
          updateScrollLock();
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

  // 5. Settings Pop-over Menu
  const settingsToggle = document.createElement("button");
  settingsToggle.className = "floating-toggle settings-toggle";
  settingsToggle.setAttribute("aria-label", "Open appearance settings");
  settingsToggle.setAttribute("aria-haspopup", "true");
  settingsToggle.setAttribute("aria-expanded", "false");
  settingsToggle.title = "Appearance Settings";
  settingsToggle.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="settings-icon">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;
  document.body.appendChild(settingsToggle);

  const settingsPopover = document.createElement("div");
  settingsPopover.className = "settings-popover";
  settingsPopover.setAttribute("role", "dialog");
  settingsPopover.setAttribute("aria-label", "Appearance settings");
  settingsPopover.setAttribute("aria-hidden", "true");
  settingsPopover.innerHTML = `
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
        <button class="theme-option" data-theme-key="light" title="Light Theme">
          <span class="theme-preview-dot light-dot"></span>
          <span class="theme-option-name">Default</span>
        </button>
        <button class="theme-option" data-theme-key="github-light" title="GitHub Light Theme">
          <span class="theme-preview-dot github-light-dot"></span>
          <span class="theme-option-name">GitHub</span>
        </button>
        <button class="theme-option" data-theme-key="warm-light" title="Warm Light Theme">
          <span class="theme-preview-dot warm-light-dot"></span>
          <span class="theme-option-name">Paper</span>
        </button>
        <button class="theme-option" data-theme-key="dark" title="Dark Theme">
          <span class="theme-preview-dot dark-dot"></span>
          <span class="theme-option-name">Obsidian</span>
        </button>
        <button class="theme-option" data-theme-key="vscode-dark" title="VS Code Dark Theme">
          <span class="theme-preview-dot vscode-dark-dot"></span>
          <span class="theme-option-name">VS Code</span>
        </button>
        <button class="theme-option" data-theme-key="ayu-dark" title="Ayu Dark Theme">
          <span class="theme-preview-dot ayu-dark-dot"></span>
          <span class="theme-option-name">Ayu</span>
        </button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-label">Typography</div>
      <div class="font-selector">
        <button class="font-option" data-font-key="studio-feixen">
          Studio Feixen
        </button>
        <button class="font-option" data-font-key="google-sans-flex">
          Google Sans
        </button>
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
    </div>
  `;
  document.body.appendChild(settingsPopover);

  const fontOptions = [
   {
      key: "studio-feixen",
      name: "Studio Feixen Sans",
      body: "'Studio Feixen Sans TRIAL', 'Studio Feixen Sans', sans-serif",
      heading: "'Studio Feixen Sans TRIAL', 'Studio Feixen Sans', sans-serif",
   },
   {
      key: "google-sans-flex",
      name: "Google Sans Flex",
      body: "'Google Sans Flex', sans-serif",
      heading: "'Google Sans Flex', sans-serif",
      opticalSizing: "auto",
      variationSettings: '"slnt" 0, "wdth" 100, "GRAD" 0, "ROND" 0',
   },
  ];

  let activeFontKey = localStorage.getItem("fontChoice") || fontOptions[0].key;
  applyFontPreference(activeFontKey);

  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  setHighlightTheme(currentTheme);
  updateActiveThemeOption(currentTheme);

  // Text Size control handlers
  let fontSizeAdjust = parseInt(localStorage.getItem("font-size-adjust") || "0", 10);
  if (fontSizeAdjust < -4 || fontSizeAdjust > 8) {
    fontSizeAdjust = 0;
  }

  const decFontSizeBtn = settingsPopover.querySelector(".dec-font-size");
  const incFontSizeBtn = settingsPopover.querySelector(".inc-font-size");
  const fontSizeValLabel = settingsPopover.querySelector(".font-size-val");

  function updateFontSizeUI() {
    const pct = Math.round(((18 + fontSizeAdjust) / 18) * 100);
    fontSizeValLabel.textContent = `${pct}%`;
    document.documentElement.style.setProperty("--font-size-adjust", `${fontSizeAdjust}px`);
    localStorage.setItem("font-size-adjust", fontSizeAdjust);
    decFontSizeBtn.disabled = fontSizeAdjust <= -4;
    incFontSizeBtn.disabled = fontSizeAdjust >= 8;
  }

  decFontSizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (fontSizeAdjust > -4) {
      fontSizeAdjust -= 1;
      updateFontSizeUI();
    }
  });

  incFontSizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (fontSizeAdjust < 8) {
      fontSizeAdjust += 1;
      updateFontSizeUI();
    }
  });

  updateFontSizeUI();

  // Layout Width control handlers
  let layoutWidth = parseInt(localStorage.getItem("layout-max-width") || "1040", 10);
  const layoutWidthSteps = [800, 920, 1040, 1160, 1280, 1400];
  if (!layoutWidthSteps.includes(layoutWidth)) {
    layoutWidth = 1040;
  }

  const decLayoutWidthBtn = settingsPopover.querySelector(".dec-layout-width");
  const incLayoutWidthBtn = settingsPopover.querySelector(".inc-layout-width");
  const layoutWidthValLabel = settingsPopover.querySelector(".layout-width-val");

  function updateLayoutWidthUI() {
    layoutWidthValLabel.textContent = `${layoutWidth}px`;
    document.documentElement.style.setProperty("--content-max-width", `${layoutWidth}px`);
    localStorage.setItem("layout-max-width", layoutWidth);
    decLayoutWidthBtn.disabled = layoutWidth <= layoutWidthSteps[0];
    incLayoutWidthBtn.disabled = layoutWidth >= layoutWidthSteps[layoutWidthSteps.length - 1];
  }

  decLayoutWidthBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const currentIndex = layoutWidthSteps.indexOf(layoutWidth);
    if (currentIndex > 0) {
      layoutWidth = layoutWidthSteps[currentIndex - 1];
      updateLayoutWidthUI();
    }
  });

  incLayoutWidthBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const currentIndex = layoutWidthSteps.indexOf(layoutWidth);
    if (currentIndex < layoutWidthSteps.length - 1) {
      layoutWidth = layoutWidthSteps[currentIndex + 1];
      updateLayoutWidthUI();
    }
  });

  updateLayoutWidthUI();

  // Toggle settings popover visibility
  function toggleSettingsPopover(forceState) {
    const isVisible = settingsPopover.classList.contains("active");
    const nextState = typeof forceState === "boolean" ? forceState : !isVisible;
    
    if (nextState) {
      settingsPopover.classList.add("active");
      settingsToggle.classList.add("active");
      settingsToggle.setAttribute("aria-expanded", "true");
      settingsPopover.setAttribute("aria-hidden", "false");
    } else {
      settingsPopover.classList.remove("active");
      settingsToggle.classList.remove("active");
      settingsToggle.setAttribute("aria-expanded", "false");
      settingsPopover.setAttribute("aria-hidden", "true");
    }
  }

  settingsToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettingsPopover();
  });

  settingsPopover.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  const closeSettingsBtn = settingsPopover.querySelector(".close-settings");
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSettingsPopover(false);
    });
  }

  // Click outside to close
  window.addEventListener("click", () => {
    toggleSettingsPopover(false);
  });

  // Escape key to close
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      toggleSettingsPopover(false);
    }
  });

  // Theme selection click handlers
  settingsPopover.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const themeKey = btn.getAttribute("data-theme-key");
      document.documentElement.setAttribute("data-theme", themeKey);
      localStorage.setItem("theme", themeKey);
      setHighlightTheme(themeKey);
      updateActiveThemeOption(themeKey);
      if (typeof updateMermaidTheme === "function") {
        updateMermaidTheme();
      }
    });
  });

  function updateActiveThemeOption(theme) {
    settingsPopover.querySelectorAll(".theme-option").forEach((btn) => {
      if (btn.getAttribute("data-theme-key") === theme) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  // Font selection click handlers
  settingsPopover.querySelectorAll(".font-option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const fontKey = btn.getAttribute("data-font-key");
      applyFontPreference(fontKey);
    });
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

    // Update active font class in UI
    settingsPopover.querySelectorAll(".font-option").forEach((btn) => {
      if (btn.getAttribute("data-font-key") === key) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    localStorage.setItem("fontChoice", font.key);
  }

  function setHighlightTheme(theme) {
    const lightHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css";
    const darkHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css";
    const vscodeHref = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css";

    let nextHref = lightHref;
    if (theme === "vscode-dark") {
      nextHref = vscodeHref;
    } else if (theme === "dark" || theme === "ayu-dark") {
      nextHref = darkHref;
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

  // Auto-hide floating buttons on scroll & save scroll position memory
  let lastScrollTop = 0;
  const scrollThreshold = 10; // minimum scroll distance to toggle state
  let saveScrollTimeout;
  window.addEventListener("scroll", () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const documentHeight = document.documentElement.scrollHeight;
    const viewportHeight = document.documentElement.clientHeight;

    // 1. Save scroll position memory (debounced)
    clearTimeout(saveScrollTimeout);
    saveScrollTimeout = setTimeout(() => {
      localStorage.setItem(`pdy_scroll_${document.title}`, scrollTop);
    }, 150);

    // Prevent bounce/elastic scroll issues at page limits (top and bottom)
    if (scrollTop < 0 || scrollTop + viewportHeight > documentHeight) {
      return;
    }

    // Ignore tiny scroll changes to prevent jitter
    if (Math.abs(scrollTop - lastScrollTop) < scrollThreshold) {
      return;
    }

    const isScrollingDown = scrollTop > lastScrollTop;

    // 2. Settings Toggle auto-hide (mobile only)
    if (window.innerWidth < 768) {
      if (!settingsPopover.classList.contains("active")) {
        if (isScrollingDown && scrollTop > 150) {
          settingsToggle.classList.add("hidden");
        } else {
          settingsToggle.classList.remove("hidden");
        }
      }
    } else {
      settingsToggle.classList.remove("hidden");
    }

    // 3. TOC Toggle auto-hide (mobile only)
    const tocToggle = document.querySelector(".toc-toggle");
    if (tocToggle) {
      if (window.innerWidth < 768) {
        const isTOCOpen = !document.documentElement.classList.contains("toc-collapsed") && window.innerWidth < 1400;
        if (!isTOCOpen) {
          if (isScrollingDown && scrollTop > 150) {
            tocToggle.classList.add("hidden");
          } else {
            tocToggle.classList.remove("hidden");
          }
        } else {
          tocToggle.classList.remove("hidden");
        }
      } else {
        tocToggle.classList.remove("hidden");
      }
    }

    lastScrollTop = scrollTop;
  }, { passive: true });

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

    const tocBackdrop = document.createElement("div");
    tocBackdrop.className = "toc-backdrop";
    document.body.appendChild(tocBackdrop);
    tocBackdrop.addEventListener("touchmove", (e) => {
      e.preventDefault();
    }, { passive: false });

    const tocToggle = document.createElement("button");
    tocToggle.className = "floating-toggle toc-toggle";
    tocToggle.setAttribute("aria-label", "Toggle Table of Contents");

    let tocCollapsed = localStorage.getItem("tocCollapsed") === "true";
    if (window.innerWidth < 1400) {
      tocCollapsed = true; // Always start collapsed on mobile viewports
    }
    
    if (tocCollapsed) {
      document.documentElement.classList.add("toc-collapsed");
      tocToggle.innerText = "📖";
      tocToggle.title = "Show Table of Contents";
    } else {
      tocToggle.innerText = "✖";
      tocToggle.title = "Hide Table of Contents";
    }
    document.body.appendChild(tocToggle);

    function toggleTOC(forceState) {
      const isCurrentlyCollapsed = document.documentElement.classList.contains("toc-collapsed");
      const nextState = typeof forceState === "boolean" ? forceState : !isCurrentlyCollapsed;

      if (nextState) {
        document.documentElement.classList.add("toc-collapsed");
        localStorage.setItem("tocCollapsed", "true");
        tocToggle.innerText = "📖";
        tocToggle.title = "Show Table of Contents";
      } else {
        document.documentElement.classList.remove("toc-collapsed");
        localStorage.setItem("tocCollapsed", "false");
        tocToggle.innerText = "✖";
        tocToggle.title = "Hide Table of Contents";
      }
      
      updateScrollLock();
    }

    tocToggle.addEventListener("click", () => {
      toggleTOC();
    });

    tocBackdrop.addEventListener("click", () => {
      toggleTOC(true);
    });

    // Close sidebar drawer when clicking any TOC link on mobile
    tocList.querySelectorAll(".toc-link").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth < 1400) {
          toggleTOC(true);
        }
      });
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

      const closeBtn = document.createElement("button");
      closeBtn.className = "lightbox-close";
      closeBtn.setAttribute("aria-label", "Close image");
      closeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      const zoomedImg = document.createElement("img");
      zoomedImg.className = "lightbox-img";
      zoomedImg.src = img.src;
      zoomedImg.alt = img.alt || "Zoomed image";

      backdrop.appendChild(closeBtn);
      backdrop.appendChild(zoomedImg);
      document.body.appendChild(backdrop);
      updateScrollLock();
      
      backdrop.addEventListener("touchmove", (e) => {
        e.preventDefault();
      }, { passive: false });

      setTimeout(() => {
        backdrop.classList.add("active");
      }, 10);

      const closeLightbox = () => {
        backdrop.classList.remove("active");
        setTimeout(() => {
          backdrop.remove();
          updateScrollLock();
        }, 300);
      };

      backdrop.addEventListener("click", closeLightbox);
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeLightbox();
      });

      zoomedImg.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      const escHandler = (e) => {
        if (e.key === "Escape") {
          closeLightbox();
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);

      // Pan & Zoom state
      let scale = 1;
      let pointX = 0;
      let pointY = 0;
      let startX = 0;
      let startY = 0;
      let isDragging = false;

      // Touch variables for pinch
      let initialDist = 0;
      let startScale = 1;

      function updateTransform(withTransition) {
        if (withTransition) {
          zoomedImg.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
        } else {
          zoomedImg.style.transition = "none";
        }
        zoomedImg.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
      }

      // Double tap/click to zoom
      zoomedImg.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (scale > 1.5) {
          scale = 1;
          pointX = 0;
          pointY = 0;
        } else {
          scale = 2.5;
          const rect = zoomedImg.getBoundingClientRect();
          const offsetX = e.clientX - rect.left - rect.width / 2;
          const offsetY = e.clientY - rect.top - rect.height / 2;
          pointX = -offsetX * 1.5;
          pointY = -offsetY * 1.5;
        }
        updateTransform(true);
      });

      // Mouse drag panning
      zoomedImg.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX - pointX;
        startY = e.clientY - pointY;
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        updateTransform(false);
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
      });

      // Touch drag & pinch zoom
      zoomedImg.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        if (e.touches.length === 1) {
          isDragging = true;
          startX = e.touches[0].clientX - pointX;
          startY = e.touches[0].clientY - pointY;
        } else if (e.touches.length === 2) {
          isDragging = false;
          initialDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          startScale = scale;
        }
      }, { passive: true });

      zoomedImg.addEventListener("touchmove", (e) => {
        e.stopPropagation();
        if (isDragging && e.touches.length === 1) {
          pointX = e.touches[0].clientX - startX;
          pointY = e.touches[0].clientY - startY;
          updateTransform(false);
        } else if (e.touches.length === 2) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          scale = Math.min(Math.max(startScale * (dist / initialDist), 0.8), 5);
          updateTransform(false);
        }
      }, { passive: true });

      zoomedImg.addEventListener("touchend", () => {
        isDragging = false;
        if (scale < 1) {
          scale = 1;
          pointX = 0;
          pointY = 0;
          updateTransform(true);
        }
      });
    });
  });

  // 10. Heading Hover Anchor Links
  document.querySelectorAll("main h2, main h3, main h4, main h5").forEach((heading) => {
    if (!heading.id) {
      heading.id = heading.textContent.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    heading.classList.add("heading-with-anchor");

    const anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = `#${heading.id}`;
    anchor.innerHTML = "🔗";
    anchor.title = "Copy link to this section";
    anchor.setAttribute("aria-label", `Link to ${heading.textContent}`);

    anchor.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${heading.id}`;
  try {
        await navigator.clipboard.writeText(url);
        history.pushState(null, null, `#${heading.id}`);
        const originalText = anchor.innerHTML;
        anchor.innerHTML = "✔️";
        anchor.classList.add("copied");
      setTimeout(() => {
          anchor.innerHTML = originalText;
          anchor.classList.remove("copied");
        }, 1500);
      } catch (err) {
        console.error("Failed to copy heading link:", err);
    }
    });
    heading.appendChild(anchor);
  });

  // 11. Global Keyboard Shortcuts (Escape to exit maximized views)
  document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
      document.querySelectorAll(".table-scroll-container.maximized").forEach((container) => {
        const btn = container.querySelector(".btn-maximize");
        if (btn) btn.click();
});
      document.querySelectorAll(".mermaid-container.maximized").forEach((container) => {
        const btn = container.querySelector(".btn-maximize");
        if (btn) btn.click();
      });
    }
  });

  // 12. Load and Render Mermaid Diagrams
  try {
    await initMermaid();
  } catch (e) {
    console.error("Failed to load and render Mermaid diagrams:", e);
  } finally {
    // 13. Fade-out and remove the loading spinner/overlay & restore scroll position
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("fade-out");
      setTimeout(() => {
        overlay.remove();
        if (window.location.hash) {
          const target = document.querySelector(window.location.hash);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } else {
          const savedPosition = localStorage.getItem(`pdy_scroll_${document.title}`);
          if (savedPosition) {
            window.scrollTo(0, parseInt(savedPosition, 10));
          }
        }
      }, 500);
    } else {
      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        const savedPosition = localStorage.getItem(`pdy_scroll_${document.title}`);
        if (savedPosition) {
          window.scrollTo(0, parseInt(savedPosition, 10));
        }
      }
    }
  }
});

let mermaidIdCounter = 0;

function initializeMermaid(theme) {
  let config;
  if (theme === "light") {
    config = {
      startOnLoad: false,
      look: "handDrawn",
      theme: "default",
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
      themeVariables: {
        fontFamily: "'Architects Daughter', cursive, sans-serif",
      }
    };
  } else if (theme === "github-light") {
    config = {
      startOnLoad: false,
      look: "handDrawn",
      theme: "base",
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
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
        fontFamily: "'Architects Daughter', cursive, sans-serif",
      }
    };
  } else if (theme === "vscode-dark") {
    config = {
      startOnLoad: false,
      look: "handDrawn",
      theme: "base",
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
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
        fontFamily: "'Architects Daughter', cursive, sans-serif",
      }
    };
  } else if (theme === "warm-light") {
    config = {
      startOnLoad: false,
      look: "handDrawn",
      theme: "base",
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
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
        fontFamily: "'Architects Daughter', cursive, sans-serif",
      }
    };
  } else if (theme === "ayu-dark") {
    config = {
      startOnLoad: false,
      look: "handDrawn",
      theme: "base",
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
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
        fontFamily: "'Architects Daughter', cursive, sans-serif",
      }
    };
  } else {
    config = {
      startOnLoad: false,
      look: "handDrawn",
      theme: "base",
      fontFamily: "'Architects Daughter', cursive, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
      themeVariables: {
        darkMode: true,
        background: '#0B0D12',
        primaryColor: '#14171F',
        primaryBorderColor: '#8B7DFF',
        primaryTextColor: '#E4E7EC',
        secondaryColor: '#1A1E27',
        secondaryBorderColor: 'rgba(255,255,255,0.08)',
        secondaryTextColor: '#E4E7EC',
        tertiaryColor: '#12151C',
        tertiaryBorderColor: 'rgba(255,255,255,0.06)',
        lineColor: '#8A92A6',
        edgeLabelBackground: '#14171F',
        textColor: '#E4E7EC',
        fontFamily: "'Architects Daughter', cursive, sans-serif",
        noteBkgColor: 'rgba(139,125,255,0.12)',
        noteBorderColor: '#8B7DFF',
        noteTextColor: '#E4E7EC',
        clusterBkg: '#101319',
        clusterBorder: 'rgba(255,255,255,0.08)',
        actorBkg: '#14171F',
        actorBorder: '#8B7DFF',
        activationBkgColor: '#1A1E27',
      }
    };
  }
  mermaid.initialize(config);
}

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

    await setupInteractiveDiagram(container, content, viewport, code, zoomInBtn, zoomOutBtn, resetBtn, maximizeBtn, rotateBtn);
  }
}

async function setupInteractiveDiagram(container, content, viewport, code, zoomInBtn, zoomOutBtn, resetBtn, maximizeBtn, rotateBtn) {
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
      const parts = viewBox.split(/[\s,]+/).filter(Boolean).map(Number);
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
        updateScrollLock();

        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        document.body.appendChild(backdrop);
        backdrop.addEventListener("touchmove", (e) => {
          e.preventDefault();
        }, { passive: false });
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
          updateScrollLock();
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
      <div style="color: #ef4444; padding: 1.5rem; font-family: var(--font-mono), monospace; border-left: 4px solid #ef4444; background: var(--color-code-bg); text-align: left;">
        <strong>Mermaid Error:</strong>
        <pre style="border: none; margin: 0; padding: 0.5rem 0; color: #ef4444; background: transparent; font-size: 14px; text-align: left;">${err.message || err}</pre>
      </div>
    `;
  }
}
