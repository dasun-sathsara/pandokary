import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");
const bootstrap = read("template.html").match(/<script>([\s\S]*?)<\/script>/)[1];
const migrations = {
  lumina: "lumina",
  parchment: "parchment",
  obsidian: "obsidian",
  "midnight-fjord": "midnight-fjord",
  primer: "lumina",
  "verdant-paper": "lumina",
  "lilac-frost": "lumina",
  "studio-dark": "obsidian",
  "ayu-mirage": "obsidian",
  boreal: "midnight-fjord",
  unknown: "lumina",
};

function prepaint(preferences, restricted = false) {
  const properties = new Map();
  const document = {
    documentElement: {
      dataset: { theme: "lumina" },
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
assert.equal(prepaint({}, true).theme, "lumina", "Blocked storage keeps a readable theme");
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
vm.runInContext(`${read("app.js")}\nglobalThis.modules = { CodeBlockModule, TOCModule };`, context);
const { CodeBlockModule, TOCModule } = context.modules;
assert.deepEqual([...CodeBlockModule.parseLineRange("1-999999999", 3)], [1, 2, 3]);
assert.deepEqual([...CodeBlockModule.parseLineRange("{3-1,5}", 5)], [1, 2, 3, 5]);
assert.equal(TOCModule.ensureHeadingID({ textContent: "!!!" }), "section-3");
assert.equal(TOCModule.ensureHeadingID({ textContent: "සිංහල" }), "සිංහල-2");
assert.equal(TOCModule.ensureHeadingID({ id: "custom", textContent: "Heading" }), "custom");
console.log(
  "Reader regressions passed: theme migration, restricted storage, bounded ranges, and heading IDs.",
);
