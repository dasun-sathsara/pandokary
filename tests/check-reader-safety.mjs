import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { readReaderSource } from "./reader-source.mjs";

const appJs = readReaderSource();

function readerContext(document, window = {}) {
  const errors = [];
  const context = vm.createContext({
    document: { readyState: "loading", addEventListener() {}, ...document },
    window,
    console: { error: (...args) => errors.push(args), warn() {} },
  });
  vm.runInContext(
    `${appJs}\nglobalThis.reader = { main, StorageManager, HapticFeedback, FoldModule, SettingsModule, CodeBlockModule, TableModule, TaskListModule, TOCModule, SectionLinkModule, ReaderExtrasModule };`,
    context,
  );
  return { reader: context.reader, errors };
}

function fakeElement() {
  return {
    children: [],
    attributes: {},
    innerHTML: "",
    textContent: "",
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    append(...children) {
      this.children.push(...children);
    },
  };
}

function checkMissingImageLabel() {
  const label = '<img src="x" onerror="window.injected = true"> & missing image';
  let fallback;
  const image = {
    alt: label,
    src: "file:///missing.png",
    complete: true,
    naturalWidth: 0,
    closest: () => null,
    replaceWith: (element) => {
      fallback = element;
    },
  };
  const { reader } = readerContext({
    querySelectorAll: () => [image],
    createElement: fakeElement,
  });
  reader.ReaderExtrasModule.initLightbox();
  assert.ok(fallback, "a missing image is replaced with a fallback");
  assert.equal(fallback.attributes["aria-label"], label);
  assert.ok(!fallback.innerHTML.includes(label), "image alt text must never be inserted as HTML");
  assert.ok(
    fallback.children.some((element) => element.textContent === label),
    "the fallback displays the literal alt text, including markup characters",
  );
}

async function checkFailedMermaidStartup() {
  const calls = [];
  const { reader, errors } = readerContext(
    {},
    {
      mermaid: {
        initialize() {
          throw new Error("Mermaid initialization failed");
        },
      },
    },
  );
  for (const [name, module] of Object.entries(reader)) {
    if (name === "main") continue;
    module.init = () => calls.push(name);
  }
  reader.SettingsModule.loadFonts = async () => {};
  reader.ReaderExtrasModule.revealDocument = () => calls.push("reveal");
  reader.ReaderExtrasModule.finishLoading = () => calls.push("finish");
  await reader.main();
  for (const name of ["CodeBlockModule", "TOCModule", "ReaderExtrasModule", "reveal", "finish"]) {
    assert.ok(calls.includes(name), `${name} still runs when Mermaid initialization fails`);
  }
  assert.ok(errors.length > 0, "the optional library failure is reported");
}

function checkMathJaxIgnoresProseDollars() {
  // Pandoc already parses dollar math and emits \(...\) and \[...\]. A "$" delimiter would
  // make MathJax typeset ordinary prose such as "$5 and $10".
  const window = {};
  vm.runInNewContext(
    readFileSync(new URL("../assets/scripts/mathjax-config.js", import.meta.url), "utf8"),
    {
      window,
    },
  );
  const { inlineMath, displayMath } = window.MathJax.tex;
  const delimiters = JSON.parse(JSON.stringify([...inlineMath, ...displayMath])).flat();
  assert.ok(
    !delimiters.some((delimiter) => delimiter.includes("$")),
    "dollar signs are not math delimiters",
  );
  assert.deepEqual(JSON.parse(JSON.stringify(inlineMath)), [["\\(", "\\)"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(displayMath)), [["\\[", "\\]"]]);
}

function checkSavedScrollRestoresInstantly() {
  // The stylesheet sets scroll-behavior: smooth; a restored position must not animate from the top.
  const scrolls = [];
  const window = {
    location: { hash: "" },
    localStorage: { getItem: () => "1500", setItem() {} },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: () => 0,
    scrollTo: (...args) => scrolls.push(args),
  };
  const { reader } = readerContext({ title: "Notes", getElementById: () => null }, window);
  reader.ReaderExtrasModule.finishLoading();
  assert.equal(scrolls.length, 1, "the saved position is restored once");
  assert.deepEqual(JSON.parse(JSON.stringify(scrolls[0])), [{ top: 1500, behavior: "instant" }]);
}

let failures = 0;
for (const check of [
  checkMissingImageLabel,
  checkFailedMermaidStartup,
  checkMathJaxIgnoresProseDollars,
  checkSavedScrollRestoresInstantly,
]) {
  try {
    await check();
  } catch (error) {
    failures += 1;
    console.error(`${check.name}: ${error.message}`);
  }
}
assert.equal(failures, 0, "reader safety regressions failed");
console.log(
  "Reader safety regressions passed: literal image labels, isolated library failures, prose dollar signs, and instant scroll restoration.",
);
