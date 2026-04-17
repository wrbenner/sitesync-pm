import { create } from 'zustand';
import { teamService } from '../services/teamService';
import type { TeamMember, TeamInvitation, CreateInvitationInput } from '../services/teamService';
import type { OrgRole } from '../types/tenant';
import type { ServiceError } from '../services/errors';

interface TeamState {
  members: TeamMember[];
  invitations: TeamInvitation[];
  myOrgRole: OrgRole | null;
  loading: boolean;
  invitationsLoading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  loadTeamMembers: (organizationId: string) => Promise<void>;
  addTeamMember: (
    organizationId: string,
    userId: string,
    role: OrgRole,
  ) => Promise<{ error: string | null }>;
  updateMemberRole: (
    organizationId: string,
    memberId: string,
    role: OrgRole,
  ) => Promise<{ error: string | null }>;
  removeTeamMember: (
    organizationId: string,
    memberId: string,
  ) => Promise<{ error: string | null }>;

  loadInvitations: (projectId: string) => Promise<void>;
  createInvitation: (
    input: CreateInvitationInput,
  ) => Promise<{ error: string | null; invitation: TeamInvitation | null }>;
  revokeInvitation: (invitationId: string) => Promise<{ error: string | null }>;

  loadMyOrgRole: (organizationId: string) => Promise<void>;
  clearError: () => void;
}

export const useTeamStore = create<TeamState>()((set) => ({
  members: [],
  invitations: [],
  myOrgRole: null,
  loading: false,
  invitationsLoading: false,
  error: null,
  errorDetails: null,

  loadTeamMembers: async (organizationId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await teamService.loadTeamMembers(organizationId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ members: data ?? [], loading: false });
    }
  },

  addTeamMember: async (organizationId, userId, role) => {
    const { data, error } = await teamService.addTeamMember(organizationId, userId, role);
    if (error) return { error: error.userMessage };
    if (data) {
      set((s) => ({
        members: [...s.members, data as unknown as TeamMember],
      }));
    }
    return { error: null };
  },

  updateMemberRole: async (organizationId, memberId, role) => {
    const { error } = await teamService.updateMemberRole(organizationId, memberId, role);
    if (error) return { error: error.userMessage };
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, role } : m,
      ),
    }));
    return { error: null };
  },

  removeTeamMember: async (organizationId, memberId) => {
    const { error } = await teamService.removeTeamMember(organizationId, memberId);
    if (error) return { error: error.userMessage };
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
    return { error: null };
  },

  loadInvitations: async (projectId) => {
    set({ invitationsLoading: true });
    const { data, error } = await teamService.loadInvitations(projectId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, invitationsLoading: false });
    } else {
      set({ invitations: data ?? [], invitationsLoading: false });
    }
  },

  createInvitation: async (input) => {
    const { data, error } = await teamService.createInvitation(input);
    if (error) return { error: error.userMessage, invitation: null };
    if (data) {
      set((s) => ({ invitations: [data, ...s.invitations] }));
    }
    return { error: null, invitation: data };
  },

  revokeInvitation: async (invitationId) => {
    const { error } = await teamService.revokeInvitation(invitationId);
    if (error) return { error: error.userMessage };
    set((s) => ({
      invitations: s.invitations.filter((i) => i.id !== invitationId),
    }));
    return { error: null };
  },

  loadMyOrgRole: async (organizationId) => {
    const { data, error } = await teamService.getMyOrgRole(organizationId);
    if (!error) {
      set({ myOrgRole: data ?? null });
    }
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
