local function read_file(path)
  local file = io.open(path, "r")
  if not file then return nil end
  local content = file:read("a")
  file:close()
  return content
end

local function asset_path(name)
  local base = os.getenv("PDY_ASSETS_DIR")
  if not base or base == "" then return name end
  local separator = package.config:sub(1, 1)
  if base:sub(-1) == separator then return base .. name end
  return base .. separator .. name
end

local function read_asset(name)
  return read_file(asset_path(name)) or read_file(name)
end

local function concatenate(names)
  local parts = {}
  for _, name in ipairs(names) do
    local content = read_asset(name)
    if not content then error("required pdy asset not found: " .. name) end
    table.insert(parts, content)
  end
  return table.concat(parts, "\n")
end

local function raw_html(content)
  return pandoc.MetaInlines({ pandoc.RawInline("html", content) })
end

local function has_class(classes, class_name)
  for _, class in ipairs(classes) do
    if class == class_name then return true end
  end
  return false
end

function CodeBlock(block)
  if has_class(block.classes, "mermaid") then
    block.attributes["data-mermaid-code"] = block.text
  end
  return block
end

local stylesheet_files = {
  "base.css",
  "components/code.css",
  "components/tables.css",
  "components/settings.css",
  "components/mermaid.css",
  "components/reader.css",
  "components/loading.css",
  "components/headings.css",
  "components/lightbox.css",
  "components/footer.css",
  "themes/css/lumina.css",
  "themes/css/primer.css",
  "themes/css/parchment.css",
  "themes/css/verdant-paper.css",
  "themes/css/lilac-frost.css",
  "themes/css/obsidian.css",
  "themes/css/studio-dark.css",
  "themes/css/ayu-mirage.css",
  "themes/css/midnight-fjord.css",
  "themes/css/boreal.css",
  "components/responsive.css",
}

local mermaid_files = {
  { id = "lumina", path = "themes/mermaid/lumina.json" },
  { id = "primer", path = "themes/mermaid/primer.json" },
  { id = "parchment", path = "themes/mermaid/parchment.json" },
 { id = "verdant-paper", path = "themes/mermaid/verdant-paper.json" },
 { id = "lilac-frost", path = "themes/mermaid/lilac-frost.json" },
  { id = "obsidian", path = "themes/mermaid/obsidian.json" },
  { id = "studio-dark", path = "themes/mermaid/studio-dark.json" },
  { id = "ayu-mirage", path = "themes/mermaid/ayu-mirage.json" },
 { id = "midnight-fjord", path = "themes/mermaid/midnight-fjord.json" },
 { id = "boreal", path = "themes/mermaid/boreal.json" },
}

local function build_theme_js()
  local manifest = read_asset("themes/manifest.json") or "[]"
  local m_parts = {}
  for _, item in ipairs(mermaid_files) do
    local json_str = read_asset(item.path)
    if json_str then
      table.insert(m_parts, string.format("%q:%s", item.id, json_str))
    end
  end
  local mermaid_json = "{" .. table.concat(m_parts, ",") .. "}"
  return string.format("window.PDY_THEME_MANIFEST = (%s).themes || %s;\nwindow.PDY_MERMAID_THEMES = %s;", manifest, manifest, mermaid_json)
end

function Pandoc(doc)
  local mode = doc.meta.assetMode and pandoc.utils.stringify(doc.meta.assetMode) or "cdn"
  local css = concatenate(stylesheet_files)
  local theme_js = build_theme_js()

  if mode == "offline" then
    local font_css = read_asset("font-assets.css") or ""
    if font_css ~= "" then css = font_css .. "\n" .. css end
  end

  doc.meta["theme-js"] = raw_html(theme_js)
  doc.meta["inline-css"] = raw_html(css)
  doc.meta["inline-js"] = raw_html(theme_js .. "\n" .. concatenate({ "mermaid.js", "app.js" }))
  doc.meta["inline-mathjax-config"] = raw_html(concatenate({ "mathjax-config.js" }))
  return doc
end
