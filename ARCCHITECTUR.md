# Architecture

This document describes the architecture and runtime behavior of the Collaborative Canvas app as implemented in the repository.

## Overview

The app is a simple client-server real-time drawing system. The Client runs in the browser and renders two layered canvases (`main` persistent canvas and `temp` transient canvas). The Server uses Express + Socket.IO to forward events between connected clients and to maintain authoritative drawing state per room.

## Components

- Client (Client/)
	- `index.html` - UI shell and controls
	- `style.css` - styles and control bar
	- `canvas.js` - `CanvasRenderer` responsible for drawing strokes, shapes, text and images, and for rendering ghost cursors
	- `main.js` - app logic: input handling, batching, tool state, socket integration, UI wiring
	- `websocket.js` - thin socket wrapper that maps events to handlers

- Server (Server/)
	- `server.js` - Express + Socket.IO server that serves the client and manages socket connections
	- `rooms.js` - small manager that returns a `DrawingState` for a given room id
	- `drawing-state.js` - `DrawingState` class that keeps a list of strokes, supports undo/redo, and can produce a deterministic snapshot for rebuilds

## Real-time protocol (Socket events)

- `stroke:start` — send a new stroke/item to server (brush, eraser, rect, ellipse, text, image). The stroke object contains fields such as `strokeId`, `userId`, `tool`, `color`, `width`, `points`, and for images `imageData`, `width`, `height`.
- `stroke:update` — append points to an in-progress stroke (used by freehand brush and when updating shape end points).
- `stroke:end` — mark stroke ended; server will keep it in history as active.
- `canvas:rebuild` — authoritative snapshot from server containing all strokes (history) for deterministic rebuilding on connect / undo / redo.
- `cursor:move` — ephemeral cursor position, rebroadcast to other clients as `cursor:update`.
- `users:list`, `user:joined`, `user:left` — presence and colors.
- `undo`, `redo` — client requests that the server perform undo/redo on the room's `DrawingState`; server then emits `canvas:rebuild` so all clients synchronize deterministically.

## Data model: Stroke / Item

A stroke/item is a plain object, e.g.

{
	strokeId: String,
	userId: String,
	tool: 'brush'|'eraser'|'rect'|'ellipse'|'text'|'image',
	color: String,
	width: Number,
	points: [{x, y, t?}, ...],
	active: Boolean,
	// text-only: text, fontSize
	// image-only: imageData (data URL), width, height
}

Notes:
- Brush/eraser use a streamed `points` array (many samples). These are rendered only while `active` on the transient canvas during drawing and persisted to the main canvas when ended (or after a rebuild).
- Shapes (rect/ellipse) use two points (start and end) to define bounds and are drawn as persistent primitives.
- Text is placed at a point and stored with `text` and `fontSize`.
- Images are stored as a Data URL in `imageData` (client-side upload) and kept in the stroke for rebuild.

## Server-side state and determinism

`DrawingState` stores a `history` array and a `redo` stack. `snapshot()` returns a deep copy suitable for sending to clients. Undo marks the latest active stroke as inactive and moves it to the `redo` stack; redo pops from `redo` and re-activates the stroke. Clients rebuild deterministically from the snapshot.

## Presence & cursors

`server.js` tracks connected users per room and assigns a color. Clients emit `cursor:move` frequently and the server broadcasts `cursor:update` to other clients so ghost cursors are shown in near real-time.

## Notes & limitations

- Single-room default (room id `default`) is used in the current implementation. `rooms.js` can create per-room `DrawingState` instances.
- Images are embedded as data URLs in the stroke objects; for production you may prefer external storage to avoid large snapshots.
- This app favors stroke/item replay for determinism rather than incremental diffs.

## How to run

From the project root:

```bash
npm install
node Server/server.js
```

Open `http://localhost:3000` in multiple windows to test real-time sync.

Explains:

Stroke invariants

Event ordering guarantees

Undo/redo semantics

Why pixels are never state

Replay safety