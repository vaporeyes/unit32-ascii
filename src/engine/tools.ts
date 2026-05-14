/* ABOUTME: Tool implementations: brush, eraser, fill, eyedropper, rect, line. */
/* ABOUTME: All tools read the active char/fg/bg from engine.toolState. */
import { Engine } from './core';
import { GridMemory } from './memory';

export interface Point {
  x: number;
  y: number;
}

export abstract class Tool {
  protected engine: Engine;
  constructor(engine: Engine) {
    this.engine = engine;
  }
  abstract onPointerDown(p: Point): void;
  abstract onPointerMove(p: Point): void;
  abstract onPointerUp(p: Point): void;
}

function bresenham(p1: Point, p2: Point, plot: (x: number, y: number) => void): void {
  let x0 = p1.x;
  let y0 = p1.y;
  const x1 = p2.x;
  const y1 = p2.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export class Brush extends Tool {
  private drawing = false;
  private last: Point | null = null;

  onPointerDown(p: Point): void {
    this.drawing = true;
    this.engine.beginAction();
    this.paint(p);
    this.last = p;
  }
  onPointerMove(p: Point): void {
    if (!this.drawing) return;
    if (this.last) bresenham(this.last, p, (x, y) => this.paint({ x, y }));
    else this.paint(p);
    this.last = p;
  }
  onPointerUp(_p: Point): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    this.engine.endAction();
  }
  private paint(p: Point): void {
    const { char, fg, bg } = this.engine.toolState;
    this.engine.setCell(p.x, p.y, char, fg, bg);
  }
}

export class Eraser extends Tool {
  private erasing = false;
  private last: Point | null = null;

  onPointerDown(p: Point): void {
    this.erasing = true;
    this.engine.beginAction();
    this.wipe(p);
    this.last = p;
  }
  onPointerMove(p: Point): void {
    if (!this.erasing) return;
    if (this.last) bresenham(this.last, p, (x, y) => this.wipe({ x, y }));
    else this.wipe(p);
    this.last = p;
  }
  onPointerUp(_p: Point): void {
    if (!this.erasing) return;
    this.erasing = false;
    this.last = null;
    this.engine.endAction();
  }
  private wipe(p: Point): void {
    this.engine.setCell(p.x, p.y, 32, 15, 0);
  }
}

export class Fill extends Tool {
  onPointerDown(p: Point): void {
    const { width, height } = this.engine.config;
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) return;

    const target = this.engine.memory.getCell(p.x, p.y);
    const { char, fg, bg } = this.engine.toolState;
    const replacement = GridMemory.pack(char, fg, bg);
    if (target === replacement) return;

    this.engine.beginAction();

    const stack: number[] = [p.y * width + p.x];
    const seen = new Uint8Array(width * height);

    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (seen[idx]) continue;
      seen[idx] = 1;
      const x = idx % width;
      const y = (idx - x) / width;
      if (this.engine.memory.getBuffer()[idx] !== target) continue;
      this.engine.setCell(x, y, char, fg, bg);
      if (x > 0) stack.push(idx - 1);
      if (x < width - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - width);
      if (y < height - 1) stack.push(idx + width);
    }

    this.engine.endAction();
  }
  onPointerMove(_p: Point): void {}
  onPointerUp(_p: Point): void {}
}

export class Eyedropper extends Tool {
  onPointerDown(p: Point): void {
    const { width, height } = this.engine.config;
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) return;
    const cell = this.engine.memory.getCell(p.x, p.y);
    const { char, fg, bg } = GridMemory.unpack(cell);
    this.engine.setToolState({ char: char || 32, fg, bg });
  }
  onPointerMove(_p: Point): void {}
  onPointerUp(_p: Point): void {}
}

// Shared base for rect/line: preview overlay during drag, commit on release.
abstract class ShapeTool extends Tool {
  protected start: Point | null = null;
  protected preview: Point | null = null;

  onPointerDown(p: Point): void {
    this.start = p;
    this.preview = p;
    this.engine.setShapePreview(this.tracePoints(p, p));
  }
  onPointerMove(p: Point): void {
    if (!this.start) return;
    this.preview = p;
    this.engine.setShapePreview(this.tracePoints(this.start, p));
  }
  onPointerUp(p: Point): void {
    if (!this.start) return;
    this.engine.setShapePreview([]);
    const points = this.tracePoints(this.start, p);
    this.start = null;
    this.preview = null;
    if (points.length === 0) return;
    this.engine.beginAction();
    const { char, fg, bg } = this.engine.toolState;
    for (const pt of points) this.engine.setCell(pt.x, pt.y, char, fg, bg);
    this.engine.endAction();
  }
  abstract tracePoints(a: Point, b: Point): Point[];
}

export class LineTool extends ShapeTool {
  tracePoints(a: Point, b: Point): Point[] {
    const out: Point[] = [];
    bresenham(a, b, (x, y) => out.push({ x, y }));
    return out;
  }
}

export class RectTool extends ShapeTool {
  tracePoints(a: Point, b: Point): Point[] {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    const out: Point[] = [];
    for (let x = x0; x <= x1; x++) {
      out.push({ x, y: y0 });
      if (y1 !== y0) out.push({ x, y: y1 });
    }
    for (let y = y0 + 1; y < y1; y++) {
      out.push({ x: x0, y });
      if (x1 !== x0) out.push({ x: x1, y });
    }
    return out;
  }
}
