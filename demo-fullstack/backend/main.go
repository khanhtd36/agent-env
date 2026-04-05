package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

type healthResponse struct {
	Status    string `json:"status"`
	DBStatus  string `json:"db_status"`
	DBTime    string `json:"db_time"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

func main() {
	addr := envOr("APP_ADDR", ":8080")
	databaseURL := envOr("DATABASE_URL", "postgres://app:app@db:5432/app?sslmode=disable")

	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		conn, err := pgx.Connect(ctx, databaseURL)
		if err != nil {
			respondJSON(w, http.StatusServiceUnavailable, healthResponse{
				Status:    "degraded",
				DBStatus:  "down",
				Message:   fmt.Sprintf("db connect error: %v", err),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			})
			return
		}
		defer conn.Close(ctx)

		var now time.Time
		if err := conn.QueryRow(ctx, "select now()").Scan(&now); err != nil {
			respondJSON(w, http.StatusServiceUnavailable, healthResponse{
				Status:    "degraded",
				DBStatus:  "down",
				Message:   fmt.Sprintf("db query error: %v", err),
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			})
			return
		}

		respondJSON(w, http.StatusOK, healthResponse{
			Status:    "ok",
			DBStatus:  "up",
			DBTime:    now.UTC().Format(time.RFC3339),
			Message:   "frontend -> go backend -> postgres is working",
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
	})

	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func respondJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
