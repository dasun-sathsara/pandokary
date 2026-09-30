package pdy

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"pdy/assets"
)

type assetLocation struct {
	dir     string
	cleanup func()
}

var requiredAssets = []string{
	"templates/reader.html", "filters/inline-assets.lua", "filters/unicode-word-ranges.lua",
	"scripts/mathjax-config.js", "scripts/modules/mermaid.js", "styles/base.css", "styles/components/code.css",
	"themes/manifest.json", "scripts/manifest.json",
}

func (assets assetLocation) close() {
	if assets.cleanup != nil {
		assets.cleanup()
	}
}

func resolveAssets() (assetLocation, error) {
	if override := strings.TrimSpace(os.Getenv("PDY_ASSETS_DIR")); override != "" {
		dir, err := filepath.Abs(override)
		if err != nil {
			return assetLocation{}, fmt.Errorf("invalid PDY_ASSETS_DIR: %w", err)
		}
		if err = checkAssets(dir); err != nil {
			return assetLocation{}, fmt.Errorf("invalid PDY_ASSETS_DIR: %w", err)
		}
		return assetLocation{dir: dir}, nil
	}
	if executable, err := os.Executable(); err == nil {
		if resolved, resolveErr := filepath.EvalSymlinks(executable); resolveErr == nil {
			dir := filepath.Join(filepath.Dir(resolved), "assets")
			if checkAssets(dir) == nil {
				return assetLocation{dir: dir}, nil
			}
		}
	}
	if dir, err := findAssetsFromCWD(); err == nil {
		return assetLocation{dir: dir}, nil
	}
	dir, cleanup, err := assets.Extract()
	if err != nil {
		return assetLocation{}, fmt.Errorf("extract embedded assets: %w", err)
	}
	if err = checkAssets(dir); err != nil {
		cleanup()
		return assetLocation{}, err
	}
	return assetLocation{dir: dir, cleanup: cleanup}, nil
}

func checkAssets(dir string) error {
	data, err := os.ReadFile(filepath.Join(dir, "scripts/manifest.json"))
	if err != nil {
		return fmt.Errorf("read reader script manifest: %w", err)
	}
	var scripts []string
	if err := json.Unmarshal(data, &scripts); err != nil {
		return fmt.Errorf("parse reader script manifest: %w", err)
	}
	if len(scripts) == 0 {
		return errors.New("reader script manifest is empty")
	}
	var missing []string
	for _, name := range append(scripts, requiredAssets...) {
		if info, err := os.Stat(filepath.Join(dir, name)); err != nil || !info.Mode().IsRegular() {
			missing = append(missing, name)
		}
	}
	if len(missing) != 0 {
		return fmt.Errorf("missing required asset(s) in %s: %s", dir, strings.Join(missing, ", "))
	}
	return nil
}

func findAssetsFromCWD() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		candidate := filepath.Join(dir, "assets")
		if checkAssets(candidate) == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", errors.New("assets not found")
}
