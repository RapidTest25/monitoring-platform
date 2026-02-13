package handlers

import (
	"net/http"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/usecase"
)

// LogsHandler handles HTTP requests for log events.
type LogsHandler struct {
	uc *usecase.QueryLogs
}

// NewLogsHandler creates a new LogsHandler.
func NewLogsHandler(uc *usecase.QueryLogs) *LogsHandler {
	return &LogsHandler{uc: uc}
}

// List handles GET /api/logs
func (h *LogsHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, limit := parsePagination(q)

	filter := domain.LogsFilter{
		Service: q.Get("service"),
		Level:   q.Get("level"),
		TraceID: q.Get("trace_id"),
		Query:   q.Get("q"),
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
