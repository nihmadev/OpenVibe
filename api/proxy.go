package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode"
)

type Proxy struct {
	streamClient  *http.Client
	shortClient   *http.Client
	timeout       time.Duration
	warmTargets   map[string]struct{}
	warmMu        sync.RWMutex
	warmTransport *http.Transport
}

func NewProxy(timeout time.Duration) *Proxy {
	streamTransport := &http.Transport{
		MaxIdleConns:        500,
		MaxIdleConnsPerHost: 200,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  true,
		ForceAttemptHTTP2:   true,
		WriteBufferSize:     65536,
		ReadBufferSize:      65536,
	}

	shortTransport := &http.Transport{
		MaxIdleConns:        500,
		MaxIdleConnsPerHost: 200,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  true,
		ForceAttemptHTTP2:   true,
		WriteBufferSize:     65536,
		ReadBufferSize:      65536,
	}

	warmTransport := &http.Transport{
		MaxIdleConns:        500,
		MaxIdleConnsPerHost: 200,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  true,
		ForceAttemptHTTP2:   true,
	}

	p := &Proxy{
		streamClient: &http.Client{
			Transport: streamTransport,
			Timeout:   0,
		},
		shortClient: &http.Client{
			Transport: shortTransport,
			Timeout:   timeout,
		},
		timeout:       timeout,
		warmTargets:   make(map[string]struct{}),
		warmTransport: warmTransport,
	}

	go p.warmLoop()
	return p
}

func (p *Proxy) StartWarmup(intervalSec int, urls []string) {
	p.warmMu.Lock()
	for _, u := range urls {
		p.warmTargets[u] = struct{}{}
	}
	p.warmMu.Unlock()
}

func (p *Proxy) WarmProvider(baseURL string) {
	if baseURL == "" {
		return
	}
	p.warmMu.RLock()
	_, ok := p.warmTargets[baseURL]
	p.warmMu.RUnlock()

	if !ok {
		p.warmMu.Lock()
		p.warmTargets[baseURL] = struct{}{}
		p.warmMu.Unlock()
	}
}

func (p *Proxy) warmLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	client := &http.Client{
		Transport: p.warmTransport,
		Timeout:   10 * time.Second,
	}

	for range ticker.C {
		p.warmMu.RLock()
		targets := make([]string, 0, len(p.warmTargets))
		for u := range p.warmTargets {
			targets = append(targets, u)
		}
		p.warmMu.RUnlock()

		for _, base := range targets {
			modelsURL := strings.TrimRight(base, "/") + "/models"
			req, _ := http.NewRequest("GET", modelsURL, nil)
			req.Header.Set("Accept", "application/json")
			resp, err := client.Do(req)
			if resp != nil {
				resp.Body.Close()
			}
			if err != nil {
				log.Printf("warm %s: %v", base, err)
			}
		}
	}
}

func (p *Proxy) Route(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/v3/")

	if path == "health" || path == "health/" {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
		return
	}

	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 1 || parts[0] == "" {
		http.Error(w, `{"error":"missing provider_id"}`, http.StatusBadRequest)
		return
	}
	providerID := parts[0]

	var targetPath string
	if len(parts) == 2 {
		targetPath = parts[1]
	} else {
		targetPath = ""
	}

	switch targetPath {
	case "chat/completions":
		p.handleChatCompletions(w, r, providerID)
	case "models":
		p.handleModels(w, r, providerID)
	default:
		http.Error(w, `{"error":"unknown endpoint"}`, http.StatusNotFound)
	}
}

var allowedHosts = map[string]bool{
	"api.anthropic.com":                 true,
	"api.openai.com":                    true,
	"generativelanguage.googleapis.com": true,
	"api.deepseek.com":                  true,
	"api.groq.com":                      true,
	"openrouter.ai":                     true,
	"api.cerebras.ai":                   true,
	"api.moonshot.cn":                   true,
	"api.z.ai":                          true,
	"opencode.ai":                       true,
	"models.github.ai":                  true,
	"api.together.ai":                   true,
	"api.fireworks.ai":                  true,
	"api.mistral.ai":                    true,
	"api.x.ai":                          true,
	"api.cohere.ai":                     true,
	"dashscope.aliyuncs.com":            true,
	"router.huggingface.co":             true,
	"api.replicate.com":                 true,
	"api.deepinfra.com":                 true,
	"api.perplexity.ai":                 true,
	"api.endpoints.anyscale.com":        true,
	"gateway.vercel.ai":                 true,
	"api.fal.ai":                        true,
	"app.baseten.co":                    true,
	"api.hyperbolic.xyz":                true,
	"api.minimax.chat":                  true,
	"integrate.api.nvidia.com":          true,
	"api.sambanova.ai":                  true,
	"api.siliconflow.cn":                true,
}

