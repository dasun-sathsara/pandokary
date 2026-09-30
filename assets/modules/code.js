PDY.CodeBlockModule = (() => {
  const { PHONE_MEDIA_QUERY, scheduleFrame, runFeature, eventElement } = PDY;
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
    const line = document.createElement("div");
    line.className = "code-line";
    line.dataset.line = String(index + 1);
    if (highlightedLines.has(index + 1)) line.classList.add("highlighted-line");
    if (isDiff) {
      const stripped = lineContent.textContent.trim();
      if (stripped.startsWith("+")) line.classList.add("diff-addition");
      else if (stripped.startsWith("-")) line.classList.add("diff-deletion");
      else if (stripped.startsWith("@@")) line.classList.add("diff-meta");
    }
    line.append(lineContent.childNodes.length ? lineContent : document.createTextNode(" "));
    return line;
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
    let feedbackTimer;
    pre.append(
      createButton("copy-btn", `${ICONS.copy}<span>Copy</span>`, "Copy code", async (event) => {
        const button = event.currentTarget;
        window.clearTimeout(feedbackTimer);
        button.disabled = true;
        try {
          await copyText(plainCode);
          button.innerHTML = `${ICONS.check}<span>Copied!</span>`;
          button.classList.add("success");
          setButtonTitle(button, "Code copied");
        } catch (error) {
          console.error("Copy failed", error);
          button.textContent = "Copy failed";
          setButtonTitle(button, "Could not copy code");
        } finally {
          button.disabled = false;
        }
        feedbackTimer = window.setTimeout(() => {
          button.innerHTML = `${ICONS.copy}<span>Copy</span>`;
          button.classList.remove("success");
          setButtonTitle(button, "Copy code");
        }, 2000);
      }),
    );
  }

  function splitCodeLines(code) {
    const lines = [document.createDocumentFragment()];
    const parents = [];
    const append = (node) => (parents.at(-1) || lines.at(-1)).append(node);
    const nextLine = () => {
      lines.push(document.createDocumentFragment());
      // Reopen the actual ancestor nodes rather than interpreting HTML tags.
      for (let index = 0; index < parents.length; index++) {
        const clone = parents[index].cloneNode(false);
        (parents[index - 1] || lines.at(-1)).append(clone);
        parents[index] = clone;
      }
    };
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const parts = node.textContent.split(/\r?\n/);
        parts.forEach((part, index) => {
          if (index) nextLine();
          append(document.createTextNode(part));
        });
        return;
      }
      const clone = node.cloneNode(false);
      append(clone);
      parents.push(clone);
      for (const child of node.childNodes) visit(child);
      parents.pop();
    };
    for (const node of code.childNodes) visit(node);
    if (!lines.at(-1).textContent.trim()) lines.pop();
    return lines;
  }

  function highlightCode(code, pre) {
    const classes = [...code.classList, ...pre.classList];
    const language =
      classes.find((name) => name.startsWith("language-"))?.slice(9) ||
      classes.find((name) => window.hljs?.getLanguage(name));
    if (language) code.classList.add(`language-${language.toLowerCase()}`);
    code.classList.add("hljs");
    // Pandoc places fence languages on <pre>. Unlabelled fences remain plain text.
    if (language && window.hljs?.getLanguage(language))
      runFeature("Syntax highlighting", () => window.hljs.highlightElement(code));
  }

  function initBlock(code) {
    if (code.dataset.pdyCodeInitialized === "true") return;
    const pre = code.parentElement;
    if (!pre) return;
    code.dataset.pdyCodeInitialized = "true";
    const plainCode = code.textContent.replace(/\r?\n$/, "");
    highlightCode(code, pre);

    const highlightedLines = parseLineRange(getLineSpec(pre, code), plainCode.split("\n").length);
    const isDiff =
      code.classList.contains("language-diff") || pre.classList.contains("language-diff");
    const lines = splitCodeLines(code);

    const gutter = document.createElement("div");
    gutter.className = "code-gutter";
    gutter.setAttribute("aria-hidden", "true");
    for (let index = 0; index < lines.length; index++) {
      const line = document.createElement("span");
      line.className = "code-gutter-line";
      line.dataset.line = String(index + 1);
      line.textContent = String(index + 1);
      if (highlightedLines.has(index + 1)) line.classList.add("highlighted-line");
      gutter.append(line);
    }

    const scrollArea = document.createElement("div");
    scrollArea.className = "code-scroll-area";

    const formatted = document.createDocumentFragment();
    lines.forEach((line, index) => {
      formatted.append(formatSingleCodeLine(line, index, highlightedLines, isDiff));
    });
    code.replaceChildren(formatted);

    scrollArea.append(code);
    pre.replaceChildren(gutter, scrollArea);

    pre.addEventListener("click", (event) => {
      const target = eventElement(event)?.closest(".code-line, .code-gutter-line");
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
