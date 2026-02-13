package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimit provides a simple in-memory per-IP sliding window rate limiter.
func RateLimit(maxRequests int, window time.Duration) func(http.Handler) http.Handler {
	type record struct {
		count int
		start time.Time
	}

	var mu sync.Mutex
	hits := make(map[string]*record)

	// Background cleanup
	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			mu.Lock()
			now := time.Now()
			for ip, r := range hits {
				if now.Sub(r.start) > window {
					delete(hits, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			mu.Lock()
			rec, ok := hits[ip]
			now := time.Now()
			if !ok || now.Sub(rec.start) > window {
				rec = &record{start: now, count: 0}
				hits[ip] = rec
			}
			rec.count++
			count := rec.count
			mu.Unlock()

			if count > maxRequests {
				http.Error(w,
					`{"error":"rate_limited","message":"too many requests"}`,
					http.StatusTooManyRequests,
				)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
