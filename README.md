# Collaborative Canvas

## Run
npm install
node Server/server.js

## Test
Open multiple tabs at localhost:3000

## Features
- Real-time drawing
- Global undo/redo
- Deterministic rebuild
- Stroke-based protocol
 - Live cursors (ghost cursors for other users)
 - Shape tools: Rectangle, Ellipse
 - Text tool: place text labels
 - Image upload: embed images as canvas items
 - Tool labels in UI

## Known Limitations
- No persistence
- No zoom/pan
- Single room
 - Images are embedded as data URLs (not suitable for very large images or many images)

## Notes
- To test cross-window real-time behavior open multiple browser windows at `http://localhost:3000` after starting the server.
- If you previously ran `node Serveer/server.js` (misspelled path) that explains why the server failed; run the command from the project root as shown above.

If you'd like, I can:
- run the server and perform a quick local smoke test, or
- prepare a short checklist to harden image handling and multi-room support.

## Time Spent
~6–8 hours design + implementation

## Trade-offs
Stroke replay favored over incremental diffing for determinism.
