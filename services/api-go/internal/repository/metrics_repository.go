package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// MongoMetricsRepository implements domain.MetricsRepository using MongoDB.
type MongoMetricsRepository struct {
	col *mongo.Collection
}

func NewMetricsRepository(db *mongo.Database) *MongoMetricsRepository {
	return &MongoMetricsRepository{col: db.Collection("metrics")}
}

func (r *MongoMetricsRepository) Find(ctx context.Context, f domain.MetricsFilter) ([]domain.MetricEvent, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if f.Service != "" {
		filter["service"] = f.Service
	}
	if f.Name != "" {
		filter["name"] = f.Name
	}
	if f.TraceID != "" {
		filter["trace_id"] = f.TraceID
	}
	applyTimeRange(filter, f.From, f.To)

	limit := clampLimit(f.Limit, 100)
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

	var results []domain.MetricEvent
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}

	return results, total, nil
}
