import { DrawingState } from "./drawing-state.js";

const rooms = new Map();

export function getRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, new DrawingState());
  }
  return rooms.get(id);
}
