package pdy

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// Use the test binary as a deterministic formatter/Pandoc process, including
// Pandoc's ability to write some output before reporting a conversion error.
func TestMain(m *testing.M) {
	if mode := os.Getenv("PDY_TEST_PROCESS"); mode != "" {
		if mode == "format" || (len(os.Args) > 1 && os.Args[1] == "fmt") {
			source, err := io.ReadAll(os.Stdin)
			if err != nil {
				os.Exit(1)
			}
			fmt.Print(strings.ReplaceAll(string(source), "original", "formatted"))
			os.Exit(0)
		}
		for i, arg := range os.Args[1:] {
			if arg != "--output" {
				continue
			}
			if err := os.WriteFile(os.Args[i+2], []byte("<html>converted</html>"), 0o644); err != nil {
				os.Exit(1)
			}
			if mode == "fail" {
				fmt.Fprintln(os.Stderr, "conversion failed after writing output")
				os.Exit(23)
			}
			os.Exit(0)
		}
		os.Exit(1)
	}
	os.Exit(m.Run())
}

func testProcess(t *testing.T, mode string) string {
	t.Helper()
	t.Setenv("PDY_TEST_PROCESS", mode)
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	return binary
}

func TestFailedExportPreservesDestination(t *testing.T) {
	for _, exists := range []bool{false, true} {
		t.Run(fmt.Sprintf("existing=%t", exists), func(t *testing.T) {
			dir := t.TempDir()
			input := filepath.Join(dir, "notes.md")
			output := filepath.Join(dir, "notes.html")
			if err := os.WriteFile(input, []byte("original source\n"), 0o644); err != nil {
				t.Fatal(err)
			}
			if exists {
				if err := os.WriteFile(output, []byte("previous export"), 0o640); err != nil {
					t.Fatal(err)
				}
			}
			_, err := Run(Options{InputPath: input, Export: true, ExportName: output, PandocPath: testProcess(t, "fail")})
			if err == nil || !strings.Contains(err.Error(), "code 23") {
				t.Fatalf("expected conversion failure, got %v", err)
			}
			data, readErr := os.ReadFile(output)
			if exists {
				if readErr != nil || string(data) != "previous export" {
					t.Fatalf("failed conversion damaged the previous export: %q, %v", data, readErr)
				}
			} else if !os.IsNotExist(readErr) {
				t.Fatalf("failed conversion left an incomplete export: %q, %v", data, readErr)
			}
			assertNoStagedOutput(t, dir)
		})
	}
}

func TestSuccessfulExportReplacesDestination(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "notes.md")
	output := filepath.Join(dir, "notes.html")
	for path, content := range map[string]string{input: "original source\n", output: "previous export"} {
		if err := os.WriteFile(path, []byte(content), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	result, err := Run(Options{InputPath: input, Export: true, ExportName: output, PandocPath: testProcess(t, "success")})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.OutputPath)
	if err != nil || string(data) != "<html>converted</html>" {
		t.Fatalf("unexpected export: %q, %v", data, err)
	}
	info, err := os.Stat(output)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o640 {
		t.Errorf("existing export permissions changed to %o", info.Mode().Perm())
	}
	assertNoStagedOutput(t, dir)
}

func assertNoStagedOutput(t *testing.T, dir string) {
	t.Helper()
	staged, err := filepath.Glob(filepath.Join(dir, ".pdy-export-*"))
	if err != nil || len(staged) != 0 {
		t.Errorf("staged outputs were not cleaned up: %v, %v", staged, err)
	}
}

func TestExportRejectsSourceDestination(t *testing.T) {
	for _, alias := range []string{"same path", "symlink", "hardlink"} {
		t.Run(alias, func(t *testing.T) {
			dir := t.TempDir()
			input := filepath.Join(dir, "source.html")
			if err := os.WriteFile(input, []byte("original source\n"), 0o644); err != nil {
				t.Fatal(err)
			}
			output := input
			if alias != "same path" {
				output = filepath.Join(dir, "alias.html")
				link := os.Symlink
				if alias == "hardlink" {
					link = os.Link
				}
				if err := link(input, output); err != nil {
					t.Skipf("cannot create %s: %v", alias, err)
				}
			}
			binary := testProcess(t, "success")
			installTestFormatter(t, binary)
			_, err := Run(Options{InputPath: input, Export: true, ExportName: output, FormatMarkdown: true, PandocPath: binary})
			if err == nil {
				t.Fatal("export must reject a destination that aliases its source")
			}
			data, err := os.ReadFile(input)
			if err != nil || string(data) != "original source\n" {
				t.Fatalf("export overwrote its source: %q, %v", data, err)
			}
		})
	}
}

func TestFormatMarkdownPreservesSourceSymlink(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "source.md")
	input := filepath.Join(dir, "alias.md")
	if err := os.WriteFile(target, []byte("original source\n"), 0o640); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(target, input); err != nil {
		t.Skipf("cannot create source symlink: %v", err)
	}
	installTestFormatter(t, testProcess(t, "format"))
	if err := formatMarkdown(input, false); err != nil {
		t.Fatal(err)
	}
	info, err := os.Lstat(input)
	if err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("formatter replaced the source symlink: %v, %v", info, err)
	}
	data, err := os.ReadFile(target)
	if err != nil || string(data) != "formatted source\n" {
		t.Fatalf("formatter did not update the symlink target: %q, %v", data, err)
	}
	info, err = os.Stat(target)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o640 {
		t.Errorf("source permissions changed to %o", info.Mode().Perm())
	}
}

func installTestFormatter(t *testing.T, binary string) {
	t.Helper()
	dir := t.TempDir()
	name := "dprint"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	if err := os.Link(binary, filepath.Join(dir, name)); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

func TestExportPreservesDestinationSymlink(t *testing.T) {
	dir := t.TempDir()
	input := filepath.Join(dir, "notes.md")
	target := filepath.Join(dir, "target.html")
	output := filepath.Join(dir, "alias.html")
	for path, content := range map[string]string{input: "original source\n", target: "previous export"} {
		if err := os.WriteFile(path, []byte(content), 0o640); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Symlink(target, output); err != nil {
		t.Skipf("cannot create output symlink: %v", err)
	}
	_, err := Run(Options{InputPath: input, Export: true, ExportName: output, PandocPath: testProcess(t, "success")})
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Lstat(output)
	if err != nil || info.Mode()&os.ModeSymlink == 0 {
		t.Fatalf("export replaced its destination symlink: %v, %v", info, err)
	}
	data, err := os.ReadFile(target)
	if err != nil || string(data) != "<html>converted</html>" {
		t.Fatalf("export did not update the symlink target: %q, %v", data, err)
	}
	assertNoStagedOutput(t, dir)
}
