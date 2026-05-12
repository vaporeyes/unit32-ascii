# Unit32 ASCII

A high-performance, grid-based ASCII art editor built with a `Uint32Array` memory architecture.

## Overview

Unit32 ASCII is a specialized tool for creating ANSI/ASCII art. It leverages a 1D `Uint32Array` to manage the grid state efficiently, enabling fast rendering and low memory overhead. The project features an offline-first approach with local persistence and a Go-based backend for remote storage and synchronization.

## Features

- **High-Performance Rendering:** Uses a `Uint32Array` to represent the grid and a custom blitting renderer to minimize draw calls.
- **Offline-First:** Automatically saves progress to `IndexedDB`, ensuring data resilience across sessions.
- **Undo/Redo:** Efficient diff-based history management.
- **ANSI Export:** Offloads ANSI escape sequence generation to a Web Worker to keep the UI responsive.
- **Tooling:** Includes brush with path interpolation (Bresenham's algorithm) and flood fill.
- **Remote Sync:** Go-powered backend with PostgreSQL for cloud persistence.

## Tech Stack

### Frontend
- **Framework:** React 19 (TypeScript)
- **Build Tool:** Vite
- **Storage:** IndexedDB (`idb`)
- **State:** Custom `Uint32Array` engine

### Backend
- **Language:** Go
- **Router:** chi
- **Database:** PostgreSQL (`pgx`)

## Getting Started

### Prerequisites
- Node.js (v20+)
- Go (v1.25+)
- PostgreSQL (optional, for backend persistence)

### Frontend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Development
```bash
cd backend

# Build the binary
go build -o server main.go

# Run the server
./server
```

## Project Structure

- `src/engine/`: Core logic for memory management, rendering, and tools.
- `src/workers/`: Web Workers for computationally expensive tasks like exporting.
- `src/components/`: React UI components.
- `backend/`: Go implementation of the persistence layer.

## License

MIT
