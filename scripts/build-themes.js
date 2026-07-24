import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const themesDir = path.join(rootDir, "assets", "themes");
const manifestPath = path.join(themesDir, "manifest.json");

function buildThemes() {
  if (!fs.existsSync(manifestPath)) {
    console.error("Manifest not found:", manifestPath);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let combinedCss = "/* Generated from assets/themes/css/ — do not edit directly */\n\n";
  const mermaidThemes = {};

  for (const theme of manifest.themes) {
    const cssPath = path.join(themesDir, "css", `${theme.id}.css`);
    if (fs.existsSync(cssPath)) {
      combinedCss += fs.readFileSync(cssPath, "utf8").trim() + "\n\n";
    }

    const mermaidPath = path.join(themesDir, "mermaid", `${theme.id}.json`);
    if (fs.existsSync(mermaidPath)) {
      mermaidThemes[theme.id] = JSON.parse(fs.readFileSync(mermaidPath, "utf8"));
    }
  }

  const themesCssPath = path.join(rootDir, "assets", "themes.css");
  fs.writeFileSync(themesCssPath, combinedCss.trim() + "\n");
  console.log("Generated:", themesCssPath);

  const themesJsContent = `// Generated from assets/themes/ — do not edit directly
window.PDY_THEME_MANIFEST = ${JSON.stringify(manifest.themes, null, 2)};
window.PDY_MERMAID_THEMES = ${JSON.stringify(mermaidThemes, null, 2)};
`;

  const themesJsPath = path.join(rootDir, "assets", "themes.js");
  fs.writeFileSync(themesJsPath, themesJsContent);
  console.log("Generated:", themesJsPath);
}

buildThemes();
