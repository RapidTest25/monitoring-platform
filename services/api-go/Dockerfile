FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /api ./cmd/api

FROM alpine:3.19
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /api /api
EXPOSE 3003
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3003/api/health || exit 1
ENTRYPOINT ["/api"]
