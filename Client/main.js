import { CanvasRenderer } from "./canvas.js";
import { createSocket } from "./websocket.js";

const mainCanvas = document.getElementById("main");
const tempCanvas = document.getElementById("temp");

const renderer = new CanvasRenderer(mainCanvas, tempCanvas);
renderer.resize(window.innerWidth, window.innerHeight);

let strokes = new Map();
let activeStroke = null;
let pendingPoints = [];
let currentTool = "brush";

const brushBtn = document.getElementById("brush");
const eraserBtn = document.getElementById("eraser");
const rectBtn = document.getElementById("rect");
const ellipseBtn = document.getElementById("ellipse");
const textBtn = document.getElementById("text");
const imageInput = document.getElementById("image-input");

function setTool(tool) {
  currentTool = tool;
  brushBtn.classList.toggle("active", tool === "brush");
  eraserBtn.classList.toggle("active", tool === "eraser");
  rectBtn.classList.toggle("active", tool === "rect");
  ellipseBtn.classList.toggle("active", tool === "ellipse");
  textBtn.classList.toggle("active", tool === "text");
}

brushBtn.onclick = () => setTool("brush");
eraserBtn.onclick = () => setTool("eraser");
rectBtn.onclick = () => setTool("rect");
ellipseBtn.onclick = () => setTool("ellipse");
textBtn.onclick = () => setTool("text");

// default
setTool("brush");



const socket = createSocket({
  onStrokeStart: stroke => {
    strokes.set(stroke.strokeId, stroke);
    redrawTemp();
  },

  onStrokeUpdate: ({ strokeId, points }) => {
    const s = strokes.get(strokeId);
    s.points.push(...points);
    redrawTemp();
  },

  onStrokeEnd: ({ strokeId }) => {
    const s = strokes.get(strokeId);
    renderer.drawStroke(renderer.main, s);
    renderer.clear(renderer.temp);
    redrawTemp();
  },

  onRebuild: ({ strokes: serverStrokes }) => {
  // Replace local stroke list with authoritative server snapshot
  strokes.clear();

  renderer.clear(renderer.main);
  renderer.clear(renderer.temp);

  console.log('canvas:rebuild', serverStrokes.length);

  // Draw only active strokes to the main (persistent) canvas
  for (const s of serverStrokes) {
    strokes.set(s.strokeId, s);
    if (s.active) renderer.drawStroke(renderer.main, s);
  }
},

  onUserJoined: ({ userId, color }) => {
    console.log("User joined:", userId);
    addUserToList({ userId, color });
  },

  onUserLeft: ({ userId }) => {
    renderer.removeCursor(userId);
    removeUserFromList(userId);
  },

  onCursor: ({ userId, x, y, color }) => {
    renderer.updateCursor(userId, x, y, color);
    redrawTemp();
  },

  onUsersList: ({ users }) => setUsersList(users)

});

// UI controls: color and size
const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
let currentColor = colorInput ? colorInput.value : "#000";
let currentSize = sizeInput ? parseInt(sizeInput.value, 10) : 3;
if (colorInput) colorInput.oninput = e => currentColor = e.target.value;
if (sizeInput) sizeInput.oninput = e => currentSize = parseInt(e.target.value, 10);

const userListEl = document.getElementById("user-list");

function addUserToList(user) {
  if (!userListEl) return;
  let userId, color;
  if (typeof user === 'string') {
    userId = user;
  } else {
    userId = user.userId;
    color = user.color;
  }
  if (userListEl.querySelector(`[data-id="${userId}"]`)) return;
  const li = document.createElement("li");
  li.dataset.id = userId;
  const sw = document.createElement("span");
  sw.className = "user-swatch";
  sw.style.background = color || renderer.getColorForUser(userId);
  li.appendChild(sw);
  const txt = document.createElement("span");
  txt.textContent = userId.slice(0, 6);
  li.appendChild(txt);
  userListEl.appendChild(li);
}

function removeUserFromList(userId) {
  if (!userListEl) return;
  const el = userListEl.querySelector(`[data-id=\"${userId}\"]`);
  if (el) el.remove();
}

function setUsersList(users) {
  if (!userListEl) return;
  userListEl.innerHTML = "";
  for (const u of users) addUserToList(u);
}

function redrawTemp() {
  renderer.clear(renderer.temp);
  // draw remote active strokes
  for (const s of strokes.values()) {
    if (s.active) renderer.drawStroke(renderer.temp, s);
  }
  // local active stroke on top
  if (activeStroke) renderer.drawStroke(renderer.temp, activeStroke);
  renderer.drawCursors(renderer.temp);
}

