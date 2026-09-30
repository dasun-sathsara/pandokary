package pdy

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func formatMarkdown(input string, verbose bool) error {
	binary, err := exec.LookPath("dprint")
	if err != nil {
		return fmt.Errorf("dprint not found: %w", err)
	}
	source, err := os.ReadFile(input)
	if err != nil {
		return err
	}
	cmd := exec.Command(binary, "fmt", "--stdin", input)
	cmd.Stdin = bytes.NewReader(source)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err = cmd.Run(); err != nil {
		return fmt.Errorf("dprint failed: %s: %w", strings.TrimSpace(stderr.String()), err)
	}
	if stdout.Len() == 0 || bytes.Equal(source, stdout.Bytes()) {
		if verbose {
			fmt.Fprintln(os.Stderr, "source Markdown already formatted")
		}
		return nil
	}
	target, err := filepath.EvalSymlinks(input)
	if err != nil {
		return fmt.Errorf("resolve formatting target: %w", err)
	}
	info, err := os.Stat(target)
	if err != nil {
		return fmt.Errorf("inspect formatting target: %w", err)
	}
	output, err := stageOutput(target, info, ".pdy-fmt-*")
	if err != nil {
		return fmt.Errorf("stage formatted source: %w", err)
	}
	defer output.close()
	if err := os.WriteFile(output.path, stdout.Bytes(), 0o600); err != nil {
		return fmt.Errorf("write formatted source: %w", err)
	}
	if err := output.commit(); err != nil {
		return fmt.Errorf("save formatted source: %w", err)
	}
	if verbose {
		fmt.Fprintf(os.Stderr, "formatted source Markdown: %s\n", input)
	}
	return nil
}
