package observability

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// Logger provides structured JSON logging.
type Logger struct {
	service string
}

// NewLogger creates a logger tagged with a service name.
func NewLogger(service string) *Logger {
	return &Logger{service: service}
}

func (l *Logger) log(level, msg string, fields map[string]interface{}) {
	entry := map[string]interface{}{
		"time":    time.Now().UTC().Format(time.RFC3339),
		"level":   level,
		"service": l.service,
		"msg":     msg,
	}
	for k, v := range fields {
		entry[k] = v
	}
	data, _ := json.Marshal(entry)
	fmt.Fprintln(os.Stdout, string(data))
}

// Info logs at INFO level.
func (l *Logger) Info(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("info", msg, f)
}

// Warn logs at WARN level.
func (l *Logger) Warn(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("warn", msg, f)
}

// Error logs at ERROR level.
func (l *Logger) Error(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("error", msg, f)
}
