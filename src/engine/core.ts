/* ABOUTME: Core engine orchestrator. */
import { GridMemory } from './memory';
import { Renderer } from './renderer';
import { SpriteSheet } from './sprites';
import { History } from './history';
import type { Action } from './history';
import { Storage } from './storage';
import type { GridConfig } from './types';
import { Tool, Brush, Fill } from './tools';
import type { Point } from './tools';

export class Engine {
  public memory: GridMemory;
  public renderer: Renderer;
  public sprites: SpriteSheet;
  public history: History;
  public storage: Storage;
  public config: GridConfig;
  public currentTool: Tool;
  public brush: Brush;
  public fill: Fill;

  private currentAction: Action = [];

  constructor(canvas: HTMLCanvasElement, config: GridConfig) {
    this.config = config;
    this.memory = new GridMemory(config);
    this.sprites = new SpriteSheet(config.charWidth, config.charHeight);
    this.renderer = new Renderer(canvas, this.memory, this.sprites, config);
    this.history = new History();
    this.storage = new Storage();
    
    this.brush = new Brush(this);
    this.fill = new Fill(this);
    this.currentTool = this.brush;
  }

  public getGridPoint(clientX: number, clientY: number, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / this.config.charWidth);
    const y = Math.floor((clientY - rect.top) / this.config.charHeight);
    return { x, y };
  }

  public async init() {
    const savedState = await this.storage.loadState('current-session');
    if (savedState) {
      this.memory.getBuffer().set(savedState);
      // Mark all dirty
      for (let y = 0; y < this.config.height; y++) {
        for (let x = 0; x < this.config.width; x++) {
          this.renderer.markDirty(x, y);
        }
      }
    }
    this.renderer.start();
  }

  public beginAction() {
    this.currentAction = [];
  }

  public setCell(x: number, y: number, char: number, fg: number, bg: number, flags: number = 0) {
    const oldValue = this.memory.getCell(x, y);
    const newValue = GridMemory.pack(char, fg, bg, flags);
    
    if (oldValue !== newValue) {
      this.memory.setCell(x, y, newValue);
      this.renderer.markDirty(x, y);
      this.currentAction.push({
        index: this.memory.getIndex(x, y),
        oldValue,
        newValue
      });
    }
  }

  public endAction() {
    if (this.currentAction.length > 0) {
      this.history.push(this.currentAction);
      this.currentAction = [];
      this.persist();
    }
  }

  public undo() {
    const action = this.history.undo();
    if (action) {
      for (const diff of action) {
        this.memory.getBuffer()[diff.index] = diff.oldValue;
        const x = diff.index % this.config.width;
        const y = Math.floor(diff.index / this.config.width);
        this.renderer.markDirty(x, y);
      }
      this.persist();
    }
  }

  public redo() {
    const action = this.history.redo();
    if (action) {
      for (const diff of action) {
        this.memory.getBuffer()[diff.index] = diff.newValue;
        const x = diff.index % this.config.width;
        const y = Math.floor(diff.index / this.config.width);
        this.renderer.markDirty(x, y);
      }
      this.persist();
    }
  }

  private async persist() {
    await this.storage.saveState('current-session', this.memory.getBuffer());
  }

  public async exportToANSI(): Promise<string> {
    return new Promise((resolve) => {
      const worker = new Worker(new URL('../workers/exporter.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate();
      };
      worker.postMessage({
        buffer: this.memory.getBuffer().buffer,
        width: this.config.width,
        height: this.config.height
      }, [this.memory.getBuffer().buffer.slice(0)]); // Pass a copy to avoid neutering the main buffer
    });
  }
}
