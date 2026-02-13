package handlers

import (
	"net/http"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/usecase"
)

// ServicesHandler handles HTTP requests for service registry.
type ServicesHandler struct {
	uc *usecase.QueryServices
}

// NewServicesHandler creates a new ServicesHandler.
func NewServicesHandler(uc *usecase.QueryServices) *ServicesHandler {
	return &ServicesHandler{uc: uc}
}

// List handles GET /api/services
func (h *ServicesHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, limit := parsePagination(q)

	filter := domain.ServicesFilter{
		Status: q.Get("status"),
		Page:   page,
		Limit:  limit,
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
