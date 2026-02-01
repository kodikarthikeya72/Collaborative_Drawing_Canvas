export class DrawingState {
  constructor() {
    this.history = [];
    this.redo = [];
  }

  addStroke(stroke) {
    this.history.push(stroke);
    this.redo.length = 0;
  }

  endStroke(strokeId) {
    const stroke = this.history.find(s => s.strokeId === strokeId);
    if (!stroke) return;
    stroke.active = true;
  }

  undo() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].active) {
        this.history[i].active = false;
        this.redo.push(this.history[i]);
        return;
      }
    }
  }

  redoStroke() {
    const stroke = this.redo.pop();
    if (!stroke) return;
    stroke.active = true;
  }

  snapshot() {
    return this.history.map(s => ({
      ...s,
      points: [...s.points]
    }));
  }
}
