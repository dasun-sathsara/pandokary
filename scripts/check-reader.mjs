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
assert.match(baseCss, /--font-weight-adjustment: 0/);
assert.match(baseCss, /--body-font-weight-desktop: 400/);
assert.match(baseCss, /--body-font-weight-mobile: 430/);
assert.match(baseCss, /--strong-font-weight-desktop: 550/);
assert.match(baseCss, /--strong-font-weight-mobile: 580/);
assert.match(baseCss, /--heading-font-weight-desktop: 600/);
assert.match(baseCss, /--heading-font-weight-mobile: 630/);
assert.match(baseCss, /--mono-font-weight-desktop: 420/);
assert.match(baseCss, /--mono-font-weight-mobile: 450/);
assert.match(baseCss, /--mono-emphasis-font-weight-desktop: 520/);
assert.match(baseCss, /--mono-emphasis-font-weight-mobile: 550/);
for (const role of [
  "body-font-weight",
  "strong-font-weight",
  "heading-font-weight",
  "mono-font-weight",
  "mono-emphasis-font-weight",
]) {
  assert.match(
    baseCss,
    new RegExp(`--${role}: var\\(--${role}-desktop\\)`),
    `${role} uses the desktop base before JavaScript applies an adjustment`,
  );
}
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
for (const role of [
  "body-font-weight",
  "strong-font-weight",
  "heading-font-weight",
  "mono-font-weight",
  "mono-emphasis-font-weight",
]) {
  assert.match(
    responsiveCss,
    new RegExp(`--${role}: var\\(--${role}-mobile\\)`),
    `${role} uses the compact base before JavaScript applies an adjustment`,
  );
}
for (const theme of [
  "lumina",
  "porcelain",
  "parchment",
  "obsidian",
  "midnight-fjord",
  "evergreen",
]) {
  assert.doesNotMatch(
    read(`themes/css/${theme}.css`),
    /--strong-font-weight(?:-mobile)?\s*:/,
    `${theme} does not override the adjusted strong weight`,
  );
}
const phoneRules =
  responsiveCss.match(/@media \(max-width: 768px\)\s*\{([\s\S]*?)(?=\n\/\* =+|$)/)?.[1] ?? "";
assert.doesNotMatch(phoneRules, /font-family\s*:|font-weight\s*:/);
const bodyTypography = baseCss.match(/(?:^|\n)body\s*\{([^}]+)\n\}/)?.[1];
assert.ok(bodyTypography, "global body typography rule exists");
assert.doesNotMatch(baseCss, /(?:-webkit|-moz)-font-smoothing\s*:/);
assert.match(baseCss, /--scale-code-inline: 0\.87em;/);
assert.match(baseCss, /--scale-code-block: 0\.87em;/);
assert.match(baseCss, /--letter-spacing-mono: -0\.01em;/);
const appJs = read("app.js");
const templateHtml = read("template.html");
assert.match(appJs, /type="number"[^>]*min="-100"[^>]*max="100"[^>]*font-weight-input/);
assert.match(
  appJs,
  /<label class="control-name" for="font-weight-adjustment">Weight Adjustment<\/label>/,
);
assert.match(appJs, /id="font-weight-adjustment"[^>]*type="number"/);
assert.doesNotMatch(appJs, /stepper-unit|in points/);
assert.match(appJs, /event\.propertyName === "visibility"/);
assert.match(appJs, /focusDialog\(panel, "Appearance settings"\)/);
assert.match(responsiveCss, /font-weight-input[\s\S]*?min-height: 44px/);
assert.match(appJs, /fontWeightAdjustment: "font-weight-adjustment"/);
assert.match(appJs, /getAdjustedFontWeights/);
assert.doesNotMatch(appJs, /calc\(var\(--[a-z-]+-font-weight-desktop\)/);
assert.match(appJs, /pointerType !== "touch"/);
assert.match(appJs, /navigator\.vibrate/);
assert.match(templateHtml, /\$if\(reading-minutes\)/);
assert.match(templateHtml, /ph-timer reading-time-icon/);
assert.match(templateHtml, /aria-hidden="true" focusable="false"/);
assert.doesNotMatch(appJs, /ph-clock/);
assert.doesNotMatch(appJs, /label\.className = "reading-time"/);
assert.doesNotMatch(appJs, /main\.textContent\.trim\(\)\.split/);
const fontLoader = appJs.match(/async function loadDocumentFonts\(\) \{([\s\S]*?)\n[ ]{2}\}/)?.[1];
assert.ok(fontLoader, "document font loader exists");
assert.match(fontLoader, /'Studio Feixen Sans'/);
assert.match(fontLoader, /'Geist Mono'/);
assert.match(fontLoader, /'Noto Sans Sinhala'/);
assert.match(fontLoader, /\[400, 550, 600\]/);
assert.match(fontLoader, /\[420, 520\]/);
assert.match(fontLoader, /\[400, 420, 520, 540, 550, 580, 600\]/);
assert.doesNotMatch(fontLoader, /window\.matchMedia|Android Trial|Mobile Trial/);
assert.match(templateHtml, /<html lang="\$if\(lang\)\$\$lang\$\$else\$en\$endif\$"/);
const inlineFilter = read("inline-assets.lua");
const unicodeWordRanges = read("unicode-word-ranges.lua");
assert.match(inlineFilter, /bundle_fonts\(concatenate\(stylesheet_files\)\)/);
assert.match(inlineFilter, /read_asset\("unicode-word-ranges\.lua"\)/);
assert.match(inlineFilter, /math\.floor\(\(low \+ high\) \/ 2\)/);
assert.match(unicodeWordRanges, /^-- Unicode data version: 16\.0\.0\./m);
assert.match(unicodeWordRanges, /30-39,41-5A,61-7A/);
assert.doesNotMatch(inlineFilter, /return codepoint >= 0xC0/);
assert.match(inlineFilter, /pandoc\.Pandoc\(doc\.blocks, \{\}\)/);
assert.match(inlineFilter, /is_word_codepoint/);
assert.match(inlineFilter, /Image = function\(image\)/);
assert.match(inlineFilter, /Figure = function\(figure\)/);
assert.match(inlineFilter, /Str = function/);
assert.match(inlineFilter, /READING_WORDS_PER_MINUTE = 238/);
assert.match(inlineFilter, /doc\.meta\["reading-minutes"\] = nil/);
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

const bootstrap = templateHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
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

function prepaint(preferences, restricted = false, viewportWidth = 1440) {
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
    innerWidth: viewportWidth,
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
  "font-weight-adjustment": "999",
  "layout-max-width": "9999",
});
assert.equal(invalid.properties.get("--font-size-adjust"), "8px");
assert.equal(invalid.properties.get("--font-weight-adjustment"), "100");
assert.equal(invalid.properties.get("--body-font-weight"), "500");
assert.equal(invalid.properties.get("--strong-font-weight"), "650");
assert.equal(invalid.properties.get("--heading-font-weight"), "700");
assert.equal(invalid.properties.get("--mono-font-weight"), "520");
assert.equal(invalid.properties.get("--mono-emphasis-font-weight"), "620");
assert.equal(invalid.properties.has("--content-max-width"), false);
assert.equal(
  prepaint({ "font-weight-adjustment": "-999" }).properties.get("--body-font-weight"),
  "300",
);
const thinnerDesktop = prepaint({ "font-weight-adjustment": "-30" }).properties;
assert.equal(thinnerDesktop.get("--font-weight-adjustment"), "-30");
assert.equal(thinnerDesktop.get("--body-font-weight"), "370");
assert.equal(thinnerDesktop.get("--strong-font-weight"), "520");
assert.equal(thinnerDesktop.get("--heading-font-weight"), "570");
assert.equal(thinnerDesktop.get("--mono-font-weight"), "390");
assert.equal(thinnerDesktop.get("--mono-emphasis-font-weight"), "490");
const thinnerMobile = prepaint({ "font-weight-adjustment": "-30" }, false, 390).properties;
assert.equal(thinnerMobile.get("--body-font-weight"), "400");
assert.equal(thinnerMobile.get("--strong-font-weight"), "550");
assert.equal(thinnerMobile.get("--heading-font-weight"), "600");
assert.equal(thinnerMobile.get("--mono-font-weight"), "420");
assert.equal(thinnerMobile.get("--mono-emphasis-font-weight"), "520");
assert.equal(
  prepaint({ "font-weight-adjustment": "invalid" }).properties.get("--font-weight-adjustment"),
  "0",
);

