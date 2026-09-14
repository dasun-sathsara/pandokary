import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const assets = new URL("../assets/", import.meta.url);
const read = (path) => readFileSync(new URL(path, assets), "utf8");
const manifest = JSON.parse(read("themes/manifest.json"));
const declarations = (css) =>
  Object.fromEntries(
    [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
const defaults = declarations(read("base.css"));
let checks = 0;
const ids = manifest.themes.map((theme) => theme.id).sort();
assert.deepEqual(ids, ["lumina", "midnight-fjord", "obsidian", "parchment", "porcelain"]);
for (const [folder, extension] of [
  ["css", ".css"],
  ["mermaid", ".json"],
]) {
  assert.deepEqual(
    readdirSync(new URL(`themes/${folder}/`, assets))
      .filter((file) => file.endsWith(extension))
      .map((file) => file.slice(0, -extension.length))
      .sort(),
    ids,
  );
}

function rgba(value) {
  if (/^#[\da-f]{6}$/i.test(value)) {
    return [...value.slice(1).matchAll(/../g)]
      .map((m) => Number.parseInt(m[0], 16) / 255)
      .concat(1);
  }
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(match, `Unsupported color: ${value}`);
  const numbers = match[1].split(",").map(Number);
  return [...numbers.slice(0, 3).map((n) => n / 255), numbers[3] ?? 1];
}

function composite(front, back) {
  return front
    .slice(0, 3)
    .map((v, i) => v * front[3] + back[i] * (1 - front[3]))
    .concat(1);
}

function luminance(color) {
  const linear = color
    .slice(0, 3)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

for (const theme of manifest.themes) {
  const css = read(`themes/css/${theme.id}.css`);
  const vars = { ...defaults, ...declarations(css) };
  const resolve = (name) => {
    const value = vars[name];
    assert.ok(value, `${theme.id}: missing ${name}`);
    const reference = value.match(/^var\((--[\w-]+)\)$/);
    return reference ? resolve(reference[1]) : value;
  };
  const color = (name) => rgba(resolve(name));
  const check = (front, back, label, minimum = 4.5) => {
    const a = luminance(composite(front, back));
    const b = luminance(back);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(
      ratio >= minimum,
      `${theme.id}: ${label} is ${ratio.toFixed(2)}:1 (needs ${minimum}:1)`,
    );
    checks++;
  };
  for (const surface of [
    "bg",
    "surface",
    "surface-alt",
    "code-bg",
    "code-chrome-bg",
    "accent-subtle",
  ]) {
    const background = color(`--color-${surface}`);
    for (const text of ["text", "text-muted", "strong", "accent", "accent-hover"]) {
      check(color(`--color-${text}`), background, `${text} on ${surface}`);
    }
    check(
      color("--color-inline-code-text"),
      composite(color("--color-inline-code-bg"), background),
      `inline code on ${surface}`,
    );
  }
  // Test headings on primary content surfaces.
  for (const surface of ["bg", "surface", "surface-alt"]) {
    check(color("--color-heading"), color(`--color-${surface}`), `heading on ${surface}`);
  }
  for (const token of [
    "keyword",
    "string",
    "function",
    "number",
    "comment",
    "operator",
    "variable",
  ]) {
    for (const background of ["--color-code-bg", "--focused-line-background"]) {
      check(color(`--code-${token}`), color(background), `${token} on ${background}`);
    }
  }
  check(color("--color-on-accent"), color("--color-accent"), "checkmark", 3);
  check(color("--selection-color"), color("--selection-background"), "selection");
  for (const role of ["success", "danger"]) {
    check(color(`--color-${role}`), color(`--color-${role}-subtle`), role);
  }

  assert.equal(theme.accent, resolve("--color-accent"), `${theme.id}: stale theme swatch`);
  assert.ok(
    css.includes(`color-scheme: ${theme.mode};`),
    `${theme.id}: native control color scheme`,
  );
  const diagram = JSON.parse(read(`themes/mermaid/${theme.id}.json`)).themeVariables;
  assert.equal(diagram.darkMode, theme.mode === "dark");
  for (const [key, token] of Object.entries({
    background: "--color-code-bg",
    primaryColor: "--color-surface",
    primaryTextColor: "--color-text",
    primaryBorderColor: "--color-accent",
    secondaryColor: "--color-surface-alt",
    secondaryTextColor: "--color-text",
    noteBkgColor: "--mermaid-note-fill",
    noteBorderColor: "--mermaid-note-stroke",
    noteTextColor: "--mermaid-note-text",
    actorBkg: "--color-surface",
    actorBorder: "--color-accent",
    actorTextColor: "--color-text",
  })) {
    assert.equal(diagram[key], resolve(token), `${theme.id}: Mermaid ${key} differs from ${token}`);
  }
  for (const [text, fill] of [
    ["primaryTextColor", "primaryColor"],
    ["secondaryTextColor", "secondaryColor"],
    ["noteTextColor", "noteBkgColor"],
  ]) {
    check(rgba(diagram[text]), rgba(diagram[fill]), `Mermaid ${text}`);
  }
}

console.log(
  `${manifest.themes.length} themes: ${checks} contrast checks passed; manifest and diagram palettes agree.`,
);
