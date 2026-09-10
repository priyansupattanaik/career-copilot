import { cloneDocument, type StudioDocument } from "./resume-schema";

const LIMIT = 50;

export function createHistory(initial: StudioDocument) {
  const past: StudioDocument[] = [cloneDocument(initial)];
  let index = 0;

  return {
    push(next: StudioDocument) {
      const snapshot = cloneDocument(next);
      past.splice(index + 1);
      const current = past[index];
      if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
      past.push(snapshot);
      if (past.length > LIMIT) past.shift();
      index = past.length - 1;
    },
    undo(): StudioDocument | null {
      if (index <= 0) return null;
      index -= 1;
      return cloneDocument(past[index]);
    },
    redo(): StudioDocument | null {
      if (index >= past.length - 1) return null;
      index += 1;
      return cloneDocument(past[index]);
    },
    replace(next: StudioDocument) {
      past.length = 0;
      past.push(cloneDocument(next));
      index = 0;
    },
    canUndo() {
      return index > 0;
    },
    canRedo() {
      return index < past.length - 1;
    },
  };
}

export type StudioHistory = ReturnType<typeof createHistory>;
