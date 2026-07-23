import type { GeneratedHvacModel } from '../../lib/api';

export type ViewerCommandKind =
  | 'component-create'
  | 'component-delete'
  | 'component-move'
  | 'route-create'
  | 'route-delete'
  | 'route-point-insert'
  | 'route-point-move'
  | 'route-point-delete'
  | 'route-endpoint-move'
  | 'riser-create'
  | 'property-change'
  | 'lock-change'
  | 'visibility-change'
  | 'transaction';

export type ViewerCommandTransactionKind = 'branch-create' | 'junction-create' | string;

export type ViewerEditableSnapshot = {
  generatedModel: GeneratedHvacModel | null;
};

export type ViewerCommandEntry = {
  id: string;
  kind: ViewerCommandKind;
  transactionKind?: ViewerCommandTransactionKind;
  label: string;
  before: ViewerEditableSnapshot;
  after: ViewerEditableSnapshot;
  beforeRevision: number;
  afterRevision: number;
};

export type ViewerCommandHistoryState = {
  undoStack: ViewerCommandEntry[];
  redoStack: ViewerCommandEntry[];
  currentRevision: number;
  cleanRevision: number;
  nextSequence: number;
  capacity: number;
};

export type ViewerHistoryShortcut = 'undo' | 'redo' | null;

const DEFAULT_HISTORY_CAPACITY = 50;

export function createViewerCommandHistory(
  snapshot: ViewerEditableSnapshot = { generatedModel: null },
  capacity = DEFAULT_HISTORY_CAPACITY
): ViewerCommandHistoryState {
  return {
    undoStack: [],
    redoStack: [],
    currentRevision: 0,
    cleanRevision: 0,
    nextSequence: 1,
    capacity: Math.max(DEFAULT_HISTORY_CAPACITY, Math.round(capacity)),
  };
}

export function snapshotViewerEditableState(
  generatedModel: GeneratedHvacModel | null
): ViewerEditableSnapshot {
  return { generatedModel: cloneDomainValue(generatedModel) };
}

export function recordViewerCommand(
  history: ViewerCommandHistoryState,
  input: {
    kind: ViewerCommandKind;
    transactionKind?: ViewerCommandTransactionKind;
    label: string;
    before: ViewerEditableSnapshot;
    after: ViewerEditableSnapshot;
  }
): ViewerCommandHistoryState {
  if (viewerSnapshotsEqual(input.before, input.after)) return history;
  const beforeRevision = history.currentRevision;
  const afterRevision = beforeRevision + 1;
  const entry: ViewerCommandEntry = {
    id: `viewer-command-${history.nextSequence}`,
    kind: input.kind,
    transactionKind: input.transactionKind,
    label: input.label,
    before: cloneDomainValue(input.before),
    after: cloneDomainValue(input.after),
    beforeRevision,
    afterRevision,
  };
  const undoStack = [...history.undoStack, entry].slice(-history.capacity);
  return {
    ...history,
    undoStack,
    redoStack: [],
    currentRevision: afterRevision,
    nextSequence: history.nextSequence + 1,
  };
}

export function undoViewerCommand(history: ViewerCommandHistoryState):
  | {
      history: ViewerCommandHistoryState;
      entry: ViewerCommandEntry;
      snapshot: ViewerEditableSnapshot;
    }
  | null {
  const entry = history.undoStack[history.undoStack.length - 1];
  if (!entry) return null;
  return {
    entry,
    snapshot: cloneDomainValue(entry.before),
    history: {
      ...history,
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, entry],
      currentRevision: entry.beforeRevision,
    },
  };
}

export function redoViewerCommand(history: ViewerCommandHistoryState):
  | {
      history: ViewerCommandHistoryState;
      entry: ViewerCommandEntry;
      snapshot: ViewerEditableSnapshot;
    }
  | null {
  const entry = history.redoStack[history.redoStack.length - 1];
  if (!entry) return null;
  return {
    entry,
    snapshot: cloneDomainValue(entry.after),
    history: {
      ...history,
      undoStack: [...history.undoStack, entry].slice(-history.capacity),
      redoStack: history.redoStack.slice(0, -1),
      currentRevision: entry.afterRevision,
    },
  };
}

export function markViewerHistoryClean(
  history: ViewerCommandHistoryState
): ViewerCommandHistoryState {
  return { ...history, cleanRevision: history.currentRevision };
}

export function clearViewerCommandHistory(
  history: ViewerCommandHistoryState,
  snapshot: ViewerEditableSnapshot = { generatedModel: null }
): ViewerCommandHistoryState {
  return {
    undoStack: [],
    redoStack: [],
    currentRevision: 0,
    cleanRevision: 0,
    nextSequence: history.nextSequence,
    capacity: history.capacity,
  };
}

export function viewerHistoryCanUndo(history: ViewerCommandHistoryState): boolean {
  return history.undoStack.length > 0;
}

export function viewerHistoryCanRedo(history: ViewerCommandHistoryState): boolean {
  return history.redoStack.length > 0;
}

export function viewerHistoryIsDirty(history: ViewerCommandHistoryState): boolean {
  return history.currentRevision !== history.cleanRevision;
}

export function viewerSnapshotsEqual(
  left: ViewerEditableSnapshot,
  right: ViewerEditableSnapshot
): boolean {
  return stableStringify(left) === stableStringify(right);
}

export function viewerHistoryShortcutFromEvent(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'> & {
    target?: EventTarget | null;
  }
): ViewerHistoryShortcut {
  if (event.isComposing || isTextEditingTarget(event.target)) return null;
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) return null;
  if (key === 'z' && event.shiftKey) return 'redo';
  if (key === 'z') return 'undo';
  if (key === 'y' && event.ctrlKey && !event.metaKey) return 'redo';
  return null;
}

function isTextEditingTarget(target: EventTarget | null | undefined): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function cloneDomainValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortForStableStringify(value));
}

function sortForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableStringify);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce(
      (acc, key) => ({
        ...acc,
        [key]: sortForStableStringify((value as Record<string, unknown>)[key]),
      }),
      {}
    );
}
