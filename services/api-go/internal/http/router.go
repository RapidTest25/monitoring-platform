package http

import (
	"net/http"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/http/handlers"
)

// NewRouter builds the top-level ServeMux with all API routes.
// Uses only Go standard library net/http.
func NewRouter(
	logs *handlers.LogsHandler,
	metrics *handlers.MetricsHandler,
	security *handlers.SecurityHandler,
	alerts *handlers.AlertsHandler,
	services *handlers.ServicesHandler,
	health *handlers.HealthHandler,
) *http.ServeMux {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /api/health", health.Check)

	// Services
	mux.HandleFunc("GET /api/services", services.List)

	// Logs
	mux.HandleFunc("GET /api/logs", logs.List)

	// Metrics
	mux.HandleFunc("GET /api/metrics", metrics.List)

	// Security events
	mux.HandleFunc("GET /api/security", security.List)

	// Alerts
	mux.HandleFunc("GET /api/alerts", alerts.List)
	mux.HandleFunc("POST /api/alerts", alerts.Create)

	return mux
}
