PDY.SettingsModule = (() => {
  const {
    StorageManager,
    isCompactLayout,
    clamp,
    COMPACT_MEDIA_QUERY,
    PHONE_MEDIA_QUERY,
    runFeature,
  } = PDY;
  const { ICONS, focusDialog, releaseDialog, updateScrollLock } = PDY.UIComponentFactory;
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
    let timer;
    try {
      await Promise.race([
        fontLoads,
        new Promise((resolve) => {
          timer = window.setTimeout(resolve, 2000);
        }),
      ]);
    } finally {
      window.clearTimeout(timer);
    }
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
    const phoneMedia = window.matchMedia(PHONE_MEDIA_QUERY);
    let dialogActive = false;
    let focusSequence = 0;
    let focusTimer;
    let focusTransitionListener;
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
    const cancelFocusWait = () => {
      window.clearTimeout(focusTimer);
      if (focusTransitionListener) {
        panel.removeEventListener("transitionend", focusTransitionListener);
        focusTransitionListener = null;
      }
    };
    const focusVisiblePanel = () => {
      const sequence = focusSequence;
      const finish = () => {
        cancelFocusWait();
        if (sequence !== focusSequence) return;
        if (!panel.classList.contains("active")) return;
        if (phoneMedia.matches) {
          focusDialog(panel, "Appearance settings");
          dialogActive = true;
        } else {
          closeButton?.focus({ preventScroll: true });
        }
      };
      focusTransitionListener = (event) => {
        if (event.target === panel && event.propertyName === "visibility") finish();
      };
      panel.addEventListener("transitionend", focusTransitionListener);
      focusTimer = window.setTimeout(finish, 400);
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
      cancelFocusWait();
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

  const LEGACY_THEMES = Object.freeze({
    primer: "lumina",
    "verdant-paper": "lumina",
    "lilac-frost": "lumina",
    "studio-dark": "obsidian",
    "ayu-mirage": "obsidian",
    boreal: "midnight-fjord",
  });

  function applyTheme(requested, panel = document.getElementById("appearance-panel")) {
    const candidate = LEGACY_THEMES[requested] || requested;
    const theme = getThemes().some((entry) => entry.id === candidate) ? candidate : "porcelain";
    const changed = document.documentElement.dataset.theme !== theme;
    document.documentElement.dataset.theme = theme;
    StorageManager.setPreference("theme", theme);
    panel?.querySelectorAll(".theme-option").forEach((button) => {
      const selected = button.dataset.themeKey === theme;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    if (changed) void runFeature("Mermaid theme", () => PDY.MermaidModule?.updateTheme());
  }

  function cycleTheme() {
    const themes = getThemes();
    const index = themes.findIndex((theme) => theme.id === document.documentElement.dataset.theme);
    applyTheme(themes[(index + 1) % themes.length].id);
  }

  function bindThemeControls(panel) {
    panel.querySelectorAll(".theme-option").forEach((button) => {
      button.addEventListener("click", () => applyTheme(button.dataset.themeKey, panel));
    });
    applyTheme(StorageManager.getPreference("theme", "porcelain"), panel);
  }

  function bindFontSizeControls(panel) {
    let size = clamp(
      Number.parseInt(StorageManager.getPreference("fontSizeAdjust", "0"), 10) || 0,
      -4,
      8,
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
      size = clamp(size - 1, -4, 8);
      update();
    });
    increase.addEventListener("click", () => {
      size = clamp(size + 1, -4, 8);
      update();
    });
    window.matchMedia(COMPACT_MEDIA_QUERY).addEventListener("change", update);
    update();
  }

  function bindFontWeightControls(panel) {
    const stored = Number.parseInt(StorageManager.getPreference("fontWeightAdjustment", "0"), 10);
    let adjustment = Number.isFinite(stored)
      ? clamp(stored, FONT_WEIGHT_ADJUSTMENT_MIN, FONT_WEIGHT_ADJUSTMENT_MAX)
      : 0;
    const decrease = panel.querySelector(".dec-font-weight");
    const increase = panel.querySelector(".inc-font-weight");
    const input = panel.querySelector(".font-weight-input");
    const update = (requested, persist = true) => {
      const parsed = Number.parseInt(requested, 10);
      adjustment = Number.isFinite(parsed)
        ? clamp(parsed, FONT_WEIGHT_ADJUSTMENT_MIN, FONT_WEIGHT_ADJUSTMENT_MAX)
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
    window.matchMedia(COMPACT_MEDIA_QUERY).addEventListener("change", () => {
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

  return { init, loadFonts, getAdjustedFontWeights, cycleTheme };
})();
