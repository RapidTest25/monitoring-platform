package middleware

import (
	"net/http"
)

// Auth returns middleware that validates the x-api-key header.
// If apiKey is empty, the middleware is a pass-through (no auth required).
func Auth(apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if apiKey == "" {
				next.ServeHTTP(w, r)
				return
			}

			key := r.Header.Get("x-api-key")
			if key != apiKey {
				http.Error(w,
					`{"error":"unauthorized","message":"invalid or missing API key"}`,
					http.StatusUnauthorized,
				)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
