package scripts_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestUnixInstallerResolvesRelativePaths(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix installer requires bash")
	}
	bash, err := exec.LookPath("bash")
	if err != nil {
		t.Skip("bash is unavailable")
	}
	script, err := filepath.Abs("install.sh")
	if err != nil {
		t.Fatal(err)
	}
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	repo := filepath.Join(dir, "repo with spaces")
	install := filepath.Join(dir, "installed tools")
	commands := filepath.Join(dir, "commands")
	if err := os.MkdirAll(filepath.Join(repo, "cmd", "pdy"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(commands, 0o755); err != nil {
		t.Fatal(err)
	}
	// The fixture builds offline. Only Go is exercised; the installer merely
	// checks for these other commands before building and running its smoke test.
	files := map[string]string{
		filepath.Join(repo, "go.mod"):                "module installerfixture\n\ngo 1.21\n",
		filepath.Join(repo, "cmd", "pdy", "main.go"): "package main\n\nfunc main() {}\n",
	}
	for path, source := range files {
		if err := os.WriteFile(path, []byte(source), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range []string{"git", "pandoc", "dprint"} {
		if err := os.WriteFile(filepath.Join(commands, name), []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	// Prepending the destination also keeps the installer from editing shell
	// startup files during this test.
	t.Setenv("PATH", install+string(os.PathListSeparator)+commands+string(os.PathListSeparator)+os.Getenv("PATH"))
	cmd := exec.Command(bash, script, "repo with spaces", "installed tools")
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GOWORK=off")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("relative-path installation failed: %v\n%s", err, output)
	}
	if strings.Contains(string(output), "Adding ") {
		t.Fatalf("installer unexpectedly attempted to update shell startup files:\n%s", output)
	}
	if _, err := os.Stat(filepath.Join(install, "pdy")); err != nil {
		t.Fatalf("binary was not installed in the requested directory: %v", err)
	}
	if _, err := os.Stat(filepath.Join(repo, "installed tools")); !os.IsNotExist(err) {
		t.Fatalf("installer created output inside the repository: %v", err)
	}
}

func TestUnixInstallerRejectsOldGo(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix installer requires bash")
	}
	bash, err := exec.LookPath("bash")
	if err != nil {
		t.Skip("bash is unavailable")
	}
	script, err := filepath.Abs("install.sh")
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	commands := filepath.Join(dir, "commands")
	if err := os.MkdirAll(commands, 0o755); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{
		"git": "exit 0", "pandoc": "exit 0", "dprint": "exit 0",
		"go": "echo 'go version go1.20.14 linux/amd64'",
	} {
		if err := os.WriteFile(filepath.Join(commands, name), []byte("#!/bin/sh\n"+body+"\n"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	cmd := exec.Command(bash, script, dir, filepath.Join(dir, "bin"))
	cmd.Env = append(os.Environ(), "PATH="+commands+string(os.PathListSeparator)+"/usr/bin"+string(os.PathListSeparator)+"/bin")
	output, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(output), "Go >= 1.21 is required") {
		t.Fatalf("installer accepted Go 1.20: %v\n%s", err, output)
	}
}
