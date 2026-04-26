local function read_file(path)
    local file = io.open(path, 'r')
    if not file then
        return nil
    end
    -- Use 'a' instead of '*a' for Lua 5.3+ compatibility (Pandoc default)
    local content = file:read('a')
    file:close()
    return content
end

local function resolve_asset_path(name)
    local base = os.getenv('PDY_ASSETS_DIR')
    if not base or base == '' then
        return name
    end
    -- Get system-specific separator from package config
    local sep = package.config:sub(1, 1)
    if base:sub(-1) == sep then
        return base .. name
    end
    return base .. sep .. name
end

local function read_asset(name)
    local path = resolve_asset_path(name)
    local content = read_file(path)
    if content then
        return content
    end
    -- Fallback to relative lookup so behaviour matches previous versions.
    return read_file(name)
end

local function as_meta_raw(content)
    if not content then
        return nil
    end
    -- We use RawInline to inject the code literally, preventing Pandoc
    -- from escaping characters like '<', '>', or '&' inside your JS/CSS.
    return pandoc.MetaInlines({ pandoc.RawInline('html', content) })
end

function Pandoc(doc)
    -- Inline our core assets when available.
    -- These keys match the $variable$ names in your HTML template.
    local font_css = read_asset('font-assets.css') or ''
    local styles_css = read_asset('styles.css') or ''
    doc.meta['inline-css'] = as_meta_raw(font_css .. '\n' .. styles_css)
    doc.meta['inline-js'] = as_meta_raw(read_asset('script.js'))
    doc.meta['inline-mathjax-config'] = as_meta_raw(read_asset('mathjax-config.js'))

    return doc
end
