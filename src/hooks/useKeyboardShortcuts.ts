import { useEffect, useCallback } from 'react';

export interface Shortcut {
  key: string;
  meta?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handler = useCallback((e: KeyboardEvent) => {
    // Don't fire shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    for (const shortcut of shortcuts) {
      const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && metaMatch && shiftMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

export const globalShortcuts: Omit<Shortcut, 'action'>[] = [
  { key: 'k', meta: true, description: 'Command palette' },
  { key: 'n', meta: true, description: 'New item (context aware)' },
  { key: '/', meta: true, description: 'Keyboard shortcuts' },
  { key: 'b', meta: true, description: 'Toggle sidebar' },
  { key: '.', meta: true, description: 'Toggle AI panel' },
  { key: 'Escape', description: 'Close modal/drawer/panel' },
  { key: '1', meta: true, description: 'Go to Dashboard' },
  { key: '2', meta: true, description: 'Go to Tasks' },
  { key: '3', meta: true, description: 'Go to Schedule' },
  { key: '4', meta: true, description: 'Go to Budget' },
];
