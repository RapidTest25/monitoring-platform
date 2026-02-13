package domain

import "time"

type Service struct {
	ID            string                 `json:"id" bson:"_id,omitempty"`
	Name          string                 `json:"name" bson:"name"`
	Host          string                 `json:"host" bson:"host"`
	Version       string                 `json:"version,omitempty" bson:"version,omitempty"`
	LastHeartbeat time.Time              `json:"last_heartbeat" bson:"last_heartbeat"`
	Status        string                 `json:"status" bson:"status"` // healthy, degraded, unhealthy
	Meta          map[string]interface{} `json:"meta,omitempty" bson:"meta,omitempty"`
	Tags          map[string]string      `json:"tags,omitempty" bson:"tags,omitempty"`
	CreatedAt     time.Time              `json:"created_at" bson:"created_at"`
}
