PDY.FoldModule = (() => {
  const {
    TOCModule,
    isCompactLayout,
    COMPACT_MEDIA_QUERY,
    eventElement,
    fragmentTarget,
    requestFrame,
  } = PDY;
  const { ICONS, createButton, setButtonTitle } = PDY.UIComponentFactory;
  const SECTION_HEADING_SELECTOR = "main > :is(h1,h2,h3,h4,h5,h6)";
  const VIEWPORT_OFFSET = 96;
  let uid = 0;
  const groups = [];
  const byHeading = new WeakMap();
  const byGroup = new WeakMap();

  function headingLevel(tagName) {
    return Number.parseInt(String(tagName).slice(1), 10);
  }

  function planGroups(levels) {
    const plans = levels.map((level, start) => ({ level, start, end: levels.length }));
    const stack = [];
    plans.forEach((plan, index) => {
      while (stack.length && stack.at(-1).level >= plan.level) stack.pop().end = index;
      stack.push(plan);
    });
    return plans;
  }

  function setCollapsed(entry, collapsed) {
    entry.group.classList.toggle("collapsed", collapsed);
    entry.group.inert = collapsed && !isCompactLayout();
    entry.button.setAttribute("aria-expanded", String(!collapsed));
    setButtonTitle(entry.button, collapsed ? "Expand section" : "Fold section");
  }

  function toggleGroup(entry) {
    setCollapsed(entry, !entry.group.classList.contains("collapsed"));
  }

  function toggleCurrent() {
    if (!groups.length) return null;
    let current = groups[0];
    for (const entry of groups) {
      if (!isVisible(entry.heading)) continue;
      if (entry.heading.getBoundingClientRect().top <= VIEWPORT_OFFSET) current = entry;
      else break;
    }
    toggleGroup(current);
    return current;
  }

  function isVisible(element) {
    return isCompactLayout() || !element.closest(".fold-group.collapsed");
  }

  // Bulk ops skip the collapse animation: N simultaneous grid animations jank
  // on long docs, and an instant switch reads better for "show/hide everything".
  function setAllInstant(collapsed) {
    document.documentElement.classList.add("fold-instant");
    for (const entry of groups) setCollapsed(entry, collapsed);
    void document.documentElement.offsetHeight;
    requestFrame(() => {
      document.documentElement.classList.remove("fold-instant");
    });
  }

  function expandAll() {
    setAllInstant(false);
  }

  function collapseAll() {
    setAllInstant(true);
  }

  function expandAncestors(element) {
    let branch = element.parentElement;
    while (branch) {
      if (branch.classList?.contains("fold-group") && branch.classList.contains("collapsed")) {
        const entry = byGroup.get(branch);
        if (entry) setCollapsed(entry, false);
        else branch.classList.remove("collapsed");
      }
      branch = branch.parentElement;
    }
  }

  // Reveal anything a fragment link points at: collapsed ancestor groups plus,
  // when the target is a section heading, that heading's own content group
  // (groups are siblings that follow their heading, not ancestors of it).
  function revealElement(element) {
    expandAncestors(element);
    const heading = element.closest?.("h1,h2,h3,h4,h5,h6");
    const entry = byHeading.get(heading);
    if (entry) setCollapsed(entry, false);
  }

  function nextGroupId() {
    uid += 1;
    return `fold-group-${uid}`;
  }

  function collectSectionNodes(group, inner, boundary) {
    let node = group.nextSibling;
    while (node && node !== boundary) {
      const next = node.nextSibling;
      inner.append(node);
      node = next;
    }
  }

  function attachFoldControl(heading, group) {
    TOCModule.ensureHeadingID(heading);
    heading.classList.add("foldable");
    const button = createButton("fold-btn", ICONS.caretDown, "Fold section", () => {
      const entry = byHeading.get(heading);
      if (entry) toggleGroup(entry);
    });
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", group.id);
    heading.prepend(button);
    return button;
  }

  function buildGroups(headings) {
    const plans = planGroups(headings.map((heading) => headingLevel(heading.tagName)));
    for (const { start, end, level } of plans) {
      if (level === 1) continue;
      const heading = headings[start];
      const group = document.createElement("div");
      group.className = "fold-group";
      group.id = nextGroupId();
      const inner = document.createElement("div");
      inner.className = "fold-group-inner";
      group.append(inner);
      heading.after(group);
      collectSectionNodes(group, inner, headings[end]);
      if (!inner.querySelector("*")) {
        group.remove();
        continue;
      }
      const button = attachFoldControl(heading, group);
      const entry = { heading, button, group, level };
      groups.push(entry);
      byHeading.set(heading, entry);
      byGroup.set(group, entry);
    }
  }

  function handleFragmentClick(event) {
    const link = eventElement(event)?.closest('a[href^="#"]');
    if (!link || link.classList.contains("heading-anchor")) return;
    const destination = fragmentTarget(link.hash);
    if (destination) revealElement(destination);
  }

  function handleHeadingClick(event) {
    if (isCompactLayout() || window.getSelection()?.toString()) return;
    const target = eventElement(event);
    if (target?.closest("a,button,code,pre,input,textarea,select")) return;
    const entry = byHeading.get(target?.closest(".foldable"));
    if (entry) toggleGroup(entry);
  }

  function init() {
    const main = document.querySelector("main");
    if (!main) return groups;
    buildGroups([...main.querySelectorAll(SECTION_HEADING_SELECTOR)]);
    if (window.location?.hash) {
      const destination = fragmentTarget(window.location.hash);
      if (destination) revealElement(destination);
    }
    document.addEventListener("click", handleFragmentClick, true);
    main.addEventListener("click", handleHeadingClick);
    window.matchMedia(COMPACT_MEDIA_QUERY).addEventListener("change", () => {
      for (const entry of groups) {
        entry.group.inert = entry.group.classList.contains("collapsed") && !isCompactLayout();
      }
    });
    return groups;
  }

  return { init, headingLevel, planGroups, toggleCurrent, expandAll, collapseAll, isVisible };
})();
