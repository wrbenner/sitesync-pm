import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceError } from '../../services/errors';

vi.mock('../../services/projectService', () => ({
  projectService: {
    loadProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    loadMembers: vi.fn(),
    addMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  },
}));

import { useProjectStore } from '../../stores/projectStore';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/entities';

const mockError: ServiceError = {
  category: 'DatabaseError',
  code: 'DB_ERROR',
  message: 'Connection failed',
  userMessage: 'Failed to perform operation',
};

const mockProject = {
  id: 'p-1',
  name: 'Test Project',
  organization_id: 'org-1',
  status: 'active',
} as Project;

const mockMember = {
  id: 'm-1',
  project_id: 'p-1',
  user_id: 'u-1',
  role: 'superintendent' as const,
};

beforeEach(() => {
  useProjectStore.setState(
    {
      activeProject: null,
      projectList: [],
      projects: [],
      members: [],
      metrics: null,
      loading: false,
      error: null,
      errorDetails: null,
    },
    true,
  );
  vi.clearAllMocks();
});

// ── updateProject ─────────────────────────────────────────────────────────────

describe('projectStore.updateProject', () => {
  it('applies optimistic update before service call resolves', async () => {
    useProjectStore.setState({ projects: [mockProject] });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(projectService.updateProject).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof projectService.updateProject>,
    );

    const pending = useProjectStore.getState().updateProject('p-1', { name: 'Renamed' });

    // Optimistic update visible immediately (before service resolves)
    expect(useProjectStore.getState().projects[0].name).toBe('Renamed');

    resolveService({ data: null, error: null });
    const result = await pending;
    expect(result.error).toBeNull();
    expect(useProjectStore.getState().projects[0].name).toBe('Renamed');
  });

  it('rolls back optimistic update when service returns an error', async () => {
    useProjectStore.setState({ projects: [mockProject] });
    vi.mocked(projectService.updateProject).mockResolvedValue({ data: null, error: mockError });

    const result = await useProjectStore.getState().updateProject('p-1', { name: 'Renamed' });

    expect(result.error).toBe(mockError.userMessage);
    expect(useProjectStore.getState().projects[0].name).toBe('Test Project');
  });

  it('preserves other projects when optimistically updating one', async () => {
    const other = { ...mockProject, id: 'p-2', name: 'Other Project' };
    useProjectStore.setState({ projects: [mockProject, other] });
    vi.mocked(projectService.updateProject).mockResolvedValue({ data: null, error: null });

    await useProjectStore.getState().updateProject('p-1', { name: 'Updated' });

    expect(useProjectStore.getState().projects).toHaveLength(2);
    expect(useProjectStore.getState().projects[1].name).toBe('Other Project');
  });
});

// ── deleteProject ─────────────────────────────────────────────────────────────

describe('projectStore.deleteProject', () => {
  it('removes project from list optimistically', async () => {
    useProjectStore.setState({ projects: [mockProject] });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(projectService.deleteProject).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof projectService.deleteProject>,
    );

    const pending = useProjectStore.getState().deleteProject('p-1');

    expect(useProjectStore.getState().projects).toHaveLength(0);

    resolveService({ data: null, error: null });
    await pending;
  });

  it('restores project on service error', async () => {
    useProjectStore.setState({ projects: [mockProject] });
    vi.mocked(projectService.deleteProject).mockResolvedValue({ data: null, error: mockError });

    const result = await useProjectStore.getState().deleteProject('p-1');

    expect(result.error).toBe(mockError.userMessage);
    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().projects[0].id).toBe('p-1');
  });

  it('clears activeProject when the active project is deleted', async () => {
    const activeProjectData = { id: 'p-1', name: 'Active' };
    useProjectStore.setState({
      projects: [mockProject],
      activeProject: activeProjectData as never,
    });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(projectService.deleteProject).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof projectService.deleteProject>,
    );

    const pending = useProjectStore.getState().deleteProject('p-1');

    // Optimistic: activeProject cleared
    expect(useProjectStore.getState().activeProject).toBeNull();

    resolveService({ data: null, error: null });
    await pending;
  });
});

// ── removeMember ──────────────────────────────────────────────────────────────

describe('projectStore.removeMember', () => {
  it('removes member optimistically and keeps removal on success', async () => {
    useProjectStore.setState({ members: [mockMember as never] });
    vi.mocked(projectService.removeMember).mockResolvedValue({ data: null, error: null });

    const result = await useProjectStore.getState().removeMember('m-1');

    expect(result.error).toBeNull();
    expect(useProjectStore.getState().members).toHaveLength(0);
  });

  it('restores member on service error', async () => {
    useProjectStore.setState({ members: [mockMember as never] });
    vi.mocked(projectService.removeMember).mockResolvedValue({ data: null, error: mockError });

    const result = await useProjectStore.getState().removeMember('m-1');

    expect(result.error).toBe(mockError.userMessage);
    expect(useProjectStore.getState().members).toHaveLength(1);
  });
});

// ── updateMemberRole ──────────────────────────────────────────────────────────

describe('projectStore.updateMemberRole', () => {
  it('applies role update optimistically', async () => {
    useProjectStore.setState({ members: [mockMember as never] });

    let resolveService!: (v: { data: null; error: null }) => void;
    vi.mocked(projectService.updateMemberRole).mockReturnValue(
      new Promise((res) => { resolveService = res; }) as ReturnType<typeof projectService.updateMemberRole>,
    );

    const pending = useProjectStore.getState().updateMemberRole('m-1', 'foreman');

    expect((useProjectStore.getState().members[0] as typeof mockMember).role).toBe('foreman');

    resolveService({ data: null, error: null });
    await pending;
  });

  it('rolls back role on service error', async () => {
    useProjectStore.setState({ members: [mockMember as never] });
    vi.mocked(projectService.updateMemberRole).mockResolvedValue({ data: null, error: mockError });

    await useProjectStore.getState().updateMemberRole('m-1', 'foreman');

    expect((useProjectStore.getState().members[0] as typeof mockMember).role).toBe('superintendent');
  });
});
