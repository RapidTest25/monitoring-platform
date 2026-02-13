.PHONY: all build dev stop test clean help

# ─── Variables ───
COMPOSE_FILE := infra/docker-compose.yml

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ─── Docker ───
up: ## Start all services (Docker Compose)
	docker compose -f $(COMPOSE_FILE) up -d --build

down: ## Stop all services
	docker compose -f $(COMPOSE_FILE) down

logs: ## Tail all container logs
	docker compose -f $(COMPOSE_FILE) logs -f

ps: ## Show running containers
	docker compose -f $(COMPOSE_FILE) ps

# ─── Local Dev ───
dev-api: ## Run api-go locally
	cd services/api-go && go run ./cmd/api

dev-ingest: ## Run ingest-node locally
	cd services/ingest-node && npm run dev

dev-realtime: ## Run realtime-node locally
	cd services/realtime-node && npm run dev

# ─── Build ───
build-api: ## Build api-go binary
	cd services/api-go && CGO_ENABLED=0 go build -ldflags="-s -w" -o api ./cmd/api

build-node: ## Install Node.js dependencies
	cd services/ingest-node && npm ci
	cd services/realtime-node && npm ci

build: build-api build-node ## Build all services

# ─── Test ───
check-go: ## Compile-check Go code
	cd services/api-go && go build ./...

check-node: ## Syntax-check all Node.js files
	find services -name '*.js' -not -path '*/node_modules/*' -exec node -c {} \;

check: check-go check-node ## Check all services compile/parse

test-api: ## Run Go tests
	cd services/api-go && go test ./...

test: test-api check ## Run all checks and tests

# ─── Utilities ───
init-db: ## Initialize MongoDB collections and indexes
	mongosh < infra/mongo/init-mongo.js

clean: ## Remove build artifacts and node_modules
	rm -f services/api-go/api
	rm -rf services/ingest-node/node_modules
	rm -rf services/realtime-node/node_modules

fmt: ## Format Go code
	cd services/api-go && gofmt -w .
