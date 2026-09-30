const {
  StorageManager,
  HapticFeedback,
  FoldModule,
  SettingsModule,
  CodeBlockModule,
  TableModule,
  TaskListModule,
  TOCModule,
  SectionLinkModule,
  ReaderExtrasModule,
  runFeature,
} = PDY;

async function main() {
  try {
    runFeature("Mermaid", () => window.mermaid?.initialize?.({ startOnLoad: false }));
    runFeature("StorageManager", () => StorageManager.init());
    runFeature("HapticFeedback", () => HapticFeedback.init());
    // Folding wraps raw Pandoc blocks before other modules enhance them.
    runFeature("FoldModule", () => FoldModule.init());
    const fonts = runFeature("Document fonts", () => SettingsModule.loadFonts());
    runFeature("CodeBlockModule", () => CodeBlockModule.init());
    runFeature("TableModule", () => TableModule.init());
    runFeature("TaskListModule", () => TaskListModule.init());
    const settings = runFeature("SettingsModule", () => SettingsModule.init());
    runFeature("TOCModule", () => TOCModule.init());
    runFeature("SectionLinkModule", () => SectionLinkModule.init());
    runFeature("ReaderExtrasModule", () => ReaderExtrasModule.init(settings));
    runFeature("Document reveal", () => ReaderExtrasModule.revealDocument());
    await fonts;
    await runFeature("Mermaid rendering", () => PDY.MermaidModule?.init());
  } finally {
    if (runFeature("Loading overlay", () => ReaderExtrasModule.finishLoading()) === null) {
      document.getElementById("loading-overlay")?.remove();
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main, { once: true });
} else {
  void main();
}
