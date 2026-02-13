package handlers

import (
	"net/http"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/usecase"
)

// MetricsHandler handles HTTP requests for metric events.
type MetricsHandler struct {
	uc *usecase.QueryMetrics
}

// NewMetricsHandler creates a new MetricsHandler.
func NewMetricsHandler(uc *usecase.QueryMetrics) *MetricsHandler {
	return &MetricsHandler{uc: uc}
}

// List handles GET /api/metrics
func (h *MetricsHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, limit := parsePagination(q)

	filter := domain.MetricsFilter{
		Service: q.Get("service"),
		Name:    q.Get("name"),
		TraceID: q.Get("trace_id"),
		From:    q.Get("from"),
		To:      q.Get("to"),
		Page:    page,
		Limit:   limit,
	}

	data, total, err := h.uc.Execute(r.Context(), filter)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, PaginatedResponse{
		Data:  data,
		Total: total,
		Page:  page,
		Limit: limit,
	})
}
