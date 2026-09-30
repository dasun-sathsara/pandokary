local function read_file(path, mode)
  local file = io.open(path, mode or "r")
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

local function read_asset(name, mode)
  return read_file(asset_path(name), mode)
end

local function base64(data)
  local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  local encoded = {}
  for i = 1, #data, 3 do
    local a, b, c = data:byte(i, i + 2)
    local value = a * 65536 + (b or 0) * 256 + (c or 0)
    encoded[#encoded + 1] = alphabet:sub(math.floor(value / 262144) % 64 + 1, math.floor(value / 262144) % 64 + 1)
    encoded[#encoded + 1] = alphabet:sub(math.floor(value / 4096) % 64 + 1, math.floor(value / 4096) % 64 + 1)
    encoded[#encoded + 1] = b and alphabet:sub(math.floor(value / 64) % 64 + 1, math.floor(value / 64) % 64 + 1) or "="
    encoded[#encoded + 1] = c and alphabet:sub(value % 64 + 1, value % 64 + 1) or "="
  end
  return table.concat(encoded)
end

-- A self-contained page needs every referenced font, but repeating its data URI
-- in each @font-face rule multiplies the file size. Keep one encoded copy per
-- source and replace the CSS placeholders with shared blob URLs in the head.
local function bundle_fonts(css)
  local files, order = {}, {}
  css = css:gsub('url%("fonts/([%w%-%._]+)"%)', function(file)
    if not files[file] then
      local path = "fonts/" .. file
      local font = read_asset(path, "rb")
      if not font then error("required pdy font not found: " .. path) end
      local mime = file:match("%.woff2$") and "font/woff2" or file:match("%.ttf$") and "font/ttf"
      if not mime then error("unsupported pdy font format: " .. path) end
      files[file] = { mime, base64(font) }
      table.insert(order, file)
    end
    return 'url("pdy-font:' .. file .. '")'
  end)

  local entries = {}
  for _, file in ipairs(order) do
    table.insert(entries, string.format("[%q,%q,%q]", file, files[file][1], files[file][2]))
  end
  local loader = [[
(function () {
  const style = document.getElementById("pdy-inline-css");
  if (!style) return;
  const fonts = ]] .. "[" .. table.concat(entries, ",") .. "];\n" .. [[
  const urls = Object.create(null);
  for (const [file, mime, encoded] of fonts) {
    if (typeof URL.createObjectURL === "function") {
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      urls[file] = URL.createObjectURL(new Blob([bytes], { type: mime }));
    } else {
      urls[file] = "data:" + mime + ";base64," + encoded;
    }
  }
  style.textContent = style.textContent.replace(
    /url\("pdy-font:([\w._-]+)"\)/g,
    function (source, file) {
      if (!urls[file]) throw new Error("pdy font missing from bundle: " + file);
      return 'url("' + urls[file] + '")';
    }
  );
})();
]]
  return css, loader
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

local has_code = false
local has_math = false
local has_mermaid = false
local theme_manifest = read_asset("themes/manifest.json")
if not theme_manifest then error("required pdy theme manifest not found") end
local decoded_manifest = pandoc.json.decode(theme_manifest)
local themes = decoded_manifest.themes or decoded_manifest
-- Mean adult silent-reading rate for English non-fiction (Brysbaert, 2019).
local READING_WORDS_PER_MINUTE = 238

local word_range_data = read_asset("unicode-word-ranges.lua")
if not word_range_data then error("required pdy Unicode word ranges not found") end
local word_intervals = {}
for first_hex, last_hex in word_range_data:gmatch("(%x+)-(%x+)") do
  local first, last = tonumber(first_hex, 16), tonumber(last_hex, 16)
  if not first or not last then error("invalid pdy Unicode word range: " .. first_hex .. "-" .. last_hex) end
  word_intervals[#word_intervals + 1] = { first, last }
end

local function is_word_codepoint(codepoint)
  local low, high = 1, #word_intervals
  while low <= high do
    local middle = math.floor((low + high) / 2)
    local interval = word_intervals[middle]
    if codepoint < interval[1] then
      high = middle - 1
    elseif codepoint > interval[2] then
      low = middle + 1
    else
      return true
    end
  end
  return false
end

local function is_word(value)
  for _, codepoint in utf8.codes(value) do
    if is_word_codepoint(codepoint) then return true end
  end
  return false
end

local function count_prose_words(doc)
  local word_count = 0
  local body = pandoc.Pandoc(doc.blocks, {})
  local prose = body:walk({
    Code = function()
      return {}
    end,
    Math = function()
      return {}
    end,
    Image = function(image)
      image.caption = {}
      return image
    end,
    Figure = function(figure)
      figure.caption = {}
      return figure
    end,
    RawInline = function()
      return {}
    end,
    CodeBlock = function()
      return {}
    end,
    RawBlock = function()
      return {}
    end,
  })
  prose:walk({
    Str = function(value)
      if is_word(pandoc.utils.stringify(value)) then word_count = word_count + 1 end
      return value
    end,
  })
  return word_count
end

function Math()
  has_math = true
end

function CodeBlock(block)
  if has_class(block.classes, "mermaid") then
    has_mermaid = true
    block.attributes["data-mermaid-code"] = block.text
  else
    has_code = true
  end
  return block
end

function Table(tbl)
  local new_colspecs = {}
  for _, colspec in ipairs(tbl.colspecs) do
    table.insert(new_colspecs, { colspec[1], pandoc.ColWidthDefault })
  end
  tbl.colspecs = new_colspecs
  return tbl
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
}
for _, theme in ipairs(themes) do
  table.insert(stylesheet_files, "themes/css/" .. theme.id .. ".css")
end
table.insert(stylesheet_files, "components/responsive.css")
table.insert(stylesheet_files, "components/surfaces.css")

local function build_theme_js()
  local m_parts = {}
  for _, theme in ipairs(has_mermaid and themes or {}) do
    local path = "themes/mermaid/" .. theme.id .. ".json"
    local json_str = read_asset(path)
    if not json_str then error("required pdy diagram palette not found: " .. path) end
    table.insert(m_parts, string.format("%q:%s", theme.id, json_str))
  end
  local mermaid_json = "{" .. table.concat(m_parts, ",") .. "}"
  return string.format("(() => { const manifest = %s; window.PDY_THEME_MANIFEST = manifest.themes || manifest; })();\nwindow.PDY_MERMAID_THEMES = %s;", theme_manifest, mermaid_json)
end

local function build_reader_js()
  local manifest = read_asset("reader-scripts.json")
  if not manifest then error("required pdy reader script manifest not found") end
  local scripts = pandoc.json.decode(manifest)
  -- Diagram controllers use the shared runtime and UI modules, then register
  -- their hooks before app.js starts reader initialization.
  if has_mermaid then table.insert(scripts, #scripts, "mermaid.js") end
  return concatenate(scripts)
end

function Pandoc(doc)
  -- Exports and temporary previews may live outside the Markdown source folder.
  local source_base = pandoc.utils.stringify(doc.meta.pdyResourceBase or "")
  local link_base = pandoc.utils.stringify(doc.meta.pdyLinkBase or source_base)
  if source_base ~= "" or link_base ~= "" then
    local function resolve_resource(path, base)
      if base ~= "" and path ~= "" and not path:match("^[%a][%w+.-]*:") and not path:match("^[/#?]") then
        return base .. path
      end
      return path
    end
    doc = doc:walk({
      Image = function(image)
        image.src = resolve_resource(image.src, source_base)
        return image
      end,
      Link = function(link)
        link.target = resolve_resource(link.target, link_base)
        return link
      end,
    })
  end
  doc.meta["has-code"] = pandoc.MetaBool(has_code)
  doc.meta["has-math"] = pandoc.MetaBool(has_math)
  doc.meta["has-mermaid"] = pandoc.MetaBool(has_mermaid)
  doc.meta["reading-minutes"] = nil
  local word_count = count_prose_words(doc)
  if word_count > 0 then
    doc.meta["reading-minutes"] = math.max(1, math.ceil(word_count / READING_WORDS_PER_MINUTE))
  end
  local css, font_loader = bundle_fonts(concatenate(stylesheet_files))
  local theme_js = build_theme_js()

  doc.meta["inline-css"] = raw_html(css)
  doc.meta["inline-font-loader"] = raw_html(font_loader)
  doc.meta["inline-js"] = raw_html(theme_js .. "\n" .. build_reader_js())
  if has_math then
    doc.meta["inline-mathjax-config"] = raw_html(concatenate({ "mathjax-config.js" }))
  end
  return doc
end
