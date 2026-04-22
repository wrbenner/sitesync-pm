export interface AnnotationShape {
  id: string;
  type: 'rectangle' | 'text' | 'polygon' | 'pin' | 'measure' | 'highlight' | 'draw' | 'area' | 'count' | 'path';
  coordinates: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    endX?: number;
    endY?: number;
    points?: Array<[number, number]>;
    /** Serialized fabric Path commands for 'draw' / 'highlight' strokes — preserves the real brush path. */
    pathData?: unknown;
  };
  color: string;
  text?: string;
  /** For 'count' markers — the group/label (e.g. "Receptacles"). */
  countLabel?: string;
  /** For 'count' markers — the sequential index within its label group. */
  countIndex?: number;
  pageNumber: number;
  createdBy: string;
  createdAt: string;
  linkedRfiId?: string;
  linkedPunchItemId?: string;
}

const MAX_HISTORY = 50;

export class AnnotationHistory {
  private undoStack: AnnotationShape[][] = [];
  private redoStack: AnnotationShape[][] = [];

  push(state: AnnotationShape[]): void {
    const snapshot = state.map((s) => ({ ...s }));
    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): AnnotationShape[] | null {
    if (this.undoStack.length < 2) return null;
    const current = this.undoStack.pop();
    if (current) this.redoStack.push(current);
    const prev = this.undoStack[this.undoStack.length - 1];
    return prev ? prev.map((s) => ({ ...s })) : null;
  }

  redo(): AnnotationShape[] | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(next);
    return next.map((s) => ({ ...s }));
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
