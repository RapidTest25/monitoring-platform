package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/usecase"
)

// AlertsHandler handles HTTP requests for alert rules.
type AlertsHandler struct {
	uc *usecase.ManageAlerts
}

// NewAlertsHandler creates a new AlertsHandler.
func NewAlertsHandler(uc *usecase.ManageAlerts) *AlertsHandler {
	return &AlertsHandler{uc: uc}
}

// List handles GET /api/alerts
func (h *AlertsHandler) List(w http.ResponseWriter, r *http.Request) {
	alerts, err := h.uc.List(r.Context())
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	JSON(w, http.StatusOK, map[string]interface{}{"data": alerts})
}

// Create handles POST /api/alerts
func (h *AlertsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var alert domain.Alert
	if err := json.NewDecoder(r.Body).Decode(&alert); err != nil {
		Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if alert.Name == "" || alert.Service == "" {
		Error(w, http.StatusBadRequest, "name and service are required")
		return
	}
	if alert.Condition.Metric == "" || alert.Condition.Operator == "" {
		Error(w, http.StatusBadRequest, "condition.metric and condition.operator are required")
		return
	}

	now := time.Now().UTC()
	alert.CreatedAt = now
	alert.UpdatedAt = now
	if alert.Type == "" {
		alert.Type = domain.AlertTypeThreshold
	}

	id, err := h.uc.Create(r.Context(), &alert)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, map[string]string{"id": id})
}
