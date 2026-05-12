/* ABOUTME: Tool implementations for the ASCII art creator. */
import { Engine } from './core';

export interface Point {
  x: number;
  y: number;
}

export abstract class Tool {
  protected engine: Engine;
  constructor(engine: Engine) {
    this.engine = engine;
  }
  abstract onMouseDown(p: Point): void;
  abstract onMouseMove(p: Point): void;
  abstract onMouseUp(p: Point): void;
}

export class Brush extends Tool {
  private isDrawing: boolean = false;
  private lastPoint: Point | null = null;
  public char: number = 64; // '@'
  public fg: number = 255;
  public bg: number = 0;

  onMouseDown(p: Point): void {
    this.isDrawing = true;
    this.engine.beginAction();
    this.draw(p);
    this.lastPoint = p;
  }

  onMouseMove(p: Point): void {
    if (!this.isDrawing) return;
    if (this.lastPoint) {
      this.drawLine(this.lastPoint, p);
    } else {
      this.draw(p);
    }
    this.lastPoint = p;
  }

  onMouseUp(p: Point): void {
    if (!this.isDrawing) return;
    this.draw(p);
    this.isDrawing = false;
    this.lastPoint = null;
    this.engine.endAction();
  }

  private draw(p: Point): void {
    this.engine.setCell(p.x, p.y, this.char, this.fg, this.bg);
  }

  // Bresenham's line algorithm
  private drawLine(p1: Point, p2: Point): void {
    let x0 = p1.x;
    let y0 = p1.y;
    let x1 = p2.x;
    let y1 = p2.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.draw({ x: x0, y: y0 });
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
}

export class Fill extends Tool {
  public char: number = 64;
  public fg: number = 255;
  public bg: number = 0;

  onMouseDown(p: Point): void {
    this.engine.beginAction();
    this.floodFill(p);
    this.engine.endAction();
  }

  onMouseMove(_p: Point): void {}
  onMouseUp(_p: Point): void {}

  private floodFill(p: Point): void {
    const targetValue = this.engine.memory.getCell(p.x, p.y);
    const newValue = (this.char & 0xFF) | ((this.fg & 0xFF) << 8) | ((this.bg & 0xFF) << 16);
    
    if (targetValue === newValue) return;

    const queue: Point[] = [p];
    const visited = new Set<number>();
    const { width, height } = this.engine.config;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const idx = curr.y * width + curr.x;

      if (visited.has(idx)) continue;
      visited.add(idx);

      if (this.engine.memory.getCell(curr.x, curr.y) === targetValue) {
        this.engine.setCell(curr.x, curr.y, this.char, this.fg, this.bg);

        if (curr.x > 0) queue.push({ x: curr.x - 1, y: curr.y });
        if (curr.x < width - 1) queue.push({ x: curr.x + 1, y: curr.y });
        if (curr.y > 0) queue.push({ x: curr.x, y: curr.y - 1 });
        if (curr.y < height - 1) queue.push({ x: curr.x, y: curr.y + 1 });
      }
    }
  }
}
