// Bridges React Query project data into the Zustand project context store.
// Auto-selects the first project when none is active.
// Call once from AppContent to ensure project context is always populated.

import { useEffect, useRef } from 'react';
import { useProjects } from './queries';
import { useProjectContext } from '../stores/projectContextStore';

export function useProjectInit() {
  const { data: projects, isLoading } = useProjects();
  const activeProjectId = useProjectContext((s) => s.activeProjectId);
  const setActiveProject = useProjectContext((s) => s.setActiveProject);

  // Track what we've already synced so the effect is idempotent even when
  // React Query hands us a new array reference with identical content.
  const lastSyncKeyRef = useRef<string>('');
  const lastAutoSetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projects || projects.length === 0) return;

    // Read the current store state inside the effect instead of subscribing
    // via a selector; that avoids the effect's own setState from feeding back
    // into its dependency array and re-triggering.
    const { projects: storeProjects, activeProject: currentActive } = useProjectContext.getState();
    const queryKey = projects.map((p) => p.id).sort().join('|');
    const storeKey = storeProjects.map((p) => p.id).sort().join('|');

    if (queryKey !== storeKey && queryKey !== lastSyncKeyRef.current) {
      lastSyncKeyRef.current = queryKey;
      useProjectContext.setState({ projects });
    }

    const activeStillExists = activeProjectId && projects.some((p) => p.id === activeProjectId);
    if (!activeStillExists) {
      const fallbackId = projects[0].id;
      if (lastAutoSetRef.current !== fallbackId) {
        lastAutoSetRef.current = fallbackId;
        setActiveProject(fallbackId);
      }
    } else if (!currentActive) {
      const match = projects.find((p) => p.id === activeProjectId);
      if (match) useProjectContext.setState({ activeProject: match });
    }
  }, [projects, activeProjectId, setActiveProject]);

  return { projects: projects ?? [], isLoading, hasProjects: (projects?.length ?? 0) > 0 };
}
