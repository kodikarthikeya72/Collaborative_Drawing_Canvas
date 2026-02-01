# Architecture

A real-time collaborative drawing app using Node.js, Express, and Socket.IO.

## How It Works

**Client → Server → Other Clients**
1. User draws with brush/shapes/text/images
2. Client sends drawing events to server (batched points)
3. Server broadcasts to all connected users in the room
4. Other users see the drawing appear in real-time

## Components

**Client** (`Client/` folder)
- `main.js` — Drawing input, batching, tool selection
- `canvas.js` — Renders strokes, shapes, text, images, and cursors
- `websocket.js` — Socket.IO event handlers
- `index.html` / `style.css` — UI controls

**Server** (`Server/` folder)
- `server.js` — Receives events, broadcasts to room
- `drawing-state.js` — Keeps history of all strokes for undo/redo
- `rooms.js` — Manages separate rooms

## Real-time Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `stroke:start` | Client → Server | New stroke begins (brush, shape, text, image) |
| `stroke:update` | Client → Server | Add more points to stroke |
| `stroke:end` | Client → Server | Stroke finished |
| `canvas:rebuild` | Server → All | Full snapshot (undo/redo/reconnect) |
| `cursor:move` | Client → Server | Ghost cursor position |
| `undo` / `redo` | Client → Server | Request undo/redo on server |
| `user:joined` / `user:left` | Server → All | User connected/disconnected |

## Undo/Redo

- **Server-side only:** All undo/redo happens on server to keep everyone in sync
- **How it works:** Server maintains history of all strokes. When user presses undo, server marks the last stroke inactive, broadcasts snapshot to all clients
- **Why:** Simple, deterministic, no conflicts

## Performance Optimizations

1. **Batched Points** — Client collects mouse points and sends ~5 per frame instead of 60+/sec
2. **Two Canvases** — Main canvas (persistent) + temp canvas (in-progress strokes, cursors)
3. **Image Caching** — Load image once, reuse on every redraw
4. **Ephemeral Cursors** — Ghost cursors not persisted; they disappear on reconnect (OK)
5. **Full Snapshots** — Simpler than diffing; all clients replay strokes identically

## Conflict Handling

**Simultaneous Strokes**
- Each stroke has a unique ID and user ID. No conflicts; they just overlap.

**Concurrent Undo**
- Server processes requests in order. Deterministic.

**Late Joiner**
- New user connects → server sends full snapshot → up to date instantly.

**Undo While Drawing**
- If User B undoes while User A is still drawing, User A's in-progress stroke might vanish (not stored yet). User A should finish stroke first.
