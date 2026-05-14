/* ABOUTME: Engine orchestrator: owns memory, renderer, tools, history, storage. */
/* ABOUTME: Tools share toolState; persistence is debounced; shape previews are non-destructive. */
import { GridMemory } from './memory';
import { Renderer } from './renderer';
import { SpriteSheet } from './sprites';
import { History } from './history';
import type { Action } from './history';
import { Storage, randomId } from './storage';
import type { DocRecord } from './storage';
import type { GridConfig, ToolState, ToolKind } from './types';
import { Tool, Brush, Eraser, Fill, Eyedropper, LineTool, RectTool } from './tools';
import type { Point } from './tools';

const PERSIST_DEBOUNCE_MS = 400;

export class Engine {
  public memory: GridMemory;
  public renderer: Renderer;
  public sprites: SpriteSheet;
  public history: History;
  public storage: Storage;
  public config: GridConfig;
  public toolState: ToolState = { char: 64, fg: 15, bg: 0 };
  public currentTool: Tool;

  private tools: Record<ToolKind, Tool>;
  private currentAction: Action = [];
  private docId: string;
  private docName: string = 'Untitled';
  private persistTimer: number | null = null;
  private previewBackup: Map<number, number>;
  public onToolStateChange?: (state: ToolState) => void;
  public onDocChange?: (info: { id: string; name: string }) => void;

  constructor(canvas: HTMLCanvasElement, config: GridConfig, sprites: SpriteSheet, docId?: string) {
    this.config = config;
    this.memory = new GridMemory(config);
    this.sprites = sprites;
    this.renderer = new Renderer(canvas, this.memory, this.sprites, config);
    this.history = new History();
    this.storage = new Storage();
    this.previewBackup = new Map();
    this.docId = docId ?? randomId();

    this.tools = {
      brush: new Brush(this),
      eraser: new Eraser(this),
      fill: new Fill(this),
      eyedropper: new Eyedropper(this),
      line: new LineTool(this),
      rect: new RectTool(this),
    };
    this.currentTool = this.tools.brush;
  }

  public setTool(kind: ToolKind): void {
    this.currentTool = this.tools[kind];
  }

  public setToolState(next: Partial<ToolState>): void {
    this.toolState = { ...this.toolState, ...next };
    this.onToolStateChange?.(this.toolState);
  }

  public get id(): string { return this.docId; }
  public get name(): string { return this.docName; }

  public setName(name: string): void {
    this.docName = name;
    this.onDocChange?.({ id: this.docId, name });
    this.schedulePersist();
  }

  public getGridPoint(clientX: number, clientY: number, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / (this.config.width * this.config.charWidth);
    const scaleY = canvas.clientHeight / (this.config.height * this.config.charHeight);
    const x = Math.floor(((clientX - rect.left) / scaleX) / this.config.charWidth);
    const y = Math.floor(((clientY - rect.top) / scaleY) / this.config.charHeight);
    return { x, y };
  }

