package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// MongoSecurityRepository implements domain.SecurityRepository using MongoDB.
type MongoSecurityRepository struct {
	col *mongo.Collection
}

func NewSecurityRepository(db *mongo.Database) *MongoSecurityRepository {
	return &MongoSecurityRepository{col: db.Collection("security_events")}
}

func (r *MongoSecurityRepository) Find(ctx context.Context, f domain.SecurityFilter) ([]domain.SecurityEvent, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if f.Service != "" {
		filter["service"] = f.Service
	}
	if f.IP != "" {
		filter["source_ip"] = f.IP
	}
	if f.Type != "" {
		filter["type"] = f.Type
	}
	if f.Severity != "" {
		filter["severity"] = f.Severity
	}
	if f.TraceID != "" {
		filter["trace_id"] = f.TraceID
	}
	applyTimeRange(filter, f.From, f.To)

	limit := clampLimit(f.Limit, 50)
	page := clampPage(f.Page)
	skip := int64((page - 1) * limit)

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []domain.SecurityEvent
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}

	return results, total, nil
}
