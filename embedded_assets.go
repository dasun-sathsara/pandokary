// Package pandokary provides embedded runtime assets for pdy.
package pandokary

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
)

//go:embed assets/*
var embeddedAssets embed.FS

// ExtractEmbeddedAssets writes bundled runtime assets to a temporary directory.
func ExtractEmbeddedAssets() (string, func(), error) {
	sub, err := fs.Sub(embeddedAssets, "assets")
	if err != nil {
		return "", nil, err
	}
	dir, err := os.MkdirTemp("", "pdy-assets-*")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.RemoveAll(dir) }
	err = fs.WalkDir(sub, ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		target := filepath.Join(dir, name)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := fs.ReadFile(sub, name)
		if err != nil {
			return err
		}
		if err = os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
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
