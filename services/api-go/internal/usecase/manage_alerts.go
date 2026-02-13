package usecase

import (
	"context"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// ManageAlerts encapsulates alert rule CRUD operations.
type ManageAlerts struct {
	repo domain.AlertsRepository
}

// NewManageAlerts creates a new ManageAlerts use case.
func NewManageAlerts(repo domain.AlertsRepository) *ManageAlerts {
	return &ManageAlerts{repo: repo}
}

// List returns all alert rules.
func (uc *ManageAlerts) List(ctx context.Context) ([]domain.Alert, error) {
	return uc.repo.FindAll(ctx)
}

// Create inserts a new alert rule.
func (uc *ManageAlerts) Create(ctx context.Context, alert *domain.Alert) (string, error) {
	return uc.repo.Create(ctx, alert)
}
