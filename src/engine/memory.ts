/* ABOUTME: Memory management for the ASCII grid state. */
import type { GridConfig } from './types';

export class GridMemory {
  private buffer: Uint32Array;
  private width: number;
  private height: number;

  constructor(config: GridConfig) {
    this.width = config.width;
    this.height = config.height;
    this.buffer = new Uint32Array(this.width * this.height);
  }

  public getIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  public setCell(x: number, y: number, value: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.buffer[this.getIndex(x, y)] = value;
    }
  }

  public getCell(x: number, y: number): number {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.buffer[this.getIndex(x, y)];
    }
    return 0;
  }

  public getBuffer(): Uint32Array {
    return this.buffer;
  }

  // Pack data into a single uint32
  // 16 bits char (Unicode support), 8 bits fg, 8 bits bg
  public static pack(char: number, fg: number, bg: number, _flags: number = 0): number {
    return (char & 0xFFFF) | ((fg & 0xFF) << 16) | ((bg & 0xFF) << 24);
  }

  public static unpack(value: number) {
    return {
      char: value & 0xFFFF,
      fg: (value >> 16) & 0xFF,
      bg: (value >> 24) & 0xFF,
      flags: 0,
    };
  }
}
