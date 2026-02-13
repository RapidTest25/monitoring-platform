package domain

import "context"

// ── Repository Interfaces ──
// These interfaces enable dependency injection and testability.
// Usecases depend on these interfaces, not concrete repository types.

// LogsRepository defines the contract for log event persistence.
type LogsRepository interface {
	Find(ctx context.Context, f LogsFilter) ([]LogEvent, int64, error)
}

// MetricsRepository defines the contract for metric event persistence.
type MetricsRepository interface {
	Find(ctx context.Context, f MetricsFilter) ([]MetricEvent, int64, error)
}

// SecurityRepository defines the contract for security event persistence.
type SecurityRepository interface {
	Find(ctx context.Context, f SecurityFilter) ([]SecurityEvent, int64, error)
}

// AlertsRepository defines the contract for alert rule persistence.
type AlertsRepository interface {
	FindAll(ctx context.Context) ([]Alert, error)
	FindEnabled(ctx context.Context, service string) ([]Alert, error)
	Create(ctx context.Context, alert *Alert) (string, error)
}

// AlertEventsRepository defines the contract for triggered alert persistence.
type AlertEventsRepository interface {
	Create(ctx context.Context, event *AlertEvent) (string, error)
	FindByAlert(ctx context.Context, alertID string, limit int) ([]AlertEvent, error)
	FindRecent(ctx context.Context, limit int) ([]AlertEvent, error)
}

// ServicesRepository defines the contract for service registry persistence.
type ServicesRepository interface {
	FindAll(ctx context.Context, f ServicesFilter) ([]Service, int64, error)
}

// ── Filter Types ──

// LogsFilter holds query parameters for filtering logs.
type LogsFilter struct {
	Service string
	Level   string
	TraceID string
	Query   string
	From    string // RFC3339
	To      string // RFC3339
	Page    int
	Limit   int
}

// MetricsFilter holds query parameters for filtering metrics.
type MetricsFilter struct {
	Service string
	Name    string
	TraceID string
	From    string // RFC3339
	To      string // RFC3339
	Page    int
	Limit   int
}

// SecurityFilter holds query parameters for filtering security events.
type SecurityFilter struct {
	Service  string
	IP       string
	Type     string
	Severity string
	TraceID  string
	From     string // RFC3339
	To       string // RFC3339
	Page     int
	Limit    int
}

// ServicesFilter holds query parameters for filtering services.
type ServicesFilter struct {
	Status string
	Page   int
	Limit  int
}
