import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");
const bootstrap = read("template.html").match(/<script>([\s\S]*?)<\/script>/)[1];
const migrations = {
  lumina: "lumina",
  porcelain: "porcelain",
  parchment: "parchment",
  obsidian: "obsidian",
  "midnight-fjord": "midnight-fjord",
  primer: "lumina",
  "verdant-paper": "lumina",
  "lilac-frost": "lumina",
  "studio-dark": "obsidian",
  "ayu-mirage": "obsidian",
  boreal: "midnight-fjord",
  unknown: "porcelain",
};

function prepaint(preferences, restricted = false) {
  const properties = new Map();
  const document = {
    documentElement: {
      dataset: { theme: "porcelain" },
      classList: { add() {} },
      style: { setProperty: (key, value) => properties.set(key, value) },
    },
  };
  vm.runInNewContext(bootstrap, {
    document,
    innerWidth: 1440,
    setTimeout() {},
    localStorage: {
      getItem(key) {
        if (restricted) throw new Error("Storage unavailable");
        return preferences[key] ?? null;
      },
    },
  });
  return { theme: document.documentElement.dataset.theme, properties };
}

for (const [saved, expected] of Object.entries(migrations)) {
  assert.equal(prepaint({ theme: saved }).theme, expected, `Saved theme ${saved}`);
}
assert.equal(prepaint({}, true).theme, "porcelain", "Blocked storage keeps a readable theme");
const invalid = prepaint({ "font-size-adjust": "999", "layout-max-width": "9999" });
assert.equal(invalid.properties.get("--font-size-adjust"), "8px");
assert.equal(invalid.properties.has("--content-max-width"), false);

const ids = new Set(["section", "section-2", "සිංහල"]);
const context = vm.createContext({
  window: {},
  document: {
    readyState: "loading",
    addEventListener() {},
    getElementById: (id) => ids.has(id),
  },
});
vm.runInContext(
  `${read("app.js")}\nglobalThis.modules = { CodeBlockModule, TOCModule, SectionLinkModule, FoldModule };`,
  context,
);
const { CodeBlockModule, TOCModule, SectionLinkModule, FoldModule } = context.modules;
assert.deepEqual([...CodeBlockModule.parseLineRange("1-999999999", 3)], [1, 2, 3]);
assert.deepEqual([...CodeBlockModule.parseLineRange("{3-1,5}", 5)], [1, 2, 3, 5]);
assert.equal(TOCModule.ensureHeadingID({ textContent: "!!!" }), "section-3");
assert.equal(TOCModule.ensureHeadingID({ textContent: "සිංහල" }), "සිංහල-2");
assert.equal(TOCModule.ensureHeadingID({ id: "custom", textContent: "Heading" }), "custom");
assert.equal(SectionLinkModule.extractHeadingNumber("2.1 Top-level size"), "2.1");
assert.equal(SectionLinkModule.extractHeadingNumber("2B.3 Git status"), "2B.3");
assert.equal(SectionLinkModule.extractHeadingNumber("7. Implementation"), "7");
assert.equal(SectionLinkModule.extractHeadingNumber("Why GitHub is wrong"), null);
const sectionMap = SectionLinkModule.buildSectionMap([
  { textContent: "1. TL;DR", id: "tldr" },
  { textContent: "2.1 Top-level size", id: "top-level-size" },
  { textContent: "2.1 Duplicate", id: "duplicate" },
  { textContent: "No number", id: "no-number" },
  { textContent: "3. Missing id", id: "" },
]);
assert.equal(sectionMap.get("1"), "tldr");
assert.equal(sectionMap.get("2.1"), "top-level-size");
assert.equal(sectionMap.has("3"), false);
const refs = SectionLinkModule.findSectionRefs(
  "see §7.2, and §7.1–7.5, plus §99.",
  new Map([
    ["7.2", "install"],
    ["7.1", "exclude"],
  ]),
);
assert.equal(refs.length, 3);
assert.equal(refs[0].text, "§7.2");
assert.equal(refs[0].display, "7.2");
assert.equal(refs[0].target, "install");
assert.equal(refs[1].text, "§7.1–7.5");
assert.equal(refs[1].display, "7.1–7.5");
assert.equal(refs[1].section, "7.1");
assert.equal(refs[1].target, "exclude");
assert.equal(refs[2].target, null);
assert.equal(FoldModule.headingLevel("H1"), 1);
assert.equal(FoldModule.headingLevel("H4"), 4);
assert.deepEqual(
  FoldModule.planGroups([2, 3, 3, 2]).map((group) => [group.start, group.end]),
  [
    [0, 3],
    [1, 2],
    [2, 3],
    [3, 4],
  ],
);
assert.deepEqual(
  FoldModule.planGroups([1, 2, 3, 2]).map((group) => [group.start, group.end]),
  [
    [0, 4],
    [1, 3],
    [2, 3],
    [3, 4],
  ],
);
console.log(
  "Reader regressions passed: theme migration, restricted storage, bounded ranges, heading IDs, section links, and fold planning.",
);
