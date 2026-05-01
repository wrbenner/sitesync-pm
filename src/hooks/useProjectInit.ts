// Bridges React Query project data into the Zustand project context store.
// Auto-selects the first project when none is active.
// Call once from AppContent to ensure project context is always populated.

import { useEffect, useRef } from 'react';
import { useProjects } from './queries';
import { useProjectContext } from '../stores/projectContextStore';
import { isDevBypassActive } from '../lib/devBypass';
import { DEMO_PROJECT } from '../lib/demoData';
import type { Project } from '../types/entities';

// Minimal Project record built from DEMO_PROJECT for dev-bypass mode.
// Only the fields the sidebar, ProjectGate, and page headers actually read.
const DEV_BYPASS_PROJECT: Project = {
  ...({} as Project), // satisfy all required fields with undefined defaults
  id: DEMO_PROJECT.id,
  name: DEMO_PROJECT.name,
  number: DEMO_PROJECT.number,
  status: DEMO_PROJECT.status,
  contract_value_cents: DEMO_PROJECT.contract_value_cents,
  start_date: DEMO_PROJECT.start_date,
  substantial_completion_date: DEMO_PROJECT.substantial_completion_date,
  address_line1: DEMO_PROJECT.address_line1,
  city: DEMO_PROJECT.city,
  state: DEMO_PROJECT.state,
  postal_code: DEMO_PROJECT.postal_code,
  square_footage: DEMO_PROJECT.square_footage,
  number_of_floors: DEMO_PROJECT.number_of_floors,
  description: DEMO_PROJECT.description,
  is_demo: DEMO_PROJECT.is_demo,
};

export function useProjectInit() {
  const { data: projects, isLoading } = useProjects();
  const activeProjectId = useProjectContext((s) => s.activeProjectId);
  const setActiveProject = useProjectContext((s) => s.setActiveProject);

  // In dev-bypass mode (no Supabase backend), inject the demo project immediately
  // so ProjectGate never blocks navigation and page headers have something to show.
  // We do this on mount, not after load, because the Supabase query will keep
  // retrying (increasing isLoading duration) on connection failures.
  useEffect(() => {
    if (!isDevBypassActive()) return;
    const { projects: storeProjects } = useProjectContext.getState();
    if (storeProjects.length === 0) {
      useProjectContext.setState({
        projects: [DEV_BYPASS_PROJECT],
        activeProjectId: DEV_BYPASS_PROJECT.id,
        activeProject: DEV_BYPASS_PROJECT,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