mainCanvas.addEventListener("pointerdown", e => {
  const rect = mainCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Handle shape/text/image tools differently
  if (currentTool === "rect" || currentTool === "ellipse") {
    activeStroke = {
      strokeId: crypto.randomUUID(),
      userId: socket.id,
      tool: currentTool,
      color: currentColor,
      width: currentSize,
      points: [{ x, y, t: performance.now() }, { x, y, t: performance.now() }],
      active: true
    };
    try { mainCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    socket.emit("stroke:start", activeStroke);
    return;
  }

  if (currentTool === "text") {
    const text = prompt("Enter text:");
    if (!text) return;
    const textItem = {
      strokeId: crypto.randomUUID(),
      userId: socket.id,
      tool: "text",
      text,
      color: currentColor,
      fontSize: Math.max(12, currentSize * 4),
      points: [{ x, y }],
      active: true
    };
    socket.emit("stroke:start", textItem);
    socket.emit("stroke:end", { strokeId: textItem.strokeId });
    strokes.set(textItem.strokeId, { ...textItem, active: true });
    renderer.drawStroke(renderer.main, textItem);
    return;
  }

  // Default: brush/eraser
  activeStroke = {
    strokeId: crypto.randomUUID(),
    userId: socket.id,
    tool: currentTool,
    color: currentTool === "eraser" ? "#FFF" : currentColor,
    width: currentTool === "eraser" ? currentSize * 3 : currentSize,
    points: [{ x, y, t: performance.now() }],
    active: true
  };
  try { mainCanvas.setPointerCapture(e.pointerId); } catch (err) {}
  pendingPoints.push({ x, y, t: performance.now() });
  socket.emit("stroke:start", activeStroke);
  console.log("pointerdown", activeStroke.strokeId, activeStroke.points.length);
});

mainCanvas.addEventListener("pointermove", e => {
  // Emit cursor position for ghost cursors
  const rect = mainCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  socket.emit("cursor:move", { x, y });

  if (!activeStroke) return;

  // If drawing a shape, update the end point instead of batching freehand points

  if (activeStroke.tool === "rect" || activeStroke.tool === "ellipse") {
    activeStroke.points[1] = { x, y, t: performance.now() };
    socket.emit("stroke:update", { strokeId: activeStroke.strokeId, points: [activeStroke.points[1]] });
    redrawTemp();
    return;
  }

  pendingPoints.push({ x, y, t: performance.now() });
  // keep visible while drawing
  // (we render in flush, but add lightweight debug)
  // console.log("pointermove", pendingPoints.length);
});

let lastCursorRedraw = 0;

function flush() {
  if (activeStroke) {
    if (pendingPoints.length) {
      const batch = pendingPoints.splice(0);
      activeStroke.points.push(...batch);

      socket.emit("stroke:update", {
        strokeId: activeStroke.strokeId,
        points: batch
      });
      lastCursorRedraw = performance.now();
    }

    // Always render the active stroke so it's visible between sparse pointer events
    renderer.clear(renderer.temp);
    renderer.drawStroke(renderer.temp, activeStroke);
    renderer.drawCursors(renderer.temp);
  } else if (performance.now() - lastCursorRedraw > 100) {
    // Only redraw cursors every 100ms when idle to prevent flicker
    renderer.clear(renderer.temp);
    renderer.drawCursors(renderer.temp);
    lastCursorRedraw = performance.now();
  }

  requestAnimationFrame(flush);
}
flush();

mainCanvas.addEventListener("pointerup", e => {
  if (!activeStroke) return;
  try { mainCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
  // finalize locally so originator sees the stroke immediately
  renderer.drawStroke(renderer.main, activeStroke);
  renderer.clear(renderer.temp);
  socket.emit("stroke:end", { strokeId: activeStroke.strokeId });
  // also add to local strokes map so remote redraws include it until server rebuild
  strokes.set(activeStroke.strokeId, { ...activeStroke, active: true });
  activeStroke = null;
  pendingPoints.length = 0;
  console.log("pointerup - stroke finalized");
});

mainCanvas.addEventListener("pointercancel", e => {
  if (!activeStroke) return;
  try { mainCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
  socket.emit("stroke:end", { strokeId: activeStroke.strokeId });
  activeStroke = null;
  pendingPoints.length = 0;
});

window.addEventListener("resize", () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});

// Image input: read file and place image centered (emits start+end)
if (imageInput) {
  imageInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const scale = Math.min(1, maxW / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        const centerX = mainCanvas.width / 2;
        const centerY = mainCanvas.height / 2;
        const stroke = {
          strokeId: crypto.randomUUID(),
          userId: socket.id,
          tool: 'image',
          imageData: dataUrl,
          width: w,
          height: h,
          points: [{ x: centerX, y: centerY }],
          active: true
        };
        socket.emit('stroke:start', stroke);
        socket.emit('stroke:end', { strokeId: stroke.strokeId });
        strokes.set(stroke.strokeId, stroke);
        renderer.drawStroke(renderer.main, stroke);
        imageInput.value = '';
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}


document.getElementById("undo").onclick = () => {
  console.log("UNDO CLICKED");
  socket.emit("undo");
};

document.getElementById("redo").onclick = () => {
  console.log("REDO CLICKED");
  socket.emit("redo");
};
