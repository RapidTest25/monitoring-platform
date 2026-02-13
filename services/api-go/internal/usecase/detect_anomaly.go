package usecase

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/observability"
)

// DetectAnomaly evaluates alert rules against recent metrics and
// generates AlertEvents when thresholds are breached.
//
// Architecture:
//   - Runs periodically (caller invokes Tick in a goroutine loop)
//   - Reads enabled alerts → queries recent metrics per rule
//   - Evaluates condition (operator + threshold)
//   - Creates AlertEvent, optionally calls webhook and/or publishes to Redis
//
// Supported detection strategies:
//   - threshold:   value <operator> threshold (single point)
//   - rate_change: (future) percentage change over duration window
//   - anomaly:     (future) statistical deviation detection
type DetectAnomaly struct {
	alerts      domain.AlertsRepository
	alertEvents domain.AlertEventsRepository
	metrics     domain.MetricsRepository
	logger      *observability.Logger
}

// NewDetectAnomaly creates a fully-wired alert engine.
func NewDetectAnomaly(
	alerts domain.AlertsRepository,
	alertEvents domain.AlertEventsRepository,
	metrics domain.MetricsRepository,
	logger *observability.Logger,
) *DetectAnomaly {
	return &DetectAnomaly{
		alerts:      alerts,
		alertEvents: alertEvents,
		metrics:     metrics,
		logger:      logger,
	}
}

// Start runs the detection loop in a background goroutine.
// It evaluates rules every interval until ctx is cancelled.
func (d *DetectAnomaly) Start(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		d.logger.Info("alert engine started", map[string]interface{}{
			"interval": interval.String(),
		})

		for {
			select {
			case <-ctx.Done():
				d.logger.Info("alert engine stopped")
				return
			case <-ticker.C:
				if err := d.Tick(ctx); err != nil {
					d.logger.Error("alert engine tick failed", map[string]interface{}{
						"error": err.Error(),
					})
				}
			}
		}
	}()
}

// Tick runs a single evaluation cycle across all enabled alert rules.
func (d *DetectAnomaly) Tick(ctx context.Context) error {
	rules, err := d.alerts.FindEnabled(ctx, "")
	if err != nil {
		return fmt.Errorf("fetch enabled alerts: %w", err)
	}

	for _, rule := range rules {
		if err := d.evaluate(ctx, rule); err != nil {
			d.logger.Warn("rule evaluation failed", map[string]interface{}{
				"alert_id": rule.ID,
				"name":     rule.Name,
				"error":    err.Error(),
			})
		}
	}
	return nil
}

func (d *DetectAnomaly) evaluate(ctx context.Context, rule domain.Alert) error {
	// Query recent metrics matching the alert's target metric and service
	window := "5m"
	if rule.Condition.Duration != "" {
		window = rule.Condition.Duration
	}
	dur, err := parseDuration(window)
	if err != nil {
		dur = 5 * time.Minute
	}

	from := time.Now().Add(-dur).Format(time.RFC3339)
	filter := domain.MetricsFilter{
		Service: rule.Service,
		Name:    rule.Condition.Metric,
		From:    from,
		Limit:   100,
	}

	events, _, err := d.metrics.Find(ctx, filter)
	if err != nil {
		return fmt.Errorf("query metrics: %w", err)
	}

	if len(events) == 0 {
		return nil // no data to evaluate
	}

	// Evaluate using latest value (threshold strategy)
	latest := events[0]
	if !d.breached(latest.Value, rule.Condition.Operator, rule.Condition.Threshold) {
		return nil
	}

	// Threshold breached — create alert event
	alertEvt := &domain.AlertEvent{
		AlertID:     rule.ID,
		AlertName:   rule.Name,
		Service:     rule.Service,
		Value:       latest.Value,
		Threshold:   rule.Condition.Threshold,
		Status:      "firing",
		TriggeredAt: time.Now(),
		Meta: map[string]interface{}{
			"metric":   rule.Condition.Metric,
			"operator": rule.Condition.Operator,
			"unit":     latest.Unit,
		},
	}

	id, err := d.alertEvents.Create(ctx, alertEvt)
	if err != nil {
		return fmt.Errorf("create alert event: %w", err)
	}

	d.logger.Warn("alert triggered", map[string]interface{}{
		"alert_event_id": id,
		"alert_name":     rule.Name,
		"service":        rule.Service,
		"value":          latest.Value,
		"threshold":      rule.Condition.Threshold,
	})

	// Fire webhook if configured
	if rule.Webhook != "" {
		go d.fireWebhook(rule.Webhook, alertEvt)
	}

	return nil
}

func (d *DetectAnomaly) breached(value float64, operator string, threshold float64) bool {
	switch operator {
	case "gt":
		return value > threshold
	case "gte":
		return value >= threshold
	case "lt":
		return value < threshold
	case "lte":
		return value <= threshold
	case "eq":
		return value == threshold
	default:
		return false
	}
}

func (d *DetectAnomaly) fireWebhook(url string, evt *domain.AlertEvent) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	body := fmt.Sprintf(
		`{"alert_name":"%s","service":"%s","value":%f,"threshold":%f,"status":"%s","triggered_at":"%s"}`,
		evt.AlertName, evt.Service, evt.Value, evt.Threshold, evt.Status,
		evt.TriggeredAt.Format(time.RFC3339),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(body))
	if err != nil {
		d.logger.Error("webhook request build failed", map[string]interface{}{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		d.logger.Error("webhook delivery failed", map[string]interface{}{
			"url":   url,
			"error": err.Error(),
		})
		return
	}
	resp.Body.Close()

	d.logger.Info("webhook delivered", map[string]interface{}{
		"url":    url,
		"status": resp.StatusCode,
	})
}

// parseDuration parses duration strings like "5m", "1h", "30s".
func parseDuration(s string) (time.Duration, error) {
	return time.ParseDuration(s)
}