  public inBounds(p: Point): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.config.width && p.y < this.config.height;
  }

  public async init(initialBuffer?: Uint32Array, initialName?: string): Promise<void> {
    if (initialBuffer && initialBuffer.length === this.memory.getBuffer().length) {
      this.memory.getBuffer().set(initialBuffer);
    }
    if (initialName) this.docName = initialName;
    this.renderer.markAllDirty();
    this.renderer.start();
    this.onDocChange?.({ id: this.docId, name: this.docName });
  }

  public stop(): void {
    this.renderer.stop();
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.flushPersist();
    }
  }

  public beginAction(): void { this.currentAction = []; }

  public setCell(x: number, y: number, char: number, fg: number, bg: number): void {
    if (x < 0 || y < 0 || x >= this.config.width || y >= this.config.height) return;
    const oldValue = this.memory.getCell(x, y);
    const newValue = GridMemory.pack(char, fg, bg);
    if (oldValue === newValue) return;
    this.memory.setCell(x, y, newValue);
    this.renderer.markDirty(x, y);
    this.currentAction.push({
      index: this.memory.getIndex(x, y),
      oldValue,
      newValue,
    });
  }

  public endAction(): void {
    if (this.currentAction.length > 0) {
      this.history.push(this.currentAction);
      this.currentAction = [];
      this.schedulePersist();
    }
  }

  public undo(): void {
    const action = this.history.undo();
    if (!action) return;
    const buf = this.memory.getBuffer();
    for (const d of action) {
      buf[d.index] = d.oldValue;
      const x = d.index % this.config.width;
      const y = (d.index - x) / this.config.width;
      this.renderer.markDirty(x, y);
    }
    this.schedulePersist();
  }

  public redo(): void {
    const action = this.history.redo();
    if (!action) return;
    const buf = this.memory.getBuffer();
    for (const d of action) {
      buf[d.index] = d.newValue;
      const x = d.index % this.config.width;
      const y = (d.index - x) / this.config.width;
      this.renderer.markDirty(x, y);
    }
    this.schedulePersist();
  }

  public clear(): void {
    this.beginAction();
    const { width, height } = this.config;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.setCell(x, y, 32, 15, 0);
      }
    }
    this.endAction();
  }

  public setHover(p: Point | null): void {
    if (!p) {
      this.renderer.setHover(null, null);
      return;
    }
    if (!this.inBounds(p)) {
      this.renderer.setHover(null, null);
      return;
    }
    this.renderer.setHover(p.x, p.y);
  }

  // Stamps a shape preview directly into the buffer while remembering the
  // original cell values so the preview can be cleared without touching the
  // history stack. Committing the shape happens through setCell as usual.
  public setShapePreview(points: Point[]): void {
    const { width, height } = this.config;
    const buf = this.memory.getBuffer();

    for (const [idx, prev] of this.previewBackup) {
      buf[idx] = prev;
      const x = idx % width;
      const y = (idx - x) / width;
      this.renderer.markDirty(x, y);
    }
    this.previewBackup.clear();

    const { char, fg, bg } = this.toolState;
    const stamp = GridMemory.pack(char, fg, bg);
    for (const p of points) {
      if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
      const idx = p.y * width + p.x;
      if (this.previewBackup.has(idx)) continue;
      this.previewBackup.set(idx, buf[idx]);
      buf[idx] = stamp;
      this.renderer.markDirty(p.x, p.y);
    }
  }

  public async persistDoc(): Promise<DocRecord> {
    const record: DocRecord = {
      id: this.docId,
      name: this.docName,
      width: this.config.width,
      height: this.config.height,
      buffer: new Uint32Array(this.memory.getBuffer()),
      updatedAt: Date.now(),
    };
    await this.storage.saveDoc(record);
    await this.storage.setCurrentId(this.docId);
    return record;
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => this.flushPersist(), PERSIST_DEBOUNCE_MS);
  }

  private flushPersist(): void {
    this.persistTimer = null;
    void this.persistDoc();
  }

  public async exportToANSI(): Promise<string> {
    return new Promise(resolve => {
      const worker = new Worker(new URL('../workers/exporter.ts', import.meta.url), { type: 'module' });
      worker.onmessage = e => {
        resolve(e.data as string);
        worker.terminate();
      };
      const sourceBytes = new Uint8Array(
        this.memory.getBuffer().buffer,
        this.memory.getBuffer().byteOffset,
        this.memory.getBuffer().byteLength,
      );
      const copy = sourceBytes.slice();
      worker.postMessage(
        { buffer: copy.buffer, width: this.config.width, height: this.config.height },
        [copy.buffer],
      );
    });
  }

  public exportToPlainText(): string {
    const { width, height } = this.config;
    const buf = this.memory.getBuffer();
    const lines: string[] = [];
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const char = buf[y * width + x] & 0xffff;
        row += char === 0 ? ' ' : String.fromCharCode(char);
      }
      lines.push(row.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }
}
