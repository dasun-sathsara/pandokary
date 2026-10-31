package main

import (
	"strings"
	"testing"
)

func TestConfigEmbedResources(t *testing.T) {
	tests := []struct {
		name string
		cfg  config
		want bool
	}{
		{name: "CDN defaults to external resources", cfg: config{assetMode: "cdn"}},
		{name: "embed enables CDN resource embedding", cfg: config{assetMode: "cdn", embed: true}, want: true},
		{name: "offline mode embeds resources", cfg: config{assetMode: "offline"}, want: true},
		{name: "no-embed overrides CDN embed", cfg: config{assetMode: "cdn", embed: true, noEmbed: true}},
		{name: "no-embed overrides offline mode", cfg: config{assetMode: "offline", noEmbed: true}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := test.cfg.embedResources(); got != test.want {
				t.Fatalf("embedResources() = %t, want %t", got, test.want)
			}
		})
	}
}

func TestParseConfigRejectsFlagsAfterInput(t *testing.T) {
	for _, args := range [][]string{
		{"-e", "notes.md", "--embed"},
		{"notes.md", "--no-fmt"},
		{"-e", "notes.md", "-x"},
	} {
		if _, err := parseConfig(args); err == nil || !strings.Contains(err.Error(), "must come before") {
			t.Errorf("parseConfig(%q) error = %v, want a misplaced-flag error", args, err)
		}
	}
	cfg, err := parseConfig([]string{"-e", "--embed", "notes.md", "out"})
	if err != nil || cfg.inputPath != "notes.md" || cfg.exportName != "out" || !cfg.embed {
		t.Errorf("valid arguments: cfg = %+v, err = %v", cfg, err)
	}
	if _, err := parseConfig([]string{"-e", "--", "-notes.md", "-out"}); err != nil {
		t.Errorf("-- must allow dash-prefixed names: %v", err)
	}
}
