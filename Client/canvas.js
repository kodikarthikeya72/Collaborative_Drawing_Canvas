export class CanvasRenderer {
  constructor(main, temp) {
    this.main = main.getContext("2d");
    this.temp = temp.getContext("2d");
    this.cursors = new Map(); // Track user cursors
    this.imageCache = new Map();
  }

  resize(w, h) {
    for (const ctx of [this.main, this.temp]) {
      ctx.canvas.width = w;
      ctx.canvas.height = h;
    }
  }

  clear(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  drawStroke(ctx, stroke) {
    // Brushes/eraser use point streams and are only drawn while active
    const brushTools = ["brush", "eraser"];
    const pts = stroke.points || [];

    if (brushTools.includes(stroke.tool)) {
      if (!stroke.active) return;

      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = stroke.color;

      if (pts.length < 2) {
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Shapes, text, and images are persistent items and drawn regardless of `active`
    ctx.save();
    ctx.lineWidth = stroke.width || 2;
    ctx.strokeStyle = stroke.color || "#000";
    ctx.fillStyle = stroke.color || "#000";

    if (stroke.tool === "rect" && pts.length) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(a.x - b.x);
      const h = Math.abs(a.y - b.y);
      if (stroke.fill) ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else if (stroke.tool === "ellipse" && pts.length) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(a.x - b.x) / 2;
      const ry = Math.abs(a.y - b.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (stroke.fill) ctx.fill();
      ctx.stroke();
    } else if (stroke.tool === "text") {
      const p = pts[0] || { x: 0, y: 0 };
      const fontSize = stroke.fontSize || 16;
      ctx.font = `${fontSize}px Inter, system-ui, Arial`;
      ctx.textBaseline = "top";
      ctx.fillText(stroke.text || "", p.x, p.y);
    } else if (stroke.tool === "image") {
      const p = pts[0] || { x: 0, y: 0 };
      const id = stroke.strokeId;
      // cache Image objects so we don't re-create on each frame
      if (!this.imageCache.has(id) && stroke.imageData) {
        const img = new Image();
        img.src = stroke.imageData;
        img.onload = () => { this.imageCache.set(id, img); };
        this.imageCache.set(id, null);
      }
      const cached = this.imageCache.get(id);
      if (cached) {
        const w = stroke.width || cached.width;
        const h = stroke.height || cached.height;
        ctx.drawImage(cached, p.x - w / 2, p.y - h / 2, w, h);
      }
    }

    ctx.restore();
}

  drawCursors(ctx) {
    for (const [userId, cursor] of this.cursors.entries()) {
      ctx.fillStyle = cursor.color || "#FF6B6B";
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // small name/ID label
      ctx.font = '12px Inter, system-ui, Arial';
      ctx.fillStyle = '#111827';
      const label = (cursor.label || userId.slice(0, 6));
      ctx.fillText(label, cursor.x + 10, cursor.y + 4);
    }
  }

  updateCursor(userId, x, y, color, label) {
    if (!this.cursors.has(userId)) {
      this.cursors.set(userId, { x, y, color: color || this.getColorForUser(userId), label });
    } else {
      const cursor = this.cursors.get(userId);
      cursor.x = x;
      cursor.y = y;
      if (color) cursor.color = color;
      if (label) cursor.label = label;
    }
  }

  removeCursor(userId) {
    this.cursors.delete(userId);
  }

  getColorForUser(userId) {
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"];
    return colors[Math.abs(userId.charCodeAt(0)) % colors.length];
  }

}
