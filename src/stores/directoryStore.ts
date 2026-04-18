import { create } from 'zustand';
import { directoryService } from '../services/directoryService';
import type { Company, Contact, CreateCompanyInput, CreateContactInput } from '../services/directoryService';
import type { CompanyStatus } from '../machines/companyMachine';

export type { Company, Contact };

// ── Legacy shape (backward compat for code that imports DirectoryEntry) ────────

export interface DirectoryEntry {
  id: string;
  project_id: string;
  company: string;
  role: string;
  contactName: string;
  phone: string;
  email: string;
}

// ── Store interface ────────────────────────────────────────────────────────────

interface DirectoryState {
  companies: Company[];
  contacts: Contact[];
  loading: boolean;
  error: string | null;

  /** @deprecated Use companies + contacts. Present for backward compat. */
  entries: DirectoryEntry[];

  loadCompanies: (projectId: string) => Promise<void>;
  createCompany: (input: CreateCompanyInput) => Promise<{ error: string | null }>;
  transitionCompanyStatus: (
    companyId: string,
    newStatus: CompanyStatus,
  ) => Promise<{ error: string | null }>;
  updateCompany: (
    companyId: string,
    updates: Partial<Company>,
  ) => Promise<{ error: string | null }>;
  deleteCompany: (companyId: string) => Promise<{ error: string | null }>;

  loadContacts: (projectId: string) => Promise<void>;
  createContact: (input: CreateContactInput) => Promise<{ error: string | null; contact: Contact | null }>;
  updateContact: (
    contactId: string,
    updates: Partial<Contact>,
  ) => Promise<{ error: string | null }>;
  deleteContact: (contactId: string) => Promise<{ error: string | null }>;

  search: (query: string) => Contact[];
  clearError: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDirectoryStore = create<DirectoryState>()((set, get) => ({
  companies: [],
  contacts: [],
  loading: false,
  error: null,

  get entries(): DirectoryEntry[] {
    return get().contacts.map((c) => ({
      id: c.id,
      project_id: c.project_id,
      company: c.company ?? '',
      role: c.role ?? '',
      contactName: c.contact_name,
      phone: c.phone ?? '',
      email: c.email ?? '',
    }));
  },

  // ── Companies ──────────────────────────────────────────────────────────────

  loadCompanies: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await directoryService.loadCompanies(projectId);
    if (error) {
      set({ error: error.userMessage, loading: false });
    } else {
      set({ companies: data ?? [], loading: false });
    }
  },

  createCompany: async (input) => {
    const { data, error } = await directoryService.createCompany(input);
    if (error) return { error: error.userMessage };
    if (data) {
      set((s) => ({ companies: [...s.companies, data] }));
    }
    return { error: null };
  },

  transitionCompanyStatus: async (companyId, newStatus) => {
    const snapshot = get().companies;
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId ? { ...c, status: newStatus } : c,
      ),
    }));

    const { error } = await directoryService.transitionCompanyStatus(companyId, newStatus);
    if (error) {
      set({ companies: snapshot, error: error.userMessage });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  updateCompany: async (companyId, updates) => {
    const snapshot = get().companies;
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId ? { ...c, ...updates } : c,
      ),
    }));

    const { error } = await directoryService.updateCompany(companyId, updates);
    if (error) {
      set({ companies: snapshot, error: error.userMessage });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  deleteCompany: async (companyId) => {
    const snapshot = get().companies;
    set((s) => ({ companies: s.companies.filter((c) => c.id !== companyId) }));

    const { error } = await directoryService.deleteCompany(companyId);
    if (error) {
      set({ companies: snapshot, error: error.userMessage });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  // ── Contacts ───────────────────────────────────────────────────────────────

  loadContacts: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await directoryService.loadContacts(projectId);
    if (error) {
      set({ error: error.userMessage, loading: false });
    } else {
      set({ contacts: data ?? [], loading: false });
    }
  },

  createContact: async (input) => {
    const { data, error } = await directoryService.createContact(input);
    if (error) return { error: error.userMessage, contact: null };
    if (data) {
      set((s) => ({ contacts: [...s.contacts, data] }));
    }
    return { error: null, contact: data };
  },

  updateContact: async (contactId, updates) => {
    const snapshot = get().contacts;
    set((s) => ({
      contacts: s.contacts.map((c) =>
        c.id === contactId ? { ...c, ...updates } : c,
      ),
    }));

    const { error } = await directoryService.updateContact(contactId, updates);
    if (error) {
      set({ contacts: snapshot, error: error.userMessage });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  deleteContact: async (contactId) => {
    const snapshot = get().contacts;
    set((s) => ({ contacts: s.contacts.filter((c) => c.id !== contactId) }));

    const { error } = await directoryService.deleteContact(contactId);
    if (error) {
      set({ contacts: snapshot, error: error.userMessage });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  // ── Utilities ──────────────────────────────────────────────────────────────

  search: (query) => {
    const q = query.toLowerCase();
    return get().contacts.filter(
      (c) =>
        c.contact_name.toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.role ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.trade ?? '').toLowerCase().includes(q),
    );
  },

  clearError: () => set({ error: null }),
}));
