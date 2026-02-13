package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// MongoServicesRepository implements domain.ServicesRepository using MongoDB.
type MongoServicesRepository struct {
	col *mongo.Collection
}

func NewServicesRepository(db *mongo.Database) *MongoServicesRepository {
	return &MongoServicesRepository{col: db.Collection("services")}
}

func (r *MongoServicesRepository) FindAll(ctx context.Context, f domain.ServicesFilter) ([]domain.Service, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if f.Status != "" {
		filter["status"] = f.Status
	}

	limit := clampLimit(f.Limit, 100)
	page := clampPage(f.Page)
	skip := int64((page - 1) * limit)

	total, err := r.col.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "last_heartbeat", Value: -1}}).
		SetSkip(skip).
		SetLimit(int64(limit))

	cursor, err := r.col.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var results []domain.Service
	if err := cursor.All(ctx, &results); err != nil {
		return nil, 0, err
	}
	return results, total, nil
}
