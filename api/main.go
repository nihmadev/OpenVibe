package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	timeoutStr := os.Getenv("TIMEOUT")
	timeoutSec := 120
	if t, err := strconv.Atoi(timeoutStr); err == nil && t > 0 {
		timeoutSec = t
	}

	warmupInterval := 0
	if w := os.Getenv("WARMUP_INTERVAL"); w != "" {
		if v, err := strconv.Atoi(w); err == nil && v > 0 {
			warmupInterval = v
		}
	}
	warmupURLs := os.Getenv("WARMUP_URLS")

	proxy := NewProxy(time.Duration(timeoutSec) * time.Second)

	if warmupInterval > 0 {
		urls := splitAndTrim(warmupURLs)
		if len(urls) > 0 {
			proxy.StartWarmup(warmupInterval, urls)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v3/", proxy.Route)
	mux.HandleFunc("/updates/latest", handleUpdates)
	mux.HandleFunc("/updates/health", updateHealthHandler)

	addr := ":" + port
	log.Printf("OpenVibe Proxy v3 starting on %s", addr)

	server := &http.Server{
		Addr:         addr,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func splitAndTrim(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			res = append(res, p)
		}
	}
	return res
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-provider-base-url")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
