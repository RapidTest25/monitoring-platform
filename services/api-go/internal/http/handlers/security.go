package handlers

import (
	"net/http"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/usecase"
)

// SecurityHandler handles HTTP requests for security events.
type SecurityHandler struct {
	uc *usecase.QuerySecurity
}

// NewSecurityHandler creates a new SecurityHandler.
func NewSecurityHandler(uc *usecase.QuerySecurity) *SecurityHandler {
	return &SecurityHandler{uc: uc}
}

// List handles GET /api/security
func (h *SecurityHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, limit := parsePagination(q)

	filter := domain.SecurityFilter{
		Service:  q.Get("service"),
		IP:       q.Get("ip"),
		Type:     q.Get("type"),
		Severity: q.Get("severity"),
		TraceID:  q.Get("trace_id"),
		From:     q.Get("from"),
		To:       q.Get("to"),
		Page:     page,
		Limit:    limit,
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
