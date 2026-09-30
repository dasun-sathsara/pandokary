package pdy

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type outputLocation struct {
	target, path, dir string
	original          os.FileInfo
	preview, complete bool
}

// Stage beside the destination so a failed conversion cannot replace a previous
// export and the final rename stays on the same filesystem.
func prepareExportOutput(input, output string) (outputLocation, error) {
	source, err := os.Stat(input)
	if err != nil {
		return outputLocation{}, fmt.Errorf("read source: %w", err)
	}
	original, err := os.Stat(output)
	if err != nil && !os.IsNotExist(err) {
		return outputLocation{}, fmt.Errorf("inspect export destination: %w", err)
	}
	if original != nil {
		if os.SameFile(source, original) {
			return outputLocation{}, errors.New("export destination refers to the source file")
		}
		if !original.Mode().IsRegular() {
			return outputLocation{}, fmt.Errorf("export destination is not a regular file: %s", output)
		}
	}
	// Follow existing output symlinks, preserving the link itself. Reject a
	// dangling link rather than silently replacing it with a regular file.
	if info, statErr := os.Lstat(output); statErr == nil && info.Mode()&os.ModeSymlink != 0 {
		output, err = filepath.EvalSymlinks(output)
		if err != nil {
			return outputLocation{}, fmt.Errorf("resolve export symlink: %w", err)
		}
	}
	staged, err := stageOutput(output, original, ".pdy-export-*")
	if err != nil {
		return outputLocation{}, fmt.Errorf("stage export: %w", err)
	}
	return staged, nil
}

// commit retains successful previews because browser openers return before the
// browser consumes the document. Export staging directories are always removed.
func (output *outputLocation) commit() error {
	if !output.preview {
		if output.original != nil {
			if err := os.Chmod(output.path, output.original.Mode().Perm()); err != nil {
				return err
			}
		}
		if err := os.Rename(output.path, output.target); err != nil {
			return err
		}
	}
	output.complete = true
	return nil
}

func (output *outputLocation) close() {
	if !output.preview || !output.complete {
		_ = os.RemoveAll(output.dir)
	}
}

func stageOutput(target string, original os.FileInfo, pattern string) (outputLocation, error) {
	dir, err := os.MkdirTemp(filepath.Dir(target), pattern)
	if err != nil {
		return outputLocation{}, err
	}
	return outputLocation{target: target, path: filepath.Join(dir, filepath.Base(target)), dir: dir, original: original}, nil
}

func prepareOutput(options Options) (outputLocation, error) {
	base := strings.TrimSuffix(filepath.Base(options.InputPath), filepath.Ext(options.InputPath))
	if !options.Export {
		dir, err := os.MkdirTemp("", "pdy-preview-*")
		if err != nil {
			return outputLocation{}, err
		}
		path := filepath.Join(dir, base+".html")
		return outputLocation{target: path, path: path, dir: dir, preview: true}, nil
	}
	name := options.ExportName
	if name == "" {
		name = base
	}
	if !strings.EqualFold(filepath.Ext(name), ".html") {
		name += ".html"
	}
	path, err := filepath.Abs(name)
	if err != nil {
		return outputLocation{}, fmt.Errorf("resolve export path: %w", err)
	}
	return prepareExportOutput(options.InputPath, path)
}
