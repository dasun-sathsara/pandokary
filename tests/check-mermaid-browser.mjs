import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Real Mermaid and browser layout are required to catch label measurement and
// pointer-coordinate regressions. Install agent-browser before running this check.
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "pdy-mermaid-"));
const output = join(directory, "audit.html");
const session = `pdy-mermaid-${process.pid}`;
const offline = process.argv.includes("--offline");
const browser = (...args) => {
  const result = JSON.parse(
    execFileSync("agent-browser", ["--session", session, "--json", ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 60000,
    }),
  );
  assert.ok(result.success, JSON.stringify(result.error));
  return result.data;
};
const evaluate = (callback) => browser("eval", `(${callback.toString()})()`).result;
let failures = 0;
const check = (name, callback) => {
  try {
    const result = evaluate(callback);
    assert.ok(result.pass, JSON.stringify(result));
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
};

try {
  execFileSync(
    "go",
    [
      "run",
      "./cmd/pdy",
      "--no-fmt",
      "--export",
      "--asset-mode",
      offline ? "offline" : "cdn",
      "testdata/mermaid-audit.md",
      output,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 120000,
    },
  );
  browser("--allow-file-access", "open", `file://${output}`);
  if (offline) {
    browser("set", "offline", "on");
    browser("reload");
  }
  browser(
    "wait",
    "--fn",
    "document.querySelectorAll('.mermaid-content svg').length === 10 && document.querySelector('.mermaid-content details') !== null",
  );
  evaluate(() => {
    window.diagramAudit = {
      container: document.querySelector(".mermaid-container"),
      inertElements: [...document.querySelectorAll("[inert]")],
      frame: () => new Promise((resolve) => requestAnimationFrame(resolve)),
      settle: () => new Promise((resolve) => setTimeout(resolve, 450)),
    };
    const { container } = window.diagramAudit;
    container.scrollIntoView({ block: "center" });
    window.diagramAudit.viewport = container.querySelector(".mermaid-viewport");
    window.diagramAudit.content = container.querySelector(".mermaid-content");
    window.diagramAudit.matrix = () => {
      const { content } = diagramAudit;
      const translation = new DOMMatrixReadOnly(getComputedStyle(content).transform);
      const svg = content.querySelector("svg");
      const scale = Number.parseFloat(content.style.width) / svg.viewBox.baseVal.width;
      return new DOMMatrixReadOnly([scale, 0, 0, scale, translation.e, translation.f]);
    };
    window.diagramAudit.pointer = (type, id, x, y, pointerType = "mouse") => {
      diagramAudit.viewport.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType,
          button: 0,
          buttons: ["pointerup", "pointercancel"].includes(type) ? 0 : 1,
          clientX: x,
          clientY: y,
        }),
      );
    };
    window.diagramAudit.view = () => {
      const { viewport, content, matrix } = diagramAudit;
      const m = matrix();
      const { width, height } = content.querySelector("svg").viewBox.baseVal;
      const fit = Math.min(
        (viewport.clientWidth - 48) / width,
        (viewport.clientHeight - 48) / height,
        1,
      );
      return {
        zoom: m.a / fit,
        x: (viewport.clientWidth / 2 - m.e) / (m.a * width),
        y: (viewport.clientHeight / 2 - m.f) / (m.a * height),
      };
    };
  });

  check("ten diagram types fit their SVG viewBox without clipping", () => {
    const diagrams = [...document.querySelectorAll(".mermaid-content svg")];
    const invalid = diagrams.filter((svg) => {
      const content = svg.parentElement;
      const viewport = content.parentElement.getBoundingClientRect();
      const rectangle = svg.getBoundingClientRect();
      return (
        !svg.viewBox.baseVal.width ||
        !svg.viewBox.baseVal.height ||
        Math.abs(
          Number.parseFloat(content.style.width) / Number.parseFloat(content.style.height) -
            svg.viewBox.baseVal.width / svg.viewBox.baseVal.height,
        ) > 0.01 ||
        rectangle.left < viewport.left - 1 ||
        rectangle.right > viewport.right + 1 ||
        rectangle.top < viewport.top - 1 ||
        rectangle.bottom > viewport.bottom + 1
      );
    });
    return {
      pass: diagrams.length === 10 && !invalid.length,
      invalid: invalid.map((svg) => svg.id),
    };
  });

  check("source-defined node colors survive reader CSS", () => {
    const shape = diagramAudit.content.querySelector(".sourceStyle rect");
    return {
      pass: !!shape && getComputedStyle(shape).fill === "rgb(255, 240, 192)",
      fill: shape && getComputedStyle(shape).fill,
    };
  });

  check("labels retain the font size used during Mermaid layout", () => {
    const svg = diagramAudit.content.querySelector("svg");
    const expected = Number.parseFloat(getComputedStyle(svg).fontSize);
    const labels = [...svg.querySelectorAll(".nodeLabel, .nodeLabel p, text, tspan")].filter(
      (element) => element.textContent.trim(),
    );
    const sizes = labels.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    return {
      pass: sizes.length > 0 && sizes.every((size) => Math.abs(size - expected) < 0.1),
      expected,
      sizes,
    };
  });

  check("zoom redraws the SVG viewport at the requested resolution", async () => {
    const { container, content, frame } = diagramAudit;
    const svg = content.querySelector("svg");
    const before = svg.clientWidth;
    for (let step = 0; step < 7; step++) container.querySelector(".btn-zoom-in").click();
    await frame();
    const transform = new DOMMatrixReadOnly(getComputedStyle(content).transform);
    const result = {
      pass:
        svg.clientWidth > before * 4 &&
        transform.a === 1 &&
        transform.d === 1 &&
        !getComputedStyle(content).willChange.includes("transform"),
      before,
      after: svg.clientWidth,
      cssScale: transform.a,
      willChange: getComputedStyle(content).willChange,
    };
    container.querySelector(".btn-zoom-reset").click();
    await frame();
    return result;
  });

  check("embedded diagrams can be dragged after zooming", async () => {
    const { container, viewport, content, frame } = diagramAudit;
    container.querySelector(".btn-zoom-in").click();
    await frame();
    const before = new DOMMatrixReadOnly(getComputedStyle(content).transform);
    const rectangle = viewport.getBoundingClientRect();
    for (const [type, x, y, buttons] of [
      ["pointerdown", 100, 100, 1],
      ["pointermove", 180, 140, 1],
      ["pointerup", 180, 140, 0],
    ]) {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 71,
          pointerType: "mouse",
          button: 0,
          buttons,
          clientX: rectangle.left + x,
          clientY: rectangle.top + y,
        }),
      );
    }
    await frame();
    const after = new DOMMatrixReadOnly(getComputedStyle(content).transform);
    return {
      pass: Math.abs(after.e - before.e - 80) < 1 && Math.abs(after.f - before.f - 40) < 1,
      dx: after.e - before.e,
      dy: after.f - before.f,
    };
  });

  check("theme changes preserve the current diagram view", async () => {
    const { content, settle } = diagramAudit;
    const before = getComputedStyle(content).transform;
    document.documentElement.dataset.theme = "obsidian";
    await PDY.MermaidModule.updateTheme();
    await settle();
    const after = getComputedStyle(content).transform;
    return { pass: before === after, before, after };
  });

  check("fullscreen restores the embedded view", async () => {
    const { container, content, frame, settle } = diagramAudit;
    container.querySelector(".btn-zoom-in").click();
    await frame();
    const before = getComputedStyle(content).transform;
    container.querySelector(".btn-maximize").click();
    await settle();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    return {
      pass:
        before === getComputedStyle(content).transform &&
        !document.body.classList.contains("scroll-locked"),
      before,
      after: getComputedStyle(content).transform,
    };
  });

  // Exercise trusted browser mouse input in addition to synthetic multi-pointer events.
  const point = evaluate(() => {
    diagramAudit.container.scrollIntoView({ block: "center" });
    diagramAudit.beforeMouse = diagramAudit.matrix();
    const r = diagramAudit.viewport.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  browser("mouse", "move", String(point.x), String(point.y));
  browser("mouse", "down");
  browser("mouse", "move", String(point.x + 50), String(point.y + 30));
  browser("mouse", "up");
  check("real mouse input pans and releases pointer capture", async () => {
    await diagramAudit.frame();
    const m = diagramAudit.matrix();
    return {
      pass:
        Math.abs(m.e - diagramAudit.beforeMouse.e - 50) < 1 &&
        Math.abs(m.f - diagramAudit.beforeMouse.f - 30) < 1 &&
        getComputedStyle(diagramAudit.viewport).cursor === "grab",
    };
  });

  check("ordinary embedded wheel scrolling stays with the document", () => {
    const { viewport } = diagramAudit;
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    viewport.dispatchEvent(event);
    return { pass: !event.defaultPrevented };
  });

  check("modified wheel zoom stays anchored under the pointer", async () => {
    const { viewport, matrix, frame } = diagramAudit;
    const before = matrix();
    const r = viewport.getBoundingClientRect();
    const point = { x: viewport.clientWidth / 2 + 20, y: viewport.clientHeight / 2 + 10 };
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -20,
      clientX: r.left + point.x,
      clientY: r.top + point.y,
    });
    viewport.dispatchEvent(event);
    await frame();
    const after = matrix();
    // MouseEvent coordinates use integer CSS pixels; compare the actual event
    // anchor after conversion into the viewport's untransformed coordinates.
    point.x = ((event.clientX - r.left) * viewport.clientWidth) / r.width;
    point.y = ((event.clientY - r.top) * viewport.clientHeight) / r.height;
    const anchorError = Math.hypot(
      (point.x - before.e) / before.a - (point.x - after.e) / after.a,
      (point.y - before.f) / before.a - (point.y - after.f) / after.a,
    );
    return {
      pass: event.defaultPrevented && after.a > before.a && anchorError < 0.01,
      anchorError,
    };
  });

  check("fullscreen wheel input pans in both axes", async () => {
    const { container, viewport, matrix, frame, settle } = diagramAudit;
    container.querySelector(".btn-maximize").click();
    await settle();
    const before = matrix();
    const r = viewport.getBoundingClientRect();
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaX: 35,
        deltaY: 45,
        clientX: r.left + 150,
        clientY: r.top + 150,
      }),
    );
    await frame();
    const after = matrix();
    return {
      pass:
        Math.abs(after.e - before.e + 35) < 1 &&
        Math.abs(after.f - before.f + 45) < 1 &&
        after.a === before.a,
    };
  });

  check("touch pinch zoom and the remaining finger pan without jumping", async () => {
    const { viewport, pointer, matrix, frame } = diagramAudit;
    const r = viewport.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const before = matrix();
    pointer("pointerdown", 81, x - 50, y, "touch");
    pointer("pointerdown", 82, x + 50, y, "touch");
    pointer("pointermove", 81, x - 100, y, "touch");
    pointer("pointermove", 82, x + 100, y, "touch");
    await frame();
    const pinched = matrix();
    pointer("pointerup", 82, x + 100, y, "touch");
    pointer("pointermove", 81, x - 80, y + 15, "touch");
    await frame();
    const dragged = matrix();
    pointer("pointercancel", 81, x - 80, y + 15, "touch");
    pointer("pointermove", 81, x, y, "touch");
    await frame();
    return {
      pass:
        Math.abs(pinched.a / before.a - 2) < 0.01 &&
        Math.abs(dragged.e - pinched.e - 20) < 1 &&
        Math.abs(dragged.f - pinched.f - 15) < 1 &&
        matrix().e === dragged.e &&
        getComputedStyle(viewport).cursor === "grab",
    };
  });

  check("pinch scale stays stable while the modal animation changes scale", async () => {
    const { container, viewport, pointer, matrix, frame } = diagramAudit;
    // Freeze two points of the animation so the test does not depend on the
    // frame at which the browser samples a running CSS transition.
    container.style.setProperty("transition", "none", "important");
    container.style.setProperty("transform", "scale(0.8)", "important");
    const r = viewport.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const before = matrix();
    pointer("pointerdown", 85, x - 50, y, "touch");
    pointer("pointerdown", 86, x + 50, y, "touch");
    container.style.setProperty("transform", "scale(1)", "important");
    pointer("pointermove", 85, x - 50, y, "touch");
    pointer("pointermove", 86, x + 50, y, "touch");
    await frame();
    const after = matrix();
    pointer("pointerup", 85, x - 50, y, "touch");
    pointer("pointerup", 86, x + 50, y, "touch");
    container.style.removeProperty("transform");
    container.style.removeProperty("transition");
    return { pass: Math.abs(after.a / before.a - 0.8) < 0.01, ratio: after.a / before.a };
  });

  check("keyboard pan, zoom and reset remain available", async () => {
    const { viewport, matrix, frame } = diagramAudit;
    viewport.focus();
    const before = matrix();
    for (const key of ["ArrowRight", "+"])
      viewport.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    await frame();
    const moved = matrix();
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "0", bubbles: true, cancelable: true }),
    );
    await frame();
    return {
      pass:
        moved.a > before.a && moved.e !== before.e && Math.abs(diagramAudit.view().zoom - 1) < 0.01,
    };
  });

  browser("set", "viewport", "390", "844");
  evaluate(async () => {
    await diagramAudit.settle();
    diagramAudit.container.querySelector(".btn-rotate").click();
    await diagramAudit.settle();
  });
  check("mobile rotation maps dragging to screen coordinates", async () => {
    const { viewport, content, pointer, frame } = diagramAudit;
    const r = viewport.getBoundingClientRect();
    const x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const before = content.getBoundingClientRect();
    pointer("pointerdown", 91, x, y, "touch");
    pointer("pointermove", 91, x + 30, y + 20, "touch");
    pointer("pointerup", 91, x + 30, y + 20, "touch");
    await frame();
    const after = content.getBoundingClientRect();
    return {
      pass: Math.abs(after.x - before.x - 30) < 1 && Math.abs(after.y - before.y - 20) < 1,
      dx: after.x - before.x,
      dy: after.y - before.y,
    };
  });

  evaluate(() => {
    diagramAudit.beforeResize = diagramAudit.view();
  });
  browser("set", "viewport", "1280", "900");
  check("resizing a rotated viewer preserves its relative zoom and center", async () => {
    await diagramAudit.settle();
    const before = diagramAudit.beforeResize,
      after = diagramAudit.view();
    return {
      pass:
        Math.abs(before.zoom - after.zoom) < 0.01 &&
        Math.abs(before.x - after.x) < 0.01 &&
        Math.abs(before.y - after.y) < 0.01,
      before,
      after,
    };
  });
  check("rotation no longer changes drag axes on a desktop viewport", async () => {
    const { viewport, content, pointer, frame } = diagramAudit;
    const r = viewport.getBoundingClientRect();
    const before = content.getBoundingClientRect();
    pointer("pointerdown", 92, r.left + 100, r.top + 100);
    pointer("pointermove", 92, r.left + 125, r.top + 135);
    pointer("pointerup", 92, r.left + 125, r.top + 135);
    await frame();
    const after = content.getBoundingClientRect();
    return { pass: Math.abs(after.x - before.x - 25) < 1 && Math.abs(after.y - before.y - 35) < 1 };
  });

  check("modal scaling does not change the distance of a screen drag", async () => {
    const { container, viewport, content, pointer, frame } = diagramAudit;
    container.style.setProperty("transform", "scale(0.8)", "important");
    const r = viewport.getBoundingClientRect();
    const before = content.getBoundingClientRect();
    pointer("pointerdown", 94, r.left + 100, r.top + 100);
    pointer("pointermove", 94, r.left + 140, r.top + 120);
    pointer("pointerup", 94, r.left + 140, r.top + 120);
    await frame();
    const after = content.getBoundingClientRect();
    container.style.removeProperty("transform");
    return {
      pass: Math.abs(after.x - before.x - 40) < 1 && Math.abs(after.y - before.y - 20) < 1,
      dx: after.x - before.x,
      dy: after.y - before.y,
    };
  });

  check("large pans keep the diagram reachable", async () => {
    const { viewport, content, pointer, frame } = diagramAudit;
    const r = viewport.getBoundingClientRect();
    pointer("pointerdown", 93, r.left + 100, r.top + 100);
    pointer("pointermove", 93, r.left + 100000, r.top + 100000);
    pointer("pointerup", 93, r.left + 100000, r.top + 100000);
    await frame();
    const c = content.getBoundingClientRect();
    return { pass: c.left < r.right && c.top < r.bottom && c.right > r.left && c.bottom > r.top };
  });

  check("pan limits retain visible graphics inside padded sequence SVGs", async () => {
    const { container, settle, frame } = diagramAudit;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    const sequence = document.querySelectorAll(".mermaid-container")[1];
    sequence.scrollIntoView({ block: "center" });
    const viewport = sequence.querySelector(".mermaid-viewport");
    const r = viewport.getBoundingClientRect();
    for (const [type, x, y] of [
      ["pointerdown", 100, 100],
      ["pointermove", 100000, 100000],
      ["pointerup", 100000, 100000],
    ]) {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 95,
          pointerType: "mouse",
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: r.left + x,
          clientY: r.top + y,
        }),
      );
    }
    await frame();
    const svg = sequence.querySelector(".mermaid-content svg");
    const bounds = svg.getBBox(),
      matrix = svg.getScreenCTM();
    const first = new DOMPoint(bounds.x, bounds.y).matrixTransform(matrix);
    const last = new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height).matrixTransform(
      matrix,
    );
    container.querySelector(".btn-maximize").click();
    await settle();
    return {
      pass: first.x < r.right && first.y < r.bottom && last.x > r.left && last.y > r.top,
      graphicsLeft: first.x,
      viewportRight: r.right,
    };
  });

  check("malformed diagrams retain their source and disable zoom controls", () => {
    const container = [...document.querySelectorAll(".mermaid-container")].at(-1);
    const source = container.querySelector("details pre");
    return {
      pass:
        source?.textContent === container.dataset.mermaidCode &&
        container.querySelector(".btn-zoom-in").disabled &&
        !document.querySelector('[id^="dmermaid-svg-"]') &&
        !document.getElementById("loading-overlay"),
    };
  });

  check("every diagram type renders with each of the six theme palettes", async () => {
    const failed = [];
    for (const theme of window.PDY_THEME_MANIFEST) {
      document.documentElement.dataset.theme = theme.id;
      await PDY.MermaidModule.updateTheme();
      const svgs = [...document.querySelectorAll(".mermaid-content svg")];
      const color = window.PDY_MERMAID_THEMES[theme.id].themeVariables.textColor;
      if (
        svgs.length !== 10 ||
        svgs.some((svg) => !svg.querySelector("style")?.textContent.includes(color))
      )
        failed.push(theme.id);
    }
    return { pass: !failed.length, failed };
  });

  check("rapid theme changes finish with the latest theme for every diagram", async () => {
    const operations = [];
    for (const theme of ["lumina", "parchment", "midnight-fjord", "evergreen", "porcelain"]) {
      document.documentElement.dataset.theme = theme;
      operations.push(PDY.MermaidModule.updateTheme());
    }
    await Promise.all(operations);
    await diagramAudit.settle();
    return {
      pass:
        document.querySelectorAll(".mermaid-content svg").length === 10 &&
        [...document.querySelectorAll(".mermaid-content svg")].every((svg) =>
          svg.querySelector("style")?.textContent.includes("#24272a"),
        ),
    };
  });

  check("adding a diagram during a pending render does not strand existing diagrams", async () => {
    const original = window.mermaid.render;
    let release;
    let started;
    let held = false;
    const began = new Promise((resolve) => {
      started = resolve;
    });
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.mermaid.render = async (...args) => {
      const result = await original(...args);
      if (!held) {
        held = true;
        started();
        await gate;
      }
      return result;
    };
    try {
      document.documentElement.dataset.theme = "lumina";
      const pending = PDY.MermaidModule.updateTheme();
      await began;
      const source = document.createElement("pre");
      source.className = "mermaid";
      source.textContent =
        '---\nconfig:\n  htmlLabels: true\n---\nflowchart LR\nA["A long label with spaces"] --> B["**Bold label**"]';
      document.querySelector("main").append(source);
      const added = PDY.MermaidModule.init();
      release();
      await Promise.all([pending, added]);
      await diagramAudit.settle();
      const svgs = [...document.querySelectorAll(".mermaid-content svg")];
      const svg = svgs.at(-1);
      const labels = [...svg.querySelectorAll(".nodeLabel, .nodeLabel p")];
      const expected = getComputedStyle(svg).fontSize;
      return {
        pass:
          svgs.length === 11 &&
          !document.querySelector("pre.mermaid") &&
          labels.length > 0 &&
          labels.every((label) => getComputedStyle(label).fontSize === expected),
        count: svgs.length,
        expected,
        sizes: labels.map((label) => getComputedStyle(label).fontSize),
      };
    } finally {
      release();
      window.mermaid.render = original;
    }
  });

  check("detaching an expanded diagram releases focus and page scroll", async () => {
    diagramAudit.container.remove();
    await diagramAudit.frame();
    await diagramAudit.settle();
    return {
      pass:
        !document.body.classList.contains("scroll-locked") &&
        !document.querySelector(".modal-backdrop") &&
        [...document.querySelectorAll("[inert]")].every((element) =>
          diagramAudit.inertElements.includes(element),
        ) &&
        document.querySelectorAll("[inert]").length === diagramAudit.inertElements.length,
      locked: document.body.classList.contains("scroll-locked"),
      inert: [...document.querySelectorAll("[inert]")].map((element) => element.className),
      backdrops: document.querySelectorAll(".modal-backdrop").length,
    };
  });
} finally {
  try {
    browser("close");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
assert.equal(failures, 0, "Mermaid browser regressions failed");
