/* ABOUTME: Shared types for the ASCII engine. */

export interface GridConfig {
  width: number;
  height: number;
  charWidth: number;
  charHeight: number;
}

export interface CellData {
  char: number;
  fg: number;
  bg: number;
  flags: number;
}

export interface ToolState {
  char: number;
  fg: number;
  bg: number;
}

export type ToolKind = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'rect' | 'line';
