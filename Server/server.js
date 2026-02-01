import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { getRoom } from "./rooms.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static("Client"));

const roomUsers = new Map(); // roomId -> Map of socketId -> { color }

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  const roomId = "default";
  const room = getRoom(roomId);
  socket.join(roomId);

  // add to room user list and assign a color
  if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
  const usersMap = roomUsers.get(roomId);
  const color = randomColor();
  usersMap.set(socket.id, { color });

  // inform the new client of current users (with colors)
  socket.emit("users:list", {
    users: Array.from(usersMap.entries()).map(([id, meta]) => ({ userId: id, color: meta.color }))
  });

  // notify others
  socket.to(roomId).emit("user:joined", { userId: socket.id, color });

  // Send current state
  socket.emit("canvas:rebuild", {
    strokes: room.snapshot()
  });

  socket.on("stroke:start", stroke => {
    stroke.active = true;
    room.addStroke(stroke);
    socket.to(roomId).emit("stroke:start", stroke);
  });

  socket.on("stroke:update", ({ strokeId, points }) => {
    const s = room.history.find(s => s.strokeId === strokeId);
    if (!s) return;
    s.points.push(...points);
    socket.to(roomId).emit("stroke:update", { strokeId, points });
  });

  socket.on("stroke:end", ({ strokeId }) => {
    room.endStroke(strokeId); // ✅ now defined
    socket.to(roomId).emit("stroke:end", { strokeId });
  });

  socket.on("undo", () => {
    console.log("UNDO RECEIVED");
    room.undo();
    io.to(roomId).emit("canvas:rebuild", {
      strokes: room.snapshot()
    });
  });

  socket.on("redo", () => {
    console.log("REDO RECEIVED");
    room.redoStroke();
    io.to(roomId).emit("canvas:rebuild", {
      strokes: room.snapshot()
    });
  });

  socket.on("cursor:move", ({ x, y }) => {
    const meta = roomUsers.get(roomId)?.get(socket.id) || {};
    socket.to(roomId).emit("cursor:update", {
      userId: socket.id,
      x,
      y,
      color: meta.color
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // remove from room users
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
    }
    io.to(roomId).emit("user:left", { userId: socket.id });
  });
});

function randomColor() {
  // soft pleasant palette
  const palette = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#C197FF", "#FFD166"];
  return palette[Math.floor(Math.random() * palette.length)];
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🔥 server.js loaded");
  console.log(`Server running on http://localhost:${PORT}`);

});
