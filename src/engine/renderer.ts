/* ABOUTME: Main rendering loop for the ASCII grid. */
import { GridMemory } from './memory';
import { SpriteSheet } from './sprites';
import type { GridConfig } from './types';
import { getXtermColor } from './colors';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private memory: GridMemory;
  private sprites: SpriteSheet;
  private config: GridConfig;
  private dirty: Uint8Array;

  constructor(canvas: HTMLCanvasElement, memory: GridMemory, sprites: SpriteSheet, config: GridConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
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
  }

  public markDirty(x: number, y: number): void {
    const idx = y * this.config.width + x;
    if (idx >= 0 && idx < this.dirty.length) {
      this.dirty[idx] = 1;
    }
  }

  public render(): void {
    const { width, height, charWidth, charHeight } = this.config;
    const buffer = this.memory.getBuffer();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (this.dirty[idx]) {
          const value = buffer[idx];
          const { char, fg, bg } = GridMemory.unpack(value);
          
          const fgColor = getXtermColor(fg);
          const bgColor = getXtermColor(bg);

          this.sprites.drawChar(this.ctx, char, x * charWidth, y * charHeight, fgColor, bgColor);
          this.dirty[idx] = 0;
        }
      }
    }
  }

  public start(): void {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
