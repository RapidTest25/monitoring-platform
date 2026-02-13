package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// MongoLogsRepository implements domain.LogsRepository using MongoDB.
type MongoLogsRepository struct {
	col *mongo.Collection
}

func NewLogsRepository(db *mongo.Database) *MongoLogsRepository {
	return &MongoLogsRepository{col: db.Collection("logs")}
}

func (r *MongoLogsRepository) Find(ctx context.Context, f domain.LogsFilter) ([]domain.LogEvent, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if f.Service != "" {
		filter["service"] = f.Service
	}
	if f.Level != "" {
		filter["level"] = f.Level
	}
	if f.TraceID != "" {
		filter["trace_id"] = f.TraceID
	}
	if f.Query != "" {
		filter["message"] = bson.M{"$regex": f.Query, "$options": "i"}
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

	var results []domain.LogEvent
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}

	return results, total, nil
}
