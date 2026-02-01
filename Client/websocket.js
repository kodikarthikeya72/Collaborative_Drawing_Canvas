export function createSocket(handlers) {
  const socket = io();

  socket.on("stroke:start", handlers.onStrokeStart);
  socket.on("stroke:update", handlers.onStrokeUpdate);
  socket.on("stroke:end", handlers.onStrokeEnd);

  socket.on("canvas:rebuild", handlers.onRebuild);

  socket.on("users:list", handlers.onUsersList);

  socket.on("user:joined", handlers.onUserJoined);
  socket.on("user:left", handlers.onUserLeft);
  socket.on("cursor:update", handlers.onCursor);

  return socket;
}
