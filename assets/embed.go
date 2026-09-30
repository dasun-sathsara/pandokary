// Package assets bundles the reader's runtime files.
package assets

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
)

//go:embed filters fonts scripts styles templates themes
var embeddedAssets embed.FS

// Extract writes bundled runtime assets to a temporary directory.
func Extract() (string, func(), error) {
	dir, err := os.MkdirTemp("", "pdy-assets-*")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.RemoveAll(dir) }
	err = fs.WalkDir(embeddedAssets, ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		target := filepath.Join(dir, name)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := fs.ReadFile(embeddedAssets, name)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
	if err != nil {
		cleanup()
		return "", nil, err
	}
	return dir, cleanup, nil
}
