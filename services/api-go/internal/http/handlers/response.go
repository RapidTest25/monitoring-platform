package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
)

// PaginatedResponse is the standard envelope for paginated list endpoints.
type PaginatedResponse struct {
	Data  interface{} `json:"data"`
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{
		"error":   http.StatusText(status),
		"message": message,
	})
}

// parsePagination extracts page and limit from query string with defaults.
func parsePagination(q url.Values) (int, int) {
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	return page, limit
}
