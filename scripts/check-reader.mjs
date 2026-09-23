import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");
const baseCss = read("base.css");
const fontFaceBlocks = [...baseCss.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, block]) => block);
const expectedFaces = [
  ["Studio Feixen Sans", "fonts/StudioFeixenSans-Variable.woff2", "100 900", "normal"],
  ["Studio Feixen Sans", "fonts/StudioFeixenSans-Variable.woff2", "100 900", "italic"],
  ["Geist Mono", "fonts/GeistMono-Variable.ttf", "100 900", "normal"],
  ["Geist Mono", "fonts/GeistMono-Variable-Italic.ttf", "100 900", "italic"],
  ["Noto Sans Sinhala", "fonts/NotoSansSinhala-Variable.ttf", "400", "normal"],
];
for (const [family, filename, weight, style] of expectedFaces) {
  const face = fontFaceBlocks.find(
    (block) =>
      block.includes(`font-family: "${family}";`) &&
      block.includes(`url("${filename}")`) &&
      block.includes(`font-weight: ${weight};`) &&
      block.includes(`font-style: ${style};`),
  );
  assert.ok(face, `${family} ${style} face declares the expected role weight and source`);
  assert.ok(
    statSync(new URL(`../assets/${filename}`, import.meta.url)).size > 1000,
    `${filename} bundled variable font exists`,
  );
  if (family === "Noto Sans Sinhala") {
    assert.match(face, /size-adjust: 88%/);
    assert.match(face, /font-stretch: 62.5% 100%/);
    assert.match(face, /unicode-range: U\+0D80-0DFF/);
  }
  if (family === "Studio Feixen Sans" && style === "italic") {
    assert.match(face, /font-variation-settings: "ital" 1/);
  }
}
const sinhalaFaces = fontFaceBlocks.filter(
  (block) =>
    block.includes('font-family: "Noto Sans Sinhala";') &&
    block.includes('url("fonts/NotoSansSinhala-Variable.ttf")'),
);
const sinhalaWeightMap = sinhalaFaces
  .map((block) => {
    const declared = block.match(/font-weight:\s*(\d+)\s*;/)?.[1];
    const actual = block.match(/font-variation-settings:\s*"wght"\s*(\d+)/)?.[1];
    return [Number(declared), Number(actual)];
  })
  .sort(([a], [b]) => a - b);
assert.deepEqual(sinhalaWeightMap, [
  [400, 400],
  [420, 400],
  [520, 540],
  [550, 540],
  [600, 580],
]);
assert.doesNotMatch(sinhalaFaces.join("\n"), /font-weight:\s*100\s+900/);
assert.match(baseCss, /--font-body:[\s\S]*?"Studio Feixen Sans", "Noto Sans Sinhala"/);
assert.match(baseCss, /--font-mono: "Geist Mono", "Noto Sans Sinhala", monospace/);
assert.match(baseCss, /--body-font-weight-desktop: 400/);
assert.match(baseCss, /--body-font-weight-mobile: 430/);
assert.match(baseCss, /--strong-font-weight: 550/);
assert.match(baseCss, /--strong-font-weight-mobile: 580/);
assert.match(baseCss, /--heading-font-weight-desktop: 600/);
assert.match(baseCss, /--heading-font-weight-mobile: 630/);
assert.match(baseCss, /--mono-font-weight-desktop: 420/);
assert.match(baseCss, /--mono-font-weight-mobile: 450/);
assert.match(baseCss, /--mono-emphasis-font-weight-desktop: 520/);
assert.match(baseCss, /--mono-emphasis-font-weight-mobile: 550/);
const uncommentedBaseCss = baseCss.replace(/\/\*[\s\S]*?\*\//g, "");
const languageRules = [...uncommentedBaseCss.matchAll(/([^{}]*:lang\(si\)[^{}]*)\{([^{}]*)\}/g)];
assert.ok(languageRules.length > 0, "language-aware Sinhala rules remain available");
for (const [, selector, declarations] of languageRules) {
  assert.doesNotMatch(
    declarations,
    /font-weight\s*:/,
    `${selector.trim()} must not override Latin/Mono CSS roles`,
  );
}
assert.match(
  baseCss,
  /:lang\(si\):not\(code\):not\(code \*\)[\s\S]*?letter-spacing: normal !important/,
);
assert.doesNotMatch(baseCss, /Noto Serif Sinhala|NotoSerifSinhala/);
assert.doesNotMatch(baseCss, /Android Trial|Mobile Trial|TheFont-/);

const fontsDirectory = readdirSync(new URL("../assets/fonts/", import.meta.url));
assert.deepEqual(
  fontsDirectory.filter((name) => /^(TheFont|.*Trial)/.test(name)),
  [],
  "generated and trial cuts are not packaged",
);
for (const filename of ["LICENSE-Geist-Mono-OFL.txt", "LICENSE-Noto-Sans-Sinhala-OFL.txt"]) {
  assert.ok(statSync(new URL(`../assets/fonts/${filename}`, import.meta.url)).size > 1000);
}

const responsiveCss = read("components/responsive.css");
assert.doesNotMatch(responsiveCss, /font-body-phone|font-mono-phone|weight-phone/);
const phoneRules =
  responsiveCss.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)(?=\n\/\* =+|$)/)?.[1] ?? "";
