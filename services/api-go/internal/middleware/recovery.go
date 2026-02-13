package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/observability"
)

// Recovery catches panics in handlers and returns a 500 response.
func Recovery(log *observability.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error("panic recovered", map[string]interface{}{
						"error": fmt.Sprintf("%v", rec),
						"stack": string(debug.Stack()),
					})
					http.Error(w,
						`{"error":"internal_server_error","message":"an unexpected error occurred"}`,
						http.StatusInternalServerError,
					)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
