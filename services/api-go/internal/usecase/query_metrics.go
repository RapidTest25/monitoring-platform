package usecase

import (
	"context"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// QueryMetrics encapsulates the use case of querying metric events.
type QueryMetrics struct {
	repo domain.MetricsRepository
}

// NewQueryMetrics creates a new QueryMetrics use case.
func NewQueryMetrics(repo domain.MetricsRepository) *QueryMetrics {
	return &QueryMetrics{repo: repo}
}

// Execute runs the metrics query with the given filter.
func (uc *QueryMetrics) Execute(ctx context.Context, f domain.MetricsFilter) ([]domain.MetricEvent, int64, error) {
	return uc.repo.Find(ctx, f)
}
