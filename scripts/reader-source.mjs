import { readFileSync } from "node:fs";

const assets = new URL("../assets/", import.meta.url);

export function readReaderSource() {
  const scripts = JSON.parse(readFileSync(new URL("reader-scripts.json", assets), "utf8"));
  // Check the complete reader, including the optional diagram controller.
  scripts.splice(-1, 0, "mermaid.js");
  return scripts.map((name) => readFileSync(new URL(name, assets), "utf8")).join("\n");
}
