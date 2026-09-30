PDY.SectionLinkModule = (() => {
  const { TOCModule } = PDY;
  const HEADING_NUMBER = /^\s*(\d+[A-Za-z]?(?:\.\d+[A-Za-z]?)*)\b/;
  const REF_SOURCE =
    "§§?\\s*\\d+[A-Za-z]?(?:\\.\\d+[A-Za-z]?)*(?:\\s*[–—-]\\s*\\d+[A-Za-z]?(?:\\.\\d+[A-Za-z]?)*)?";
  const FIRST_NUMBER = /\d+[A-Za-z]?(?:\.\d+[A-Za-z]?)*/;
  const LEADING_MARKS = /^§§?\s*/;
  const SKIP_SELECTOR = "pre,code,a,script,style";

  function extractHeadingNumber(text) {
    const match = String(text).match(HEADING_NUMBER);
    return match ? match[1] : null;
  }

  function buildSectionMap(headings) {
    const map = new Map();
    for (const heading of headings) {
      const number = extractHeadingNumber(heading.textContent);
      if (!number || !heading.id || map.has(number)) continue;
      map.set(number, heading.id);
    }
    return map;
  }

  function findSectionRefs(text, sectionMap) {
    const pattern = new RegExp(REF_SOURCE, "g");
    const refs = [];
    for (const match of text.matchAll(pattern)) {
      const first = match[0].match(FIRST_NUMBER);
      const section = first ? first[0] : null;
      const target = section ? sectionMap.get(section) : undefined;
      refs.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        display: match[0].replace(LEADING_MARKS, ""),
        section,
        target: target || null,
      });
    }
    return refs;
  }

  function linkifyTextNode(node, sectionMap) {
    const text = node.nodeValue;
    if (!text?.includes("§")) return false;
    const refs = findSectionRefs(text, sectionMap).filter((ref) => ref.target);
    if (!refs.length) return false;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const ref of refs) {
      if (ref.start > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, ref.start)));
      }
      const link = document.createElement("a");
      link.className = "section-link";
      link.href = `#${encodeURIComponent(ref.target)}`;
      link.textContent = ref.display;
      link.setAttribute("aria-label", `Link to section ${ref.section}`);
      fragment.append(link);
      cursor = ref.end;
    }
    if (cursor < text.length) {
      fragment.append(document.createTextNode(text.slice(cursor)));
    }
    node.parentNode.replaceChild(fragment, node);
    return true;
  }

  function ensureHeadingIDs(headings) {
    for (const heading of headings) {
      if (!heading.id) TOCModule.ensureHeadingID(heading);
    }
  }

  function collectCandidateNodes(main) {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue?.includes("§")) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIP_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function init() {
    const main = document.querySelector("main");
    if (!main) return null;
    const headings = [...main.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    ensureHeadingIDs(headings);
    const sectionMap = buildSectionMap(headings);
    if (!sectionMap.size) return sectionMap;
    for (const node of collectCandidateNodes(main)) {
      try {
        linkifyTextNode(node, sectionMap);
      } catch (error) {
        console.error("Section link failed", error);
      }
    }
    return sectionMap;
  }

  return { init, extractHeadingNumber, buildSectionMap, findSectionRefs };
})();
