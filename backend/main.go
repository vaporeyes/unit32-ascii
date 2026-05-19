// ABOUTME: HTTP service for publishing and retrieving unit32-ascii artworks.
// ABOUTME: Stores raw cell bytes in <id>.bin and metadata JSON in <id>.json.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

const (
	storageDir    = "./data"
	maxBodyBytes  = 2 * 1024 * 1024 // 2 MB cap on uploads
	maxGridDim    = 500
	listLimit     = 100
	titleMaxLen   = 80
	authorMaxLen  = 80
)

type Artwork struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	CreatedAt string `json:"created_at"`
	Data      []byte `json:"data,omitempty"`
}

type server struct {
	dir      string
	allowed  []string
	rateMu   sync.Mutex
	rateHits map[string][]time.Time
}

func main() {
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		log.Fatalf("storage dir: %v", err)
	}

	allowed := strings.Split(envOrDefault("CORS_ORIGINS", "*"), ",")
	addr := envOrDefault("ADDR", ":8080")

	s := &server{
		dir:      storageDir,
		allowed:  allowed,
		rateHits: map[string][]time.Time{},
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(s.corsMiddleware)
	r.Use(s.rateLimitMiddleware)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok"))
	})
	r.Get("/artworks", s.listArtworks)
	r.Get("/artworks/{id}", s.getArtwork)
	r.Post("/artworks", s.createArtwork)

	log.Printf("listening on %s, storage=%s, cors=%v", addr, storageDir, allowed)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (s *server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allow := ""
		for _, a := range s.allowed {
			a = strings.TrimSpace(a)
			if a == "*" || a == origin {
				allow = a
				break
			}
		}
		if allow != "" {
			w.Header().Set("Access-Control-Allow-Origin", allow)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) rateLimitMiddleware(next http.Handler) http.Handler {
	const window = time.Minute
	const limit = 60

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		now := time.Now()
		s.rateMu.Lock()
		hits := s.rateHits[ip]
		kept := hits[:0]
		for _, t := range hits {
			if now.Sub(t) < window {
				kept = append(kept, t)
			}
		}
		if len(kept) >= limit {
			s.rateMu.Unlock()
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		kept = append(kept, now)
		s.rateHits[ip] = kept
		s.rateMu.Unlock()
		next.ServeHTTP(w, r)
	})
}

func (s *server) createArtwork(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var art Artwork
	if err := dec.Decode(&art); err != nil {
		http.Error(w, fmt.Sprintf("invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if err := validate(&art); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	art.ID = uuid.New().String()
	art.CreatedAt = time.Now().UTC().Format(time.RFC3339)

	dataPath := filepath.Join(s.dir, art.ID+".bin")
	metaPath := filepath.Join(s.dir, art.ID+".json")
	if err := os.WriteFile(dataPath, art.Data, 0o644); err != nil {
		http.Error(w, "failed to save data", http.StatusInternalServerError)
		return
	}
	metaCopy := art
	metaCopy.Data = nil
	metaBytes, _ := json.Marshal(metaCopy)
	if err := os.WriteFile(metaPath, metaBytes, 0o644); err != nil {
		_ = os.Remove(dataPath)
		http.Error(w, "failed to save metadata", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, metaCopy)
}

func (s *server) getArtwork(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !validID(id) {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	metaBytes, err := os.ReadFile(filepath.Join(s.dir, id+".json"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "not found", http.StatusNotFound)
		} else {
			http.Error(w, "read error", http.StatusInternalServerError)
		}
		return
	}
	var meta Artwork
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		http.Error(w, "corrupt metadata", http.StatusInternalServerError)
		return
	}

	data, err := os.ReadFile(filepath.Join(s.dir, id+".bin"))
	if err != nil {
		http.Error(w, "data missing", http.StatusInternalServerError)
		return
	}
	meta.Data = data
	writeJSON(w, http.StatusOK, meta)
}

func (s *server) listArtworks(w http.ResponseWriter, _ *http.Request) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}
	var items []Artwork
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(s.dir, entry.Name()))
		if err != nil {
			continue
		}
		var a Artwork
		if err := json.Unmarshal(raw, &a); err != nil {
			continue
		}
		items = append(items, a)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt > items[j].CreatedAt
	})
	if len(items) > listLimit {
		items = items[:listLimit]
	}
	writeJSON(w, http.StatusOK, items)
}

func validate(a *Artwork) error {
	a.Title = strings.TrimSpace(a.Title)
	a.Author = strings.TrimSpace(a.Author)
	if a.Title == "" {
		a.Title = "Untitled"
	}
	if len(a.Title) > titleMaxLen {
		a.Title = a.Title[:titleMaxLen]
	}
	if len(a.Author) > authorMaxLen {
		a.Author = a.Author[:authorMaxLen]
	}
	if a.Width < 1 || a.Width > maxGridDim {
		return fmt.Errorf("width out of range (1..%d)", maxGridDim)
	}
	if a.Height < 1 || a.Height > maxGridDim {
		return fmt.Errorf("height out of range (1..%d)", maxGridDim)
	}
	if len(a.Data) != a.Width*a.Height*4 {
		return fmt.Errorf("data length %d does not match %d cells * 4 bytes", len(a.Data), a.Width*a.Height)
	}
	return nil
}

func validID(id string) bool {
	if len(id) != 36 {
		return false
	}
	for _, c := range id {
		switch {
		case c >= '0' && c <= '9':
		case c >= 'a' && c <= 'f':
		case c == '-':
		default:
			return false
		}
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
