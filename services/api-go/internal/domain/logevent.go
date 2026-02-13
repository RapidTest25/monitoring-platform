package domain

import "time"

type LogEvent struct {
	ID            string                 `json:"id" bson:"_id,omitempty"`
	EventID       string                 `json:"event_id,omitempty" bson:"event_id,omitempty"`
	TraceID       string                 `json:"trace_id,omitempty" bson:"trace_id,omitempty"`
	SchemaVersion int                    `json:"schema_version" bson:"schema_version"`
	Service       string                 `json:"service" bson:"service"`
	Level         string                 `json:"level" bson:"level"`
	Message       string                 `json:"message" bson:"message"`
	Meta          map[string]interface{} `json:"meta,omitempty" bson:"meta,omitempty"`
	Tags          map[string]string      `json:"tags,omitempty" bson:"tags,omitempty"`
	Timestamp     time.Time              `json:"timestamp" bson:"timestamp"`
	ReceivedAt    time.Time              `json:"received_at" bson:"received_at"`
}
