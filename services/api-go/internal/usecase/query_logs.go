package usecase

import (
	"context"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// QueryLogs encapsulates the use case of querying log events.
type QueryLogs struct {
	repo domain.LogsRepository
}

// NewQueryLogs creates a new QueryLogs use case.
func NewQueryLogs(repo domain.LogsRepository) *QueryLogs {
	return &QueryLogs{repo: repo}
}

// Execute runs the log query with the given filter.
func (uc *QueryLogs) Execute(ctx context.Context, f domain.LogsFilter) ([]domain.LogEvent, int64, error) {
	return uc.repo.Find(ctx, f)
}
