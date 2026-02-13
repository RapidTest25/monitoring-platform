package domain

import "time"

// AlertCondition defines the threshold rule for triggering an alert.
type AlertCondition struct {
	Metric    string  `json:"metric" bson:"metric"`
	Operator  string  `json:"operator" bson:"operator"`                    // gt, lt, eq, gte, lte
	Threshold float64 `json:"threshold" bson:"threshold"`
	Duration  string  `json:"duration,omitempty" bson:"duration,omitempty"` // e.g. "5m"
}

// AlertType enumerates supported alert detection strategies.
const (
	AlertTypeThreshold  = "threshold"
	AlertTypeRateChange = "rate_change"
	AlertTypeAnomaly    = "anomaly"
)

// Alert represents an alert rule definition.
type Alert struct {
	ID        string         `json:"id" bson:"_id,omitempty"`
	Name      string         `json:"name" bson:"name"`
	Type      string         `json:"type" bson:"type"` // threshold, rate_change, anomaly
	Condition AlertCondition `json:"condition" bson:"condition"`
	Service   string         `json:"service" bson:"service"`
	Enabled   bool           `json:"enabled" bson:"enabled"`
	Channels  []string       `json:"channels,omitempty" bson:"channels,omitempty"` // websocket, webhook
	Webhook   string         `json:"webhook,omitempty" bson:"webhook,omitempty"`   // webhook URL
	CreatedAt time.Time      `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time      `json:"updated_at" bson:"updated_at"`
}

// AlertEvent represents a triggered alert instance.
type AlertEvent struct {
	ID          string                 `json:"id" bson:"_id,omitempty"`
	AlertID     string                 `json:"alert_id" bson:"alert_id"`
	AlertName   string                 `json:"alert_name" bson:"alert_name"`
	Service     string                 `json:"service" bson:"service"`
	TraceID     string                 `json:"trace_id,omitempty" bson:"trace_id,omitempty"`
	Value       float64                `json:"value" bson:"value"`
	Threshold   float64                `json:"threshold" bson:"threshold"`
	Status      string                 `json:"status" bson:"status"` // firing, resolved
	Meta        map[string]interface{} `json:"meta,omitempty" bson:"meta,omitempty"`
	TriggeredAt time.Time              `json:"triggered_at" bson:"triggered_at"`
	ResolvedAt  *time.Time             `json:"resolved_at,omitempty" bson:"resolved_at,omitempty"`
}
