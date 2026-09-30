PDY.TableModule = (() => {
  const { scheduleFrame, runFeature } = PDY;
  const { ICONS, closeModal, createButton, openModal, setButtonTitle } = PDY.UIComponentFactory;
  const shadowUpdaters = new Set();
  let resizeTimer;
  let resizeBound = false;

  function bindResizeUpdates() {
    if (resizeBound || window.ResizeObserver) return;
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

  function isNumericText(text) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return (
      /^[+-]?[$\u20AC\u00A3\u00A5]?\s*[\d,]+(?:\.\d+)?\s*(?:%|[a-z]{1,4})?$/i.test(trimmed) ||
      /^\d{1,5}$/.test(trimmed) ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(trimmed)
    );
  }

  function isCellShort(cell, maxLen = 22) {
    if (!cell) return true;
    if (cell.querySelector("br, p, ul, ol, blockquote, pre, table")) return false;
    const text = cell.textContent.trim().replace(/\s+/g, " ");
    return text.length <= maxLen;
  }

  function getColumnStats(rows, colIndex) {
    let total = 0;
    let totalLen = 0;
    let numeric = 0;
    let allShort = true;

    for (const row of rows) {
      const cell = row.children[colIndex];
      const text = cell?.textContent.trim().replace(/\s+/g, " ");
      if (!text) continue;
      total += 1;
      totalLen += text.length;
      if (isNumericText(text)) numeric += 1;
      if (allShort && !isCellShort(cell, 22)) allShort = false;
    }

    return { total, avgLen: total ? totalLen / total : 0, numeric, allShort };
  }

  function isColumnCompact(header, stats) {
    if (stats.total === 0 || !stats.allShort) return false;
    const headerText = header?.textContent.trim().replace(/\s+/g, " ") || "";
    return headerText.length <= 22 && stats.avgLen <= 16;
  }

  function markColumn(header, rows, index, classes) {
    header?.classList.add(...classes);
    for (const row of rows) row.children[index]?.classList.add(...classes);
  }

  function autoAlignColumns(table) {
    const rows = [...table.querySelectorAll("tbody tr")];
    if (!rows.length) return;
    const headerCells = [...table.querySelectorAll("thead th")];
    const colCount = rows.reduce(
      (count, row) => Math.max(count, row.children.length),
      headerCells.length,
    );

    for (let c = 0; c < colCount; c++) {
      const header = headerCells[c];
      const stats = getColumnStats(rows, c);
      const isNumeric = stats.total > 0 && stats.numeric / stats.total >= 0.75;

      const classes = [];
      if (isNumeric && !header?.getAttribute("align") && !header?.style.textAlign)
        classes.push("col-numeric");
      if (isNumeric || isColumnCompact(header, stats)) classes.push("col-compact");
      markColumn(header, rows, c, classes);
    }
  }

  function initTable(table) {
    if (table.closest(".table-scroll-container")) return;
    autoAlignColumns(table);
    const container = document.createElement("div");
    container.className = "table-scroll-container";
    const actions = document.createElement("div");
    actions.className = "table-actions";
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrapper";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", table.caption?.textContent || "Scrollable table");
    const left = document.createElement("div");
    const right = document.createElement("div");
    left.className = "scroll-shadow left";
    right.className = "scroll-shadow right";
    let observer;

    const updateShadows = () => {
      if (!document.body.contains(wrapper)) {
        observer?.disconnect();
        shadowUpdaters.delete(updateShadows);
        return;
      }
      const canScroll = wrapper.scrollWidth > wrapper.clientWidth;
      container.classList.toggle("is-scrollable", canScroll);
      left.style.opacity = wrapper.scrollLeft > 2 ? "1" : "0";
      right.style.opacity =
        wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth - 2 ? "1" : "0";
    };

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
    table.before(container);
    wrapper.append(table);
    container.append(actions, wrapper, left, right);
    const scheduleShadows = scheduleFrame(updateShadows);
    wrapper.addEventListener("scroll", scheduleShadows, { passive: true });
    if (typeof window.ResizeObserver === "function") {
      observer = new window.ResizeObserver(updateShadows);
      observer.observe(wrapper);
    } else {
      shadowUpdaters.add(updateShadows);
    }
    window.setTimeout(updateShadows, 100);
  }

  function init() {
    bindResizeUpdates();
    document.querySelectorAll("main table").forEach((table) => {
      runFeature("Table", () => initTable(table));
    });
  }

  return {
    init,
    autoAlignColumns,
    getColumnStats,
    isCellShort,
    isColumnCompact,
    isNumericText,
  };
})();
