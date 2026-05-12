/* ABOUTME: Memory-efficient undo/redo system using state diffs. */

export interface Diff {
  index: number;
  oldValue: number;
  newValue: number;
}

export type Action = Diff[];

export class History {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private maxDepth: number;

  constructor(maxDepth: number = 100) {
    this.maxDepth = maxDepth;
  }

  public push(action: Action): void {
    if (action.length === 0) return;
    this.undoStack.push(action);
    this.redoStack = []; // Clear redo stack on new action
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
  }

  public undo(): Action | undefined {
    const action = this.undoStack.pop();
    if (action) {
      this.redoStack.push(action);
    }
    return action;
  }

  public redo(): Action | undefined {
    const action = this.redoStack.pop();
    if (action) {
      this.undoStack.push(action);
    }
    return action;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
