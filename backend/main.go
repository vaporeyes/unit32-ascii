/* ABOUTME: Main entry point for the Go backend service. */
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

type Artwork struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	CreatedAt string `json:"created_at"`
	Data      []byte `json:"data,omitempty"` // For POSTing data
}

const STORAGE_DIR = "./data"

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Ensure storage dir exists
	os.MkdirAll(STORAGE_DIR, 0755)

	r.Post("/artworks", createArtwork)
	r.Get("/artworks/{id}", getArtwork)

	fmt.Println("Server starting on :8080")
	http.ListenAndServe(":8080", r)
}

func createArtwork(w http.ResponseWriter, r *http.Request) {
	var art Artwork
	if err := json.NewDecoder(r.Body).Decode(&art); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	art.ID = uuid.New().String()
	// In a real app, we'd save metadata to Postgres and data to S3
	// For this prototype, we'll use the local filesystem
	
	dataPath := filepath.Join(STORAGE_DIR, art.ID+".bin")
	if err := os.WriteFile(dataPath, art.Data, 0644); err != nil {
		http.Error(w, "Failed to save data", http.StatusInternalServerError)
		return
	}

	art.Data = nil // Don't return the data in the metadata response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(art)
}

func getArtwork(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	// In a real app, fetch metadata from Postgres
	
	dataPath := filepath.Join(STORAGE_DIR, id+".bin")
	data, err := os.ReadFile(dataPath)
	if err != nil {
		http.Error(w, "Artwork not found", http.StatusNotFound)
		return
	}

	// Mocking metadata
	art := Artwork{
		ID:    id,
		Title: "Untitled",
		Data:  data,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(art)
}
