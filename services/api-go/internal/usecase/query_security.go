package usecase

import (
	"context"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// QuerySecurity encapsulates the use case of querying security events.
type QuerySecurity struct {
	repo domain.SecurityRepository
}

// NewQuerySecurity creates a new QuerySecurity use case.
func NewQuerySecurity(repo domain.SecurityRepository) *QuerySecurity {
	return &QuerySecurity{repo: repo}
}

// Execute runs the security events query with the given filter.
func (uc *QuerySecurity) Execute(ctx context.Context, f domain.SecurityFilter) ([]domain.SecurityEvent, int64, error) {
	return uc.repo.Find(ctx, f)
}
