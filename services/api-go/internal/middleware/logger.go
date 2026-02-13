package middleware

import (
	"net/http"
	"time"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/observability"
)

// statusWriter wraps ResponseWriter to capture the status code.
type statusWriter struct {
	http.ResponseWriter
	code int
}

func (w *statusWriter) WriteHeader(code int) {
	w.code = code
	w.ResponseWriter.WriteHeader(code)
}

// Logger returns middleware that logs every request with method, path, status, and duration.
func Logger(log *observability.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			sw := &statusWriter{ResponseWriter: w, code: http.StatusOK}
			next.ServeHTTP(sw, r)

			log.Info("request", map[string]interface{}{
				"method":   r.Method,
				"path":     r.URL.Path,
				"status":   sw.code,
				"duration": time.Since(start).String(),
				"remote":   r.RemoteAddr,
			})

			observability.GlobalCounters.RequestsTotal.Add(1)
			if sw.code >= 400 {
				observability.GlobalCounters.RequestsFailed.Add(1)
			}
		})
	}
}
