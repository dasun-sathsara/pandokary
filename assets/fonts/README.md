# Bundled variable fonts

Pandokary embeds these unchanged variable-font sources so generated HTML works
without relying on device-installed fonts:

- StudioFeixenSans-Variable.woff2: Studio Feixen Sans from the user's local
  Studio Feixen collection. The source collection did not include a license
  file; redistribution remains subject to the user's applicable license.
- GeistMono-Variable.ttf and GeistMono-Variable-Italic.ttf: Geist Mono variable
  sources by The Geist Project Authors. The files are byte-identical to the
  originals; filenames were normalized for CSS URL handling. See
  LICENSE-Geist-Mono-OFL.txt.
- NotoSansSinhala-Variable.ttf: Noto Sans Sinhala variable source by The Noto
  Project Authors. It supplies Sinhala glyphs in prose and mixed-script code.
  Sinhala strong and heading CSS weights map to native 540 and 580. See
  LICENSE-Noto-Sans-Sinhala-OFL.txt.

The original binaries are used directly. Pandokary does not subset them, alter
their outlines, or generate static weight cuts.
