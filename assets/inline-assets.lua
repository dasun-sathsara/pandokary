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

function Pandoc(doc)
  local font_css = read_asset("font-assets.css") or ""
  local css = concatenate({ "base.css", "components.css", "themes.css" })
  doc.meta["inline-css"] = raw_html(font_css .. "\n" .. css)
  doc.meta["inline-js"] = raw_html(concatenate({ "themes.js", "mermaid.js", "app.js" }))
  doc.meta["inline-mathjax-config"] = raw_html(concatenate({ "mathjax-config.js" }))
  return doc
end
