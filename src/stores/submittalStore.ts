import { create } from 'zustand';
import { submittalService } from '../services/submittalService';
import type { Submittal, SubmittalApproval, SubmittalStatus } from '../types/database';
import type { SubmittalStamp } from '../machines/submittalMachine';

// SubmittalReviewer maps to the submittal_approvals row. Exported for consumers
// that reference the old type name from when this was a separate table.
export type { SubmittalApproval as SubmittalReviewer } from '../types/database';

// Extended input accepted by the store's createSubmittal for backward compatibility
// with existing form callers that pass legacy fields (description, priority, created_by).
// The service layer only persists fields that exist in the database schema.
type StoreCreateInput = {
  project_id: string;
  title: string;
  spec_section?: string;
  subcontractor?: string;
  assigned_to?: string;
  due_date?: string;
  submit_by_date?: string;
  required_onsite_date?: string;
  lead_time_weeks?: number;
  // Legacy fields accepted but not persisted (not in current DB schema)
  description?: string;
  priority?: string;
  created_by?: string;
  reviewer_ids?: string[];
};

interface SubmittalState {
  submittals: Submittal[];
  /** Approval records keyed by submittalId. */
  approvals: Record<string, SubmittalApproval[]>;
  /**
   * @deprecated Use approvals. Kept for backward compatibility with components
   * that reference reviewers from the old submittal_reviewers table.
   */
  reviewers: Record<string, SubmittalApproval[]>;
  loading: boolean;
  error: string | null;

  loadSubmittals: (projectId: string) => Promise<void>;
  createSubmittal: (
    input: StoreCreateInput,
  ) => Promise<{ error: string | null; submittal: Submittal | null }>;
  updateSubmittal: (id: string, updates: Partial<Submittal>) => Promise<{ error: string | null }>;
  /** Lifecycle-enforced status transition with server-side role validation. */
  transitionStatus: (id: string, status: SubmittalStatus) => Promise<{ error: string | null }>;
  /** @deprecated Use transitionStatus. */
  updateSubmittalStatus: (id: string, status: SubmittalStatus) => Promise<{ error: string | null }>;
  loadApprovals: (submittalId: string) => Promise<void>;
  /** @deprecated Use loadApprovals. */
  loadReviewers: (submittalId: string) => Promise<void>;
  addApproval: (
    submittalId: string,
    projectId: string,
    stamp: SubmittalStamp,
    comments?: string,
  ) => Promise<{ error: string | null }>;
  /** @deprecated Use addApproval. Maps legacy review status strings to stamps. */
  reviewSubmittal: (
    submittalId: string,
    reviewerId: string,
    status: 'approved' | 'rejected' | 'revise',
    comments?: string,
  ) => Promise<{ error: string | null }>;
  deleteSubmittal: (id: string) => Promise<{ error: string | null }>;
}

export const useSubmittalStore = create<SubmittalState>()((set, get) => ({
  submittals: [],
  approvals: {},
  reviewers: {},
  loading: false,
  error: null,

  loadSubmittals: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await submittalService.loadSubmittals(projectId);
    if (error) {
      set({ error, loading: false });
    } else {
      set({ submittals: data ?? [], loading: false });
    }
  },

  createSubmittal: async (input) => {
    // Only forward fields that exist in the database schema.
    // Legacy fields (description, priority, created_by, reviewer_ids) are silently
    // discarded until the schema is extended via migration.
    const { data, error } = await submittalService.createSubmittal({
      project_id: input.project_id,
      title: input.title,
      spec_section: input.spec_section,
      subcontractor: input.subcontractor,
      assigned_to: input.assigned_to,
      due_date: input.due_date,
      submit_by_date: input.submit_by_date,
      required_onsite_date: input.required_onsite_date,
      lead_time_weeks: input.lead_time_weeks,
    });
    if (error) return { error, submittal: null };
    if (data) {
      set((s) => ({ submittals: [data, ...s.submittals] }));
    }
    return { error: null, submittal: data };
  },

  updateSubmittal: async (id, updates) => {
    const { error } = await submittalService.updateSubmittal(id, updates);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) => (sub.id === id ? { ...sub, ...updates } : sub)),
      }));
    }
    return { error };
  },

  transitionStatus: async (id, status) => {
    const { error } = await submittalService.transitionStatus(id, status);
    if (!error) {
      set((s) => ({
        submittals: s.submittals.map((sub) => (sub.id === id ? { ...sub, status } : sub)),
      }));
    }
    return { error };
  },

  // Backward compat shim — delegates to transitionStatus
  updateSubmittalStatus: async (id, status) => {
    return get().transitionStatus(id, status);
  },

  loadApprovals: async (submittalId) => {
    const { data, error } = await submittalService.loadApprovals(submittalId);
    if (!error && data) {
      set((s) => ({
        approvals: { ...s.approvals, [submittalId]: data },
        // Mirror into reviewers for backward compat
        reviewers: { ...s.reviewers, [submittalId]: data },
      }));
    }
  },

  // Backward compat shim — delegates to loadApprovals
  loadReviewers: async (submittalId) => {
    return get().loadApprovals(submittalId);
  },

  addApproval: async (submittalId, projectId, stamp, comments) => {
    const { error } = await submittalService.addApproval(submittalId, projectId, stamp, comments);
    if (!error) {
      await get().loadApprovals(submittalId);
    }
    return { error };
  },

  // Backward compat shim for old reviewSubmittal calls.
  // Maps legacy status strings to SubmittalStamp values.
  reviewSubmittal: async (submittalId, _reviewerId, status, comments) => {
    const submittal = get().submittals.find((s) => s.id === submittalId);
    if (!submittal) return { error: 'Submittal not found in store' };

    const stampMap: Record<'approved' | 'rejected' | 'revise', SubmittalStamp> = {
      approved: 'approved',
      rejected: 'rejected',
      revise: 'revise_and_resubmit',
    };

    return get().addApproval(submittalId, submittal.project_id, stampMap[status], comments);
  },

  deleteSubmittal: async (id) => {
    const { error } = await submittalService.deleteSubmittal(id);
    if (!error) {
      set((s) => ({ submittals: s.submittals.filter((sub) => sub.id !== id) }));
    }
    return { error };
  },
}));
