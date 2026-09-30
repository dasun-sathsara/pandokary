// Package pdy provides the rendering and asset preparation pipeline.
package pdy

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// AssetModeCDN keeps third-party libraries on their CDNs.
	AssetModeCDN = "cdn"
	// AssetModeOffline permits Pandoc to embed third-party libraries.
	AssetModeOffline = "offline"
)

// Options configures a single pdy rendering run.
type Options struct {
	InputPath      string
	ExportName     string
	AssetMode      string
	PandocPath     string
	Export         bool
	EmbedResources bool
	FormatMarkdown bool
	Verbose        bool
}

// Result contains the output path of a rendering run.
type Result struct {
	OutputPath string
}

func (options Options) normalize() (Options, error) {
	options.AssetMode = strings.ToLower(options.AssetMode)
	if options.AssetMode == "" {
		options.AssetMode = AssetModeCDN
	}
	if options.AssetMode != AssetModeCDN && options.AssetMode != AssetModeOffline {
		return options, fmt.Errorf("invalid asset mode %q (expected cdn or offline)", options.AssetMode)
	}
	input, err := filepath.Abs(options.InputPath)
	if err != nil {
		return options, fmt.Errorf("resolve input path: %w", err)
	}
	info, err := os.Stat(input)
	if err != nil {
		return options, fmt.Errorf("input file %q: %w", input, err)
	}
	if !info.Mode().IsRegular() {
		return options, fmt.Errorf("input is not a regular file: %s", input)
	}
	options.InputPath = input
	return options, nil
}

// Run executes the pandokary rendering pipeline.
func Run(options Options) (Result, error) {
	options, err := options.normalize()
	if err != nil {
		return Result{}, err
	}
	pandoc, err := findPandoc(options.PandocPath)
	if err != nil {
		return Result{}, err
	}
	assets, err := resolveAssets()
	if err != nil {
		return Result{}, err
	}
	defer assets.close()
	output, err := prepareOutput(options)
	if err != nil {
		return Result{}, err
	}
	defer output.close()

	if options.FormatMarkdown {
		if err := formatMarkdown(options.InputPath, options.Verbose); err != nil {
			fmt.Fprintf(os.Stderr, "warning: source formatting requested but skipped: %v\n", err)
		}
	} else if options.Verbose {
		fmt.Fprintln(os.Stderr, "source formatting: disabled")
	}

	args := pandocArgs(options, assets.dir, output.path)
	if options.Verbose {
		fmt.Fprintf(os.Stderr, "input: %s\noutput: %s\nassets dir: %s\nsource formatting: %t\npandoc argv: %s\n",
			options.InputPath, output.target, assets.dir, options.FormatMarkdown,
			strings.Join(quoteArgs(append([]string{pandoc}, args...)), " "))
	}
	if err := runPandoc(pandoc, args, assets.dir); err != nil {
		return Result{}, err
	}
	if err := output.commit(); err != nil {
		return Result{}, fmt.Errorf("save output: %w", err)
	}
	if output.preview {
		if err := openInBrowser(output.target); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not open browser automatically: %v\npreview file saved to: %s\n", err, output.target)
		}
	}
	return Result{OutputPath: output.target}, nil
}
