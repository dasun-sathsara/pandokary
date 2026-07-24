package main

import "testing"

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