const ids = new Set(["section", "section-2", "සිංහල"]);
const hapticCalls = [];
const vibrateAttempts = [];
let hapticNow = 1000;
let vibrateMode = "success";
let pointerDownHandler;
const registeredEvents = [];
const navigatorMock = {
  vibrate(pattern) {
    vibrateAttempts.push({ mode: vibrateMode, pattern });
    if (vibrateMode === "throw") throw new Error("Vibration failed");
    if (vibrateMode === "false") return false;
    hapticCalls.push(pattern);
    return true;
  },
};
const context = vm.createContext({
  window: {},
  Date: { now: () => hapticNow },
  navigator: navigatorMock,
  document: {
    readyState: "loading",
    addEventListener(type, handler, options) {
      registeredEvents.push({ type, handler, options });
      if (type === "pointerdown") pointerDownHandler = handler;
    },
    getElementById: (id) => ids.has(id),
  },
});
vm.runInContext(
  `${read("app.js")}\nglobalThis.modules = { CodeBlockModule, TOCModule, SectionLinkModule, FoldModule, TableModule, HapticFeedback, SettingsModule };`,
  context,
);
const {
  CodeBlockModule,
  TOCModule,
  SectionLinkModule,
  FoldModule,
  TableModule,
  HapticFeedback,
  SettingsModule,
} = context.modules;
assert.deepEqual(JSON.parse(JSON.stringify(SettingsModule.getAdjustedFontWeights(-30, false))), {
  "body-font-weight": 370,
  "strong-font-weight": 520,
  "heading-font-weight": 570,
  "mono-font-weight": 390,
  "mono-emphasis-font-weight": 490,
});
assert.deepEqual(JSON.parse(JSON.stringify(SettingsModule.getAdjustedFontWeights(-30, true))), {
  "body-font-weight": 400,
  "strong-font-weight": 550,
  "heading-font-weight": 600,
  "mono-font-weight": 420,
  "mono-emphasis-font-weight": 520,
});
function fakeControl({ inputType, role, disabled = false, ariaDisabled = false } = {}) {
  const marker = inputType ? `input[type="${inputType}"]` : role ? `[role="${role}"]` : "button";
  return {
    disabled,
    getAttribute(name) {
      if (name === "role") return role || null;
      if (name === "aria-disabled") return ariaDisabled ? "true" : null;
      return null;
    },
    matches(selector) {
      if (selector === ":disabled") return disabled;
      return selector.includes(marker);
    },
    closest(selector) {
      return selector.includes(marker) ? this : null;
    },
    querySelector() {
      return null;
    },
  };
}

