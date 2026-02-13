package handlers

import (
	"net/http"
	"time"
)

// HealthHandler handles the /api/health endpoint.
type HealthHandler struct{}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

// Check responds with the current service health status.
func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"service":   "lightwatch-api",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
