package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/lightwatch/monitoring-platform/services/api-go/internal/config"
	handler "github.com/lightwatch/monitoring-platform/services/api-go/internal/http"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/http/handlers"
	mw "github.com/lightwatch/monitoring-platform/services/api-go/internal/middleware"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/observability"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/repository"
	"github.com/lightwatch/monitoring-platform/services/api-go/internal/usecase"
)

func main() {
	cfg := config.Load()
	logger := observability.NewLogger("api-go")

	// ── MongoDB ──
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer mongoClient.Disconnect(context.Background())

	if err := mongoClient.Ping(ctx, nil); err != nil {
		log.Fatalf("mongo ping: %v", err)
	}
	logger.Info("connected to MongoDB")

	db := mongoClient.Database("monitoring")

	// ── Repositories ──
	logsRepo := repository.NewLogsRepository(db)
	metricsRepo := repository.NewMetricsRepository(db)
	securityRepo := repository.NewSecurityRepository(db)
	alertsRepo := repository.NewAlertsRepository(db)
	alertEventsRepo := repository.NewAlertEventsRepository(db)
	servicesRepo := repository.NewServicesRepository(db)

	// ── Use Cases ──
	queryLogsUC := usecase.NewQueryLogs(logsRepo)
	queryMetricsUC := usecase.NewQueryMetrics(metricsRepo)
	querySecurityUC := usecase.NewQuerySecurity(securityRepo)
	manageAlertsUC := usecase.NewManageAlerts(alertsRepo)
	queryServicesUC := usecase.NewQueryServices(servicesRepo)

	// ── Alert Engine ──
	detectAnomalyUC := usecase.NewDetectAnomaly(alertsRepo, alertEventsRepo, metricsRepo, logger)

	// ── Handlers ──
	logsH := handlers.NewLogsHandler(queryLogsUC)
	metricsH := handlers.NewMetricsHandler(queryMetricsUC)
	securityH := handlers.NewSecurityHandler(querySecurityUC)
	alertsH := handlers.NewAlertsHandler(manageAlertsUC)
	servicesH := handlers.NewServicesHandler(queryServicesUC)
	healthH := handlers.NewHealthHandler()

	// ── Router ──
	mux := handler.NewRouter(
		logsH,
		metricsH,
		securityH,
		alertsH,
		servicesH,
		healthH,
	)

	// ── Middleware chain ──
	var h http.Handler = mux
	h = mw.RateLimit(200, time.Minute)(h)
	h = mw.Auth(cfg.APIKey)(h)
	h = mw.RequestID(h)
	h = mw.Logger(logger)(h)
	h = mw.Recovery(logger)(h)
	h = mw.CORS()(h)

	// ── Server ──
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      h,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// ── Start alert engine ──
	engineCtx, engineCancel := context.WithCancel(context.Background())
	defer engineCancel()
	detectAnomalyUC.Start(engineCtx, 30*time.Second)

	go func() {
		logger.Info("Lightwatch API listening on :" + cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	// ── Graceful shutdown ──
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down…")
	engineCancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	srv.Shutdown(shutCtx)
}