func isAllowedHost(host string) bool {
	h := strings.ToLower(host)
	if allowedHosts[h] {
		return true
	}
	if strings.HasSuffix(h, ".openai.azure.com") {
		return true
	}
	if strings.HasSuffix(h, ".amazonaws.com") {
		return true
	}
	return false
}

func (p *Proxy) buildUpstreamURL(r *http.Request, providerID, suffix string) (string, bool) {
	baseURL := r.Header.Get("x-provider-base-url")
	if baseURL == "" {
		return "", false
	}
	baseURL = strings.TrimRight(baseURL, "/")

	parsedURL, err := url.Parse(baseURL)
	if err != nil || !isAllowedHost(parsedURL.Hostname()) {
		return "", false
	}

	apiKey := r.Header.Get("x-api-key")

	if strings.Contains(baseURL, "generativelanguage.googleapis.com") {
		if strings.Contains(baseURL, "?") {
			return baseURL + suffix, true
		}
		sep := "?"
		if strings.Contains(baseURL, "?") {
			sep = "&"
		}
		return baseURL + sep + "key=" + apiKey + suffix, false
	}

	if strings.Contains(baseURL, "models.github.ai") {
		return baseURL + "/inference" + suffix, true
	}

	return baseURL + suffix, false
}

func (p *Proxy) handleChatCompletions(w http.ResponseWriter, r *http.Request, providerID string) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	upstreamURL, isGoogle := p.buildUpstreamURL(r, providerID, "/chat/completions")
	if upstreamURL == "" {
		http.Error(w, `{"error":"x-provider-base-url header required"}`, http.StatusBadRequest)
		return
	}

	upReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, upstreamURL, r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to create upstream request"}`, http.StatusInternalServerError)
		return
	}

	upReq.Header = r.Header.Clone()
	upReq.Header.Del("x-provider-base-url")
	apiKey := r.Header.Get("x-api-key")
	upReq.Header.Del("x-api-key")
	upReq.Header.Set("Accept-Encoding", "identity")

	if providerID == "anthropic" {
		if apiKey != "" {
			upReq.Header.Set("x-api-key", apiKey)
			upReq.Header.Set("anthropic-version", "2023-06-01")
		}
	} else if isGoogle {
		upReq.Header.Del("Authorization")
	}

	upRes, err := p.streamClient.Do(upReq)
	if err != nil {
		log.Printf("upstream request failed: %v", err)
		http.Error(w, `{"error":"upstream request failed"}`, http.StatusBadGateway)
		return
	}
	defer upRes.Body.Close()

	baseURL := r.Header.Get("x-provider-base-url")
	if baseURL != "" {
		go p.WarmProvider(baseURL)
	}

	w.Header().Del("Content-Length")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	for k, vv := range upRes.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.Header().Del("Transfer-Encoding")
	w.WriteHeader(upRes.StatusCode)

	if upRes.StatusCode != http.StatusOK {
		io.Copy(w, upRes.Body)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		io.Copy(w, upRes.Body)
		return
	}

	bufPtr := bufPool.Get().(*[]byte)
	buf := *bufPtr
	defer bufPool.Put(bufPtr)

	for {
		n, readErr := upRes.Body.Read(buf)
		if n > 0 {
			if _, writeErr := w.Write(buf[:n]); writeErr != nil {
				break
			}
			flusher.Flush()
		}
		if readErr != nil {
			break
		}
	}
}

var bufPool = sync.Pool{
	New: func() interface{} {
		b := make([]byte, 32768)
		return &b
	},
}

