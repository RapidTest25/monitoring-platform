package usecase

import (
	"context"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// QueryServices encapsulates the use case of listing registered services.
type QueryServices struct {
	repo domain.ServicesRepository
}

// NewQueryServices creates a new QueryServices use case.
func NewQueryServices(repo domain.ServicesRepository) *QueryServices {
	return &QueryServices{repo: repo}
}

// Execute returns services matching the given filter.
func (uc *QueryServices) Execute(ctx context.Context, f domain.ServicesFilter) ([]domain.Service, int64, error) {
	return uc.repo.FindAll(ctx, f)
}
