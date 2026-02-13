package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/domain"
)

// MongoAlertsRepository implements domain.AlertsRepository using MongoDB.
type MongoAlertsRepository struct {
	col *mongo.Collection
}

func NewAlertsRepository(db *mongo.Database) *MongoAlertsRepository {
	return &MongoAlertsRepository{col: db.Collection("alerts")}
}

func (r *MongoAlertsRepository) FindAll(ctx context.Context) ([]domain.Alert, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.col.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []domain.Alert
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (r *MongoAlertsRepository) FindEnabled(ctx context.Context, service string) ([]domain.Alert, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	filter := bson.M{"enabled": true}
	if service != "" {
		filter["service"] = service
	}

	cursor, err := r.col.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []domain.Alert
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (r *MongoAlertsRepository) Create(ctx context.Context, alert *domain.Alert) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	now := time.Now()
	alert.CreatedAt = now
	alert.UpdatedAt = now
	alert.ID = primitive.NewObjectID().Hex()
	if alert.Type == "" {
		alert.Type = domain.AlertTypeThreshold
	}

	_, err := r.col.InsertOne(ctx, alert)
	if err != nil {
		return "", err
	}
	return alert.ID, nil
}

// MongoAlertEventsRepository implements domain.AlertEventsRepository.
type MongoAlertEventsRepository struct {
	col *mongo.Collection
}

func NewAlertEventsRepository(db *mongo.Database) *MongoAlertEventsRepository {
	return &MongoAlertEventsRepository{col: db.Collection("alert_events")}
}

func (r *MongoAlertEventsRepository) Create(ctx context.Context, event *domain.AlertEvent) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	event.ID = primitive.NewObjectID().Hex()
	_, err := r.col.InsertOne(ctx, event)
	if err != nil {
		return "", err
	}
	return event.ID, nil
}

func (r *MongoAlertEventsRepository) FindByAlert(ctx context.Context, alertID string, limit int) ([]domain.AlertEvent, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if limit <= 0 {
		limit = 20
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "triggered_at", Value: -1}}).
		SetLimit(int64(limit))

	cursor, err := r.col.Find(ctx, bson.M{"alert_id": alertID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []domain.AlertEvent
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func (r *MongoAlertEventsRepository) FindRecent(ctx context.Context, limit int) ([]domain.AlertEvent, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if limit <= 0 {
		limit = 50
	}
	opts := options.Find().
		SetSort(bson.D{{Key: "triggered_at", Value: -1}}).
		SetLimit(int64(limit))

	cursor, err := r.col.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []domain.AlertEvent
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}
