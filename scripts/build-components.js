import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const componentsDir = path.join(rootDir, "assets", "components");

function buildComponents() {
  if (!fs.existsSync(componentsDir)) {
    console.error("Components directory not found:", componentsDir);
    process.exit(1);
  }

  const order = [
    "code.css",
    "tables.css",
    "settings.css",
    "responsive.css",
    "mermaid.css",
    "reader.css",
    "loading.css",
    "headings.css",
    "lightbox.css",
    "footer.css",
  ];

  let combinedCss = "/* Generated from assets/components/ — do not edit directly */\n\n";

  for (const file of order) {
    const filePath = path.join(componentsDir, file);
    if (fs.existsSync(filePath)) {
      combinedCss += fs.readFileSync(filePath, "utf8").trim() + "\n\n";
    }
  }

  const outputCssPath = path.join(rootDir, "assets", "components.css");
  fs.writeFileSync(outputCssPath, combinedCss.trim() + "\n");
  console.log("Generated:", outputCssPath);
}

buildComponents();
