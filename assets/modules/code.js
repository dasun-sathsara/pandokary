PDY.CodeBlockModule = (() => {
  const { PHONE_MEDIA_QUERY, scheduleFrame, runFeature } = PDY;
  const { ICONS, copyText, createButton, setButtonTitle } = PDY.UIComponentFactory;
  // Phone query must match the ≤768px CSS section styling these classes.
  const phoneMedia = window.matchMedia ? window.matchMedia(PHONE_MEDIA_QUERY) : null;

  function parseLineRange(spec, lineCount = 100000) {
    const lines = new Set();
    if (!spec) return lines;
    const cleaned = String(spec).replace(/[{}]/g, "").replace(/line-/gi, "");
    for (const part of cleaned.split(",")) {
      const match = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!match) continue;
      const start = Number.parseInt(match[1], 10);
      const end = Number.parseInt(match[2] || match[1], 10);
      for (
        let line = Math.min(start, end);
        line <= Math.min(Math.max(start, end), lineCount);
        line += 1
      ) {
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
    return `<div class="${classes.join(" ")}" data-line="${index + 1}">${lineContent || " "}</div>`;
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
          button.setAttribute("aria-expanded", String(expanded));
          button.innerHTML = expanded
            ? `${ICONS.caretUp}<span>Show Less</span>`
            : `${ICONS.caretDown}<span>Show More</span>`;
          setButtonTitle(button, expanded ? "Collapse code" : "Expand code");
          if (!expanded)
            pre.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
              block: "nearest",
            });
        },
      ),
    );
    holder.querySelector("button").setAttribute("aria-expanded", "false");
    pre.after(holder);
  }

  function addScrollAffordance(element) {
    const update = () => {
      const phone = phoneMedia ? phoneMedia.matches : false;
      const canScroll = phone && element.scrollWidth > element.clientWidth + 2;
      element.classList.toggle("is-scrollable", canScroll);
      element.classList.toggle("at-left", canScroll && element.scrollLeft <= 2);
      element.classList.toggle(
        "at-right",
        canScroll && element.scrollLeft >= element.scrollWidth - element.clientWidth - 2,
      );
      if (canScroll && !element.hasAttribute("tabindex")) {
        element.tabIndex = 0;
        element.setAttribute("role", "region");
        element.setAttribute("aria-label", "Scrollable code");
      }
    };
    const scheduleUpdate = scheduleFrame(update);
    element.addEventListener("scroll", scheduleUpdate, { passive: true });
    if (phoneMedia?.addEventListener) phoneMedia.addEventListener("change", scheduleUpdate);
    if (window.ResizeObserver) new ResizeObserver(scheduleUpdate).observe(element);
    window.setTimeout(scheduleUpdate, 100);
  }

  function addCopyControl(pre, plainCode) {
    pre.append(
      createButton("copy-btn", `${ICONS.copy}<span>Copy</span>`, "Copy code", async (event) => {
        const button = event.currentTarget;
        try {
          await copyText(plainCode);
          button.innerHTML = `${ICONS.check}<span>Copied!</span>`;
          button.classList.add("success");
          setButtonTitle(button, "Code copied");
        } catch (error) {
          console.error("Copy failed", error);
          button.textContent = "Copy failed";
          setButtonTitle(button, "Could not copy code");
        }
        window.setTimeout(() => {
          button.innerHTML = `${ICONS.copy}<span>Copy</span>`;
          button.classList.remove("success");
          setButtonTitle(button, "Copy code");
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
    const classes = [...code.classList, ...pre.classList];
    const language =
      classes.find((name) => name.startsWith("language-"))?.slice(9) ||
      classes.find((name) => window.hljs?.getLanguage(name));
    if (language) code.classList.add(`language-${language.toLowerCase()}`);
    code.classList.add("hljs");
    // Pandoc places fence languages on <pre>. Unlabelled fences remain plain text.
    if (language && window.hljs?.getLanguage(language)) window.hljs.highlightElement(code);

    const highlightedLines = parseLineRange(getLineSpec(pre, code), plainCode.split("\n").length);
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

    const gutter = document.createElement("div");
    gutter.className = "code-gutter";
    gutter.setAttribute("aria-hidden", "true");
    gutter.innerHTML = lines
      .map((_, i) => {
        const lineNum = i + 1;
        const lineClasses = ["code-gutter-line"];
        if (highlightedLines.has(lineNum)) lineClasses.push("highlighted-line");
        return `<span class="${lineClasses.join(" ")}" data-line="${lineNum}">${lineNum}</span>`;
      })
      .join("");

    const scrollArea = document.createElement("div");
    scrollArea.className = "code-scroll-area";

    code.innerHTML = lines
      .map((line, index) => formatSingleCodeLine(line, index, highlightedLines, isDiff))
      .join("");

    scrollArea.append(code);
    pre.innerHTML = "";
    pre.append(gutter, scrollArea);

    pre.addEventListener("click", (event) => {
      const target = event.target.closest(".code-line, .code-gutter-line");
      if (!target) return;
      const lineNum = target.dataset.line;
      if (!lineNum) return;
      const lineElem = pre.querySelector(`.code-line[data-line="${lineNum}"]`);
      const gutterElem = pre.querySelector(`.code-gutter-line[data-line="${lineNum}"]`);
      lineElem?.classList.toggle("focused-line");
      gutterElem?.classList.toggle("focused-line");
    });
    addCollapseControl(pre, lines.length);
    addCopyControl(pre, plainCode);
    addScrollAffordance(scrollArea);
  }

  function init() {
    document.querySelectorAll("pre:not(.mermaid) code").forEach((code) => {
      runFeature("Code block", () => initBlock(code));
    });
  }

  return { init, parseLineRange };
})();
