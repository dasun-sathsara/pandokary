package pdy

import (
	"bytes"
	"errors"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func findPandoc(override string) (string, error) {
	if override == "" {
		if path, err := exec.LookPath("pandoc"); err == nil {
			return path, nil
		}
		return "", errors.New("pandoc not found (install Pandoc or pass --pandoc <path>)")
	}
	if path, err := exec.LookPath(override); err == nil {
		return path, nil
	}
	path, err := filepath.Abs(override)
	if err != nil {
		return "", fmt.Errorf("resolve pandoc override: %w", err)
	}
	if executable, err := exec.LookPath(path); err == nil {
		return executable, nil
	}
	return "", fmt.Errorf("pandoc not found: %s", override)
}

func pandocArgs(options Options, assets, output string) []string {
	resourcePath := filepath.Dir(options.InputPath) + string(os.PathListSeparator) + assets
	args := []string{
		"--from", "markdown+tex_math_dollars+tex_math_single_backslash",
		options.InputPath,
		"--template", filepath.Join(assets, "templates", "reader.html"),
		"--standalone",
		"--resource-path", resourcePath,
		"--syntax-highlighting=none", "--mathjax",
		"--lua-filter", filepath.Join(assets, "filters", "inline-assets.lua"),
		"--metadata=assetMode:" + options.AssetMode,
	}
	base := directoryFileURL(filepath.Dir(options.InputPath))
	args = append(args, "--metadata=pdyLinkBase:"+base)
	if !options.EmbedResources {
		args = append(args, "--metadata=pdyResourceBase:"+base)
	}
	if options.AssetMode == AssetModeCDN {
		args = append(args, "--metadata=assetModeCdn:true")
	} else {
		args = append(args, "--metadata=assetModeOffline:true")
	}
	if options.EmbedResources {
		args = append(args, "--embed-resources")
	}
	return append(args, "--output", output)
}

func directoryFileURL(directory string) string {
	path := filepath.ToSlash(directory)
	base := url.URL{Scheme: "file"}
	if strings.HasPrefix(path, "//") {
		parts := strings.SplitN(strings.TrimPrefix(path, "//"), "/", 2)
		base.Host = parts[0]
		path = "/"
		if len(parts) == 2 {
			path += parts[1]
		}
	} else if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	base.Path = strings.TrimSuffix(path, "/") + "/"
	return base.String()
}

func runPandoc(binary string, args []string, assets string) error {
	cmd := exec.Command(binary, args...)
	cmd.Env = append(os.Environ(), "PDY_ASSETS_DIR="+assets)
	cmd.Stdout = os.Stdout
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		var exit *exec.ExitError
		if !errors.As(err, &exit) {
			return fmt.Errorf("run pandoc: %w", err)
		}
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("pandoc exited with code %d: %s", exit.ExitCode(), message)
	}
	return nil
}

func openInBrowser(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "linux":
		cmd = exec.Command("xdg-open", path)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", path)
	default:
		return fmt.Errorf("unsupported platform %s", runtime.GOOS)
	}
	return cmd.Run()
}

func quoteArgs(args []string) []string {
	quoted := make([]string, len(args))
	for i, arg := range args {
		quoted[i] = arg
		if strings.ContainsAny(arg, " \t\n\"'\\") {
			quoted[i] = fmt.Sprintf("%q", arg)
		}
	}
	return quoted
}