func (p *Proxy) handleModels(w http.ResponseWriter, r *http.Request, providerID string) {
	upstreamURL, isGoogle := p.buildUpstreamURL(r, providerID, "/models")
	if upstreamURL == "" {
		http.Error(w, `{"error":"x-provider-base-url header required"}`, http.StatusBadRequest)
		return
	}

	upReq, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstreamURL, nil)
	if err != nil {
		http.Error(w, `{"error":"failed to create upstream request"}`, http.StatusInternalServerError)
		return
	}

	upReq.Header.Set("Content-Type", "application/json")
	apiKey := r.Header.Get("x-api-key")

	if providerID == "anthropic" {
		if apiKey != "" {
			upReq.Header.Set("x-api-key", apiKey)
			upReq.Header.Set("anthropic-version", "2023-06-01")
		}
	} else if !isGoogle {
		if apiKey != "" {
			upReq.Header.Set("Authorization", "Bearer "+apiKey)
		}
	}

	if strings.Contains(upstreamURL, "models.github.ai") {
		upReq.Header.Set("Accept", "application/vnd.github+json")
		upReq.Header.Set("X-GitHub-Api-Version", "2026-03-10")
	}

	upRes, err := p.shortClient.Do(upReq)
	if err != nil {
		log.Printf("models upstream request failed: %v", err)
		http.Error(w, `{"error":"models upstream request failed"}`, http.StatusBadGateway)
		return
	}
	defer upRes.Body.Close()

	respBody, _ := io.ReadAll(upRes.Body)

	if upRes.StatusCode == http.StatusOK {
		if enriched := enrichModelNames(respBody); enriched != nil {
			respBody = enriched
		}
	}

	for k, vv := range upRes.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.Header().Del("Content-Length")
	w.Header().Del("Transfer-Encoding")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(upRes.StatusCode)
	w.Write(respBody)
}

func enrichModelNames(body []byte) []byte {
	var data any
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}

	switch v := data.(type) {
	case map[string]any:
		if arr, ok := v["data"].([]any); ok {
			v["data"] = enrichModelArray(arr)
		}
		if arr, ok := v["models"].([]any); ok {
			v["models"] = enrichModelArray(arr)
		}
	case []any:
		data = enrichModelArray(v)
	}

	result, err := json.Marshal(data)
	if err != nil {
		return nil
	}
	return result
}

func enrichModelArray(models []any) []any {
	for _, m := range models {
		entry, ok := m.(map[string]any)
		if !ok {
			continue
		}
		id, _ := entry["id"].(string)
		if id == "" {
			continue
		}
		if _, hasName := entry["name"]; !hasName {
			entry["name"] = parseModelName(id)
		}
	}
	return models
}

func parseModelName(id string) string {
	if idx := strings.Index(id, "/"); idx >= 0 {
		id = id[idx+1:]
	}
	if id == "" {
		return id
	}

	parts := strings.Split(id, "-")

	allCaps := map[string]bool{"gpt": true, "glm": true}
	mixedCase := map[string]string{"deepseek": "DeepSeek"}

	var words []string
	var numBuf []string

	flushNums := func() {
		if len(numBuf) > 0 {
			words = append(words, strings.Join(numBuf, "."))
			numBuf = nil
		}
	}

	for _, p := range parts {
		if p == "" {
			continue
		}
		lower := strings.ToLower(p)

		if allCaps[lower] {
			flushNums()
			words = append(words, strings.ToUpper(p))
			continue
		}
		if mapped, ok := mixedCase[lower]; ok {
			flushNums()
			words = append(words, mapped)
			continue
		}

		if isNumeric(p) {
			numBuf = append(numBuf, p)
			continue
		}

		flushNums()

		rs := []rune(p)
		if len(rs) > 0 && unicode.IsLetter(rs[0]) {
			if len(rs) > 1 && isNumericLike(string(rs[1:])) {
				words = append(words, string(unicode.ToUpper(rs[0]))+string(rs[1:]))
				continue
			}
			words = append(words, string(unicode.ToUpper(rs[0]))+strings.ToLower(string(rs[1:])))
			continue
		}

		words = append(words, p)
	}
	flushNums()

	return strings.Join(words, " ")
}

func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

func isNumericLike(s string) bool {
	if s == "" {
		return false
	}
	for i, r := range s {
		if i == 0 && r == '.' {
			return false
		}
		if !unicode.IsDigit(r) && r != '.' {
			return false
		}
	}
	return true
}
