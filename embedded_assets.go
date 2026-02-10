package pandokary

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
)

// embeddedAssets includes the repository's HTML/Lua/CSS/JS assets so the binary
// can run even when an on-disk assets directory is not present (e.g. go run,
// go install, Homebrew-style installs).
//
//go:embed assets/*
var embeddedAssets embed.FS

// ExtractEmbeddedAssets writes the embedded assets to a temporary directory and
// returns the directory path along with a cleanup function.
func ExtractEmbeddedAssets() (string, func(), error) {
	sub, err := fs.Sub(embeddedAssets, "assets")
	if err != nil {
		return "", nil, err
	}

	dir, err := os.MkdirTemp("", "pdy-assets-*")
	if err != nil {
		return "", nil, err
	}

	cleanup := func() {
		_ = os.RemoveAll(dir)
	}

	if err := fs.WalkDir(sub, ".", func(name string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		target := filepath.Join(dir, name)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := fs.ReadFile(sub, name)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	}); err != nil {
		cleanup()
		return "", nil, err
	}

	return dir, cleanup, nil
}
