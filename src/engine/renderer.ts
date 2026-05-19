/* ABOUTME: Dirty-cell renderer that blits glyphs from a sprite atlas. */
/* ABOUTME: Supports a single overlay cell for tool hover preview. */
import { GridMemory } from './memory';
import { SpriteSheet } from './sprites';
import type { GridConfig } from './types';
import { getCellBackgroundColor, getXtermColor } from './colors';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private memory: GridMemory;
  private sprites: SpriteSheet;
  private config: GridConfig;
  private dirty: Uint8Array;
  private hoverX: number | null = null;
  private hoverY: number | null = null;
  private rafHandle: number | null = null;

  constructor(canvas: HTMLCanvasElement, memory: GridMemory, sprites: SpriteSheet, config: GridConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Could not get 2d context');
    this.ctx = ctx;
    this.memory = memory;
    this.sprites = sprites;
    this.config = config;
    this.dirty = new Uint8Array(config.width * config.height).fill(1);

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = config.width * config.charWidth * dpr;
    this.canvas.height = config.height * config.charHeight * dpr;
    this.canvas.style.width = `${config.width * config.charWidth}px`;
    this.canvas.style.height = `${config.height * config.charHeight}px`;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  public markDirty(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.config.width || y >= this.config.height) return;
    this.dirty[y * this.config.width + x] = 1;
  }

  public markAllDirty(): void {
    this.dirty.fill(1);
  }

  public setHover(x: number | null, y: number | null): void {
    if (this.hoverX === x && this.hoverY === y) return;
    if (this.hoverX !== null && this.hoverY !== null) this.markDirty(this.hoverX, this.hoverY);
    this.hoverX = x;
    this.hoverY = y;
    if (x !== null && y !== null) this.markDirty(x, y);
  }

  public render(): void {
    const { width, height, charWidth, charHeight } = this.config;
    const buffer = this.memory.getBuffer();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!this.dirty[idx]) continue;

        const value = buffer[idx];
        const { char, fg, bg } = GridMemory.unpack(value);
        this.sprites.drawChar(this.ctx, char, x * charWidth, y * charHeight, getXtermColor(fg), getCellBackgroundColor(bg));

        if (this.hoverX === x && this.hoverY === y) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          this.ctx.fillRect(x * charWidth, y * charHeight, charWidth, charHeight);
        }

        this.dirty[idx] = 0;
      }
    }
  }

  public start(): void {
    const loop = () => {
      this.render();
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }
}
