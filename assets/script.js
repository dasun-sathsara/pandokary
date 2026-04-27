document.addEventListener("DOMContentLoaded", () => {
  // --- Code highlighting ---
  document.querySelectorAll("pre code").forEach((block) => {
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
    } else {
      console.warn("Highlight.js is unavailable; skipping highlight pass.");
    }
  });

  // --- Copy buttons ---
  document.querySelectorAll("pre > code").forEach((block) => {
    const button = document.createElement("button");
    button.className = "copy-btn";
    button.innerText = "Copy";
    block.parentNode.style.position = "relative";
    block.parentNode.appendChild(button);

    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(block.innerText);
        button.innerText = "Copied!";
        setTimeout(() => (button.innerText = "Copy"), 1500);
      } catch (err) {
        console.error("Failed to copy code: ", err);
      }
    });
  });

  // --- Theme Toggle ---
  const themeToggle = document.createElement("button");
  themeToggle.className = "floating-toggle theme-toggle";
  themeToggle.setAttribute("aria-label", "Toggle theme");
  document.body.appendChild(themeToggle);

  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);
  setHighlightTheme(currentTheme);
  updateThemeIcon(currentTheme);

  themeToggle.addEventListener("click", () => {
    const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    setHighlightTheme(newTheme);
    updateThemeIcon(newTheme);
  });

  // --- Font Toggle ---
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
  ];

  let activeFontKey = localStorage.getItem("fontChoice") || fontOptions[0].key;
  applyFontPreference(activeFontKey);

  fontToggle.addEventListener("click", () => {
    const currentIndex = fontOptions.findIndex((font) => font.key === activeFontKey);
    const nextFont = fontOptions[(currentIndex + 1) % fontOptions.length];
    applyFontPreference(nextFont.key);
  });

  function applyFontPreference(key) {
    const font = fontOptions.find((option) => option.key === key) || fontOptions[0];
    activeFontKey = font.key;
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
    const nextHref = theme === "dark" ? darkHref : lightHref;

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
    themeToggle.innerText = theme === "dark" ? "☀️" : "🌙";
  }
});

document.addEventListener("DOMContentLoaded", () => {
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
});
