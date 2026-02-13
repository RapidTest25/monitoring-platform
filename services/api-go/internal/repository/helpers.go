package repository

import (
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

const (
	DefaultLimit = 50
	MaxLimit     = 500
)

// clampLimit bounds the limit to [1, MaxLimit] with a default.
func clampLimit(limit, defaultVal int) int {
	if limit <= 0 {
		return defaultVal
	}
	if limit > MaxLimit {
		return MaxLimit
	}
	return limit
}

// clampPage ensures page is at least 1.
func clampPage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

// applyTimeRange adds $gte/$lte time filter to a bson.M filter.
func applyTimeRange(filter bson.M, from, to string) {
	var fromT, toT time.Time
	var hasFrom, hasTo bool

	if from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			fromT = t
			hasFrom = true
		}
	}
	if to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			toT = t
			hasTo = true
		}
	}

	if hasFrom || hasTo {
		ts := bson.M{}
		if hasFrom {
			ts["$gte"] = fromT
		}
		if hasTo {
			ts["$lte"] = toT
		}
		filter["timestamp"] = ts
	}
}