assert.doesNotMatch(phoneRules, /font-family|font-weight/);
const bodyTypography = baseCss.match(/(?:^|\n)body\s*\{([^}]+)\n\}/)?.[1];
assert.ok(bodyTypography, "global body typography rule exists");
assert.doesNotMatch(baseCss, /(?:-webkit|-moz)-font-smoothing\s*:/);
assert.match(baseCss, /--scale-code-inline: 0\.87em;/);
assert.match(baseCss, /--scale-code-block: 0\.87em;/);
assert.match(baseCss, /--letter-spacing-mono: -0\.01em;/);
const appJs = read("app.js");
const fontLoader = appJs.match(/async function loadDocumentFonts\(\) \{([\s\S]*?)\n[ ]{2}\}/)?.[1];
assert.ok(fontLoader, "document font loader exists");
assert.match(fontLoader, /'Studio Feixen Sans'/);
assert.match(fontLoader, /'Geist Mono'/);
assert.match(fontLoader, /'Noto Sans Sinhala'/);
assert.match(fontLoader, /\[400, 550, 600\]/);
assert.match(fontLoader, /\[420, 520\]/);
assert.match(fontLoader, /\[400, 420, 520, 540, 550, 580, 600\]/);
assert.doesNotMatch(fontLoader, /window\.matchMedia|Android Trial|Mobile Trial/);
assert.match(read("template.html"), /<html lang="\$if\(lang\)\$\$lang\$\$else\$en\$endif\$"/);
const inlineFilter = read("inline-assets.lua");
assert.match(inlineFilter, /bundle_fonts\(concatenate\(stylesheet_files\)\)/);
assert.match(inlineFilter, /"font\/woff2"/);
assert.match(inlineFilter, /"font\/ttf"/);
assert.match(inlineFilter, /required pdy font not found/);

const readerCss = read("components/reader.css");
const kbdRule = readerCss.match(/(?:^|\n)kbd\s*\{([\s\S]*?)\n\}/)?.[1];
assert.ok(kbdRule, "keyboard shortcut rule exists");
assert.match(kbdRule, /font-family:\s*var\(--font-mono\)/);
assert.match(kbdRule, /font-size:\s*var\(--scale-code-inline,\s*0\.87em\)/);
assert.match(kbdRule, /font-weight:\s*var\(--mono-font-weight,\s*420\)/);
assert.match(kbdRule, /letter-spacing:\s*var\(--letter-spacing-mono,\s*-0\.01em\)/);