const touchButton = fakeControl();
const touchCheckbox = fakeControl({ inputType: "checkbox" });
const taskLabel = {
  get control() {
    return touchCheckbox;
  },
  querySelector() {
    return touchCheckbox;
  },
};
const labelTextTarget = {
  closest(selector) {
    return selector === "label" ? taskLabel : null;
  },
};
const roleButton = fakeControl({ role: "button" });
const disabledButton = fakeControl({ disabled: true });
const ariaDisabledButton = fakeControl({ role: "button", ariaDisabled: true });
const noTarget = { closest: () => null };
const pointerEvent = (target, pointerType = "touch", isPrimary = true) => ({
  target,
  pointerType,
  isPrimary,
});
const dispatchPointer = (event) => pointerDownHandler(event);

HapticFeedback.init();
const pointerRegistration = registeredEvents.find(({ type }) => type === "pointerdown");
assert.ok(pointerDownHandler, "haptics register a pointerdown listener");
assert.equal(pointerRegistration.options.passive, true, "the haptic listener is passive");

dispatchPointer(pointerEvent(touchButton));
assert.deepEqual(hapticCalls, [8], "touch buttons receive a short selection pulse");

hapticNow += 100;
dispatchPointer(pointerEvent(touchButton, "mouse"));
dispatchPointer(pointerEvent(touchButton, "touch", false));
dispatchPointer(pointerEvent(noTarget));
dispatchPointer(pointerEvent(disabledButton));
dispatchPointer(pointerEvent(ariaDisabledButton));
assert.deepEqual(hapticCalls, [8], "mouse, secondary pointers, and disabled targets stay silent");

hapticNow += 100;
dispatchPointer(pointerEvent(labelTextTarget));
assert.deepEqual(hapticCalls, [8, 12], "task label text resolves to its checkbox impact");

hapticNow += 100;
dispatchPointer(pointerEvent(roleButton));
assert.deepEqual(hapticCalls, [8, 12, 8], "role-button images receive haptic feedback");

hapticNow += 100;
dispatchPointer(pointerEvent(touchButton));
const attemptsBeforeDebounce = vibrateAttempts.length;
dispatchPointer(pointerEvent(touchButton));
assert.equal(
  vibrateAttempts.length,
  attemptsBeforeDebounce,
  "rapid secondary touches are debounced",
);

hapticNow += 100;
vibrateMode = "false";
const callsBeforeRejectedPulse = hapticCalls.length;
dispatchPointer(pointerEvent(touchButton));
assert.equal(
  hapticCalls.length,
  callsBeforeRejectedPulse,
  "a rejected vibration remains a safe no-op",
);

hapticNow += 100;
vibrateMode = "throw";
assert.doesNotThrow(
  () => dispatchPointer(pointerEvent(touchButton)),
  "a throwing vibration implementation does not break the control",
);
delete navigatorMock.vibrate;
assert.equal(HapticFeedback.trigger(), false, "missing vibration support remains a no-op");
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
  "Reader regressions passed: theme migration, restricted storage, bounded typography ranges, mobile haptics, reading-time metadata, heading IDs, section links, fold planning, and smart table column sizing.",
);
