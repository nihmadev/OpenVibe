package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

const githubAPI = "https://api.github.com/repos/nihmadev/OpenVibe/releases/latest"

type LatestRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
}

type UpdateResponse struct {
	Version    string `json:"version"`
	ReleaseURL string `json:"releaseUrl"`
	Platform   string `json:"platform"`
	Arch       string `json:"arch"`
	URL        string `json:"url"`
	SHA256     string `json:"sha256,omitempty"`
}

type LatestJSON struct {
	Version   string            `json:"version"`
	ReleaseAt string            `json:"releaseAt"`
	Platforms map[string]Asset  `json:"platforms"`
}

type Asset struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
}

func getLatestRelease() (*LatestRelease, error) {
	client := &http.Client{Timeout: 15 * time.Second}

	req, err := http.NewRequest("GET", githubAPI, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github api request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github api returned %d: %s", resp.StatusCode, string(body))
	}

	var release LatestRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to decode github response: %w", err)
	}

	return &release, nil
}

func handleUpdates(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")
	arch := r.URL.Query().Get("arch")

	if platform == "" || arch == "" {
		http.Error(w, `{"error":"platform and arch query params required"}`, http.StatusBadRequest)
		return
	}

	// First, try to fetch latest.json from the release assets
	release, err := getLatestRelease()
	if err != nil {
		log.Printf("failed to fetch latest release: %v", err)
		http.Error(w, `{"error":"failed to fetch release info"}`, http.StatusBadGateway)
		return
	}

	version := strings.TrimPrefix(release.TagName, "v")

	// Check if latest.json exists as a release asset
	for _, asset := range release.Assets {
		if asset.Name == "latest.json" {
			resp, err := http.Get(asset.URL)
			if err == nil && resp.StatusCode == http.StatusOK {
				var latest LatestJSON
				if err := json.NewDecoder(resp.Body).Decode(&latest); err == nil {
					resp.Body.Close()
					key := platform + "-" + arch
					if a, ok := latest.Platforms[key]; ok {
						json.NewEncoder(w).Encode(UpdateResponse{
							Version:    latest.Version,
							ReleaseURL: fmt.Sprintf("https://github.com/nihmadev/OpenVibe/releases/tag/v%s", latest.Version),
							Platform:   platform,
							Arch:       arch,
							URL:        a.URL,
							SHA256:     a.SHA256,
						})
						return
					}
				} else {
					resp.Body.Close()
				}
			} else if resp != nil {
				resp.Body.Close()
			}
			break
		}
	}

	// Fallback: construct from release assets
	extensions := map[string]string{
		"linux":   ".AppImage",
		"macos":   ".dmg",
		"windows": ".exe",
	}

	suffix := extensions[platform]
	if suffix == "" {
		http.Error(w, `{"error":"unsupported platform"}`, http.StatusBadRequest)
		return
	}

	var matchedURL string
	for _, asset := range release.Assets {
		if strings.HasSuffix(asset.Name, suffix) && strings.Contains(asset.Name, platform) {
			matchedURL = asset.URL
			break
		}
	}

	if matchedURL == "" {
		http.Error(w, fmt.Sprintf(`{"error":"no asset found for %s/%s"}`, platform, arch), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(UpdateResponse{
		Version:    version,
		ReleaseURL: fmt.Sprintf("https://github.com/nihmadev/OpenVibe/releases/tag/%s", release.TagName),
		Platform:   platform,
		Arch:       arch,
		URL:        matchedURL,
	})
}

func updateHealthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