const mermaidJs = read("mermaid.js");
const renderError = mermaidJs.match(
  /function createRenderError\(error\)\s*\{([\s\S]*?)\n {2}\}/,
)?.[1];
assert.ok(renderError, "Mermaid error renderer exists");
assert.match(renderError, /font-size: var\(--scale-code-inline, 0\.87em\)/);
assert.match(renderError, /font-weight: var\(--mono-font-weight, 420\)/);
assert.match(renderError, /letter-spacing: var\(--letter-spacing-mono, -0\.01em\)/);
assert.match(renderError, /mono-emphasis-font-weight, 520/);
assert.doesNotMatch(renderError, /font-size: 14px/);

const bootstrap = read("template.html").match(/<script>([\s\S]*?)<\/script>/)[1];
const migrations = {
  lumina: "lumina",
  porcelain: "porcelain",
  parchment: "parchment",
  obsidian: "obsidian",
  "midnight-fjord": "midnight-fjord",
  evergreen: "evergreen",
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
const invalid = prepaint({
  "font-size-adjust": "999",
  "layout-max-width": "9999",
});
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
  `${read("app.js")}\nglobalThis.modules = { CodeBlockModule, TOCModule, SectionLinkModule, FoldModule, TableModule };`,
  context,
);
const { CodeBlockModule, TOCModule, SectionLinkModule, FoldModule, TableModule } = context.modules;
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

const mockTableRows = [
  {
    children: [
      { textContent: "IS 4990", querySelector: () => null },
      { textContent: "Comprehensive Group Project", querySelector: () => null },
      { textContent: "10.0", querySelector: () => null },
      { textContent: "100% CA", querySelector: () => null },
      {
        textContent: "Year-long flagship capstone project with enterprise software architecture",
        querySelector: () => null,
      },
    ],
  },
  {
    children: [
      { textContent: "IS 4650", querySelector: () => null },
      { textContent: "Software Management", querySelector: () => null },
      { textContent: "2.5", querySelector: () => null },
      { textContent: "40% CA / 60% WE", querySelector: () => null },
      {
        textContent: "Agile SDLC governance and resource planning",
        querySelector: () => null,
      },
    ],
  },
];

const mockHeaders = [
  { textContent: "Module Code" },
  { textContent: "Module Name" },
  { textContent: "Credits" },
  { textContent: "Evaluation" },
  { textContent: "Academic Focus & Strategic Value for Career" },
];

const stats0 = TableModule.getColumnStats(mockTableRows, 0);
assert.equal(
  TableModule.isColumnCompact(mockHeaders[0], stats0),
  true,
  "Module Code column must be compact",
);

const stats1 = TableModule.getColumnStats(mockTableRows, 1);
assert.equal(
  TableModule.isColumnCompact(mockHeaders[1], stats1),
  false,
  "Module Name column must not be compact",
);

const stats2 = TableModule.getColumnStats(mockTableRows, 2);
assert.equal(
  TableModule.isColumnCompact(mockHeaders[2], stats2),
  true,
  "Credits column must be compact",
);
assert.equal(stats2.numeric / stats2.total >= 0.75, true, "Credits column must be numeric");

const stats3 = TableModule.getColumnStats(mockTableRows, 3);
assert.equal(
  TableModule.isColumnCompact(mockHeaders[3], stats3),
  true,
  "Evaluation column must be compact",
);

const stats4 = TableModule.getColumnStats(mockTableRows, 4);
assert.equal(
  TableModule.isColumnCompact(mockHeaders[4], stats4),
  false,
  "Academic Focus column must not be compact",
);

const multilineRow = [
  {
    children: [
      {
        textContent: "• IS 4990 • IS 3920",
        querySelector: () => ({ tagName: "BR" }),
      },
    ],
  },
];
const multilineStats = TableModule.getColumnStats(multilineRow, 0);
assert.equal(
  TableModule.isColumnCompact({ textContent: "Modules" }, multilineStats),
  false,
  "Multiline cells must not be compact",
);

console.log(
  "Reader regressions passed: theme migration, restricted storage, bounded ranges, heading IDs, section links, fold planning, and smart table column sizing.",
);
