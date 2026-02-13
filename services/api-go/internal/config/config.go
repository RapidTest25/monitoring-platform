package config

import (
	"bufio"
	"os"
	"strings"
)

// Config holds application configuration loaded from environment variables.
type Config struct {
	Port     string
	MongoURI string
	RedisURL string
	APIKey   string
	LogLevel string
}

// Load reads .env file (if present), then reads environment with defaults.
func Load() Config {
	loadEnvFile(".env")
	return Config{
		Port:     getEnv("PORT", "3003"),
		MongoURI: getEnv("MONGO_URI", "mongodb://localhost:27017/monitoring"),
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),
		APIKey:   getEnv("API_KEY", ""),
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// loadEnvFile reads a .env file and sets env vars that are not already set.
func loadEnvFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // file not found — skip silently
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		v = strings.TrimSpace(v)
		// Only set if not already in environment (env vars take precedence)
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
}
