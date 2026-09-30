PDY.TOCModule = (() => {
  const {
    StorageManager,
    isCompactLayout,
    scheduleFrame,
    debounce,
    COMPACT_MEDIA_QUERY,
    fragmentTarget,
  } = PDY;
  const { ICONS, createButton, updateScrollLock } = PDY.UIComponentFactory;

  function ensureHeadingID(heading) {
    if (heading.id) return heading.id;
    const base =
      heading.textContent
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "section";
    let id = base;
    let suffix = 2;
    while (document.getElementById(id)) id = `${base}-${suffix++}`;
    heading.id = id;
    return id;
  }

  function activeHeadingIndex(positions, scrollY) {
    let low = 0;
    let high = positions.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (positions[middle].offset <= scrollY) low = middle + 1;
      else high = middle;
    }
    return positions[Math.max(0, low - 1)]?.index ?? -1;
  }

  function initScrollSpy(headings, aside, list) {
    const links = [...list.querySelectorAll("a")];
    let positions = [];
    let activeIndex = -1;
    const update = () => {
      const index = activeHeadingIndex(positions, window.scrollY + 48);
      if (index === activeIndex) return;
      links[activeIndex]?.classList.remove("active");
      links[activeIndex]?.removeAttribute("aria-current");
      activeIndex = index;
      const link = links[index];
      if (!link) return;
      link.classList.add("active");
      link.setAttribute("aria-current", "location");
      if (aside.inert) return;
      const scrollTarget = aside.querySelector(".toc-sidebar-body") || aside;
      const bounds = scrollTarget.getBoundingClientRect();
      const linkBounds = link.getBoundingClientRect();
      if (linkBounds.top < bounds.top || linkBounds.bottom > bounds.bottom) {
        // Scroll only the navigation, never the document being read.
        scrollTarget.scrollTop += linkBounds.top - bounds.top - scrollTarget.clientHeight / 2;
      }
    };
    const schedule = scheduleFrame(update);
    const measure = () => {
      positions = headings.flatMap((heading, index) =>
        heading.getClientRects().length && PDY.FoldModule.isVisible(heading)
          ? [{ index, offset: heading.getBoundingClientRect().top + window.scrollY }]
          : [],
      );
      schedule();
    };
    const scheduleMeasure = debounce(measure, 100);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(scheduleMeasure).observe(document.body);
    window.addEventListener("load", measure, { once: true });
    measure();
  }

  function init() {
    const headings = [...document.querySelectorAll("main h2,main h3")];
    if (!headings.length) {
      document.documentElement.classList.remove("toc-open");
      return null;
    }
    const aside = document.createElement("aside");
    aside.className = "toc-sidebar";
    aside.id = "document-contents";
    aside.setAttribute("aria-label", "Table of contents");

    const header = document.createElement("div");
    header.className = "toc-header-bar";
    const title = document.createElement("h3");
    title.className = "toc-sidebar-title";
    title.textContent = "Table of Contents";
    const close = createButton("toc-close close-settings", ICONS.x, "Close table of contents");
    header.append(title, close);

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "toc-sidebar-body";
    const list = document.createElement("ul");
    list.className = "toc-list";
    bodyWrap.append(list);

    if (document.querySelector(".fold-group")) {
      const actions = document.createElement("div");
      actions.className = "toc-fold-actions";
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "toc-fold-btn";
      expand.textContent = "Expand all";
      expand.addEventListener("click", () => PDY.FoldModule.expandAll());
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.className = "toc-fold-btn";
      collapse.textContent = "Collapse all";
      collapse.addEventListener("click", () => PDY.FoldModule.collapseAll());
      actions.append(expand, collapse);
      bodyWrap.prepend(actions);
    }
    headings.forEach((heading) => {
      ensureHeadingID(heading);
      const item = document.createElement("li");
      item.className = `toc-item-${heading.tagName.toLowerCase()}`;
      const link = document.createElement("a");
      link.className = "toc-link";
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.textContent;
      item.append(link);
      list.append(item);
    });
    aside.append(header, bodyWrap);
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
    toggle.setAttribute("aria-controls", aside.id);
    document.body.append(toggle);

    let isOpen =
      !isCompactLayout() && StorageManager.getPreference("tocCollapsed", "false") !== "true";
    const setOpen = (value) => {
      PDY.UIComponentFactory.releaseDialog(aside);
      isOpen = value;
      aside.inert = !value;
      aside.setAttribute("aria-hidden", String(!value));
      toggle.setAttribute("aria-expanded", String(value));
      document.documentElement.classList.toggle("toc-open", isOpen);
      toggle.innerHTML = isOpen ? ICONS.x : ICONS.bookOpen;
      PDY.UIComponentFactory.setButtonTitle(
        toggle,
        isOpen ? "Hide Table of Contents" : "Show Table of Contents",
      );
      if (!isCompactLayout()) StorageManager.setPreference("tocCollapsed", !isOpen);
      if (isOpen && isCompactLayout())
        PDY.UIComponentFactory.focusDialog(aside, "Table of contents");
      updateScrollLock();
    };
    toggle.addEventListener("click", () => {
      setOpen(!isOpen);
      if (isOpen && isCompactLayout()) list.querySelector("a")?.focus();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen && isCompactLayout()) {
        setOpen(false);
        toggle.focus();
      }
    });
    close.addEventListener("click", () => {
      setOpen(false);
      toggle.focus();
    });
    window.matchMedia(COMPACT_MEDIA_QUERY).addEventListener("change", () => {
      PDY.UIComponentFactory.releaseDialog(aside);
      setOpen(
        !isCompactLayout() && StorageManager.getPreference("tocCollapsed", "false") !== "true",
      );
    });
    backdrop.addEventListener("click", () => setOpen(false));
    list.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        if (isCompactLayout()) {
          setOpen(false);
          const heading = fragmentTarget(link.hash);
          heading?.setAttribute("tabindex", "-1");
          heading?.focus({ preventScroll: true });
        }
      });
    });
    setOpen(isOpen);
    initScrollSpy(headings, aside, list);
    return { aside, backdrop, toggle, setOpen };
  }

  return { init, ensureHeadingID };
})();
