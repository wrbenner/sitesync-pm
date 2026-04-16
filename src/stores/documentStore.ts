import { create } from 'zustand';
import { documentService } from '../services/documentService';
import type { ServiceError } from '../services/errors';
import type { Document, CreateDocumentInput } from '../services/documentService';
import type { DocumentStatus } from '../machines/documentMachine';

interface DocumentState {
  documents: Document[];
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;

  loadDocuments: (projectId: string) => Promise<void>;
  createDocument: (input: CreateDocumentInput) => Promise<{ error: string | null; document: Document | null }>;
  updateDocument: (documentId: string, updates: Partial<Document>) => Promise<{ error: string | null }>;
  transitionStatus: (documentId: string, status: DocumentStatus) => Promise<{ error: string | null }>;
  deleteDocument: (documentId: string) => Promise<{ error: string | null }>;
  moveToFolder: (documentId: string, folder: string | null) => Promise<{ error: string | null }>;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>()((set) => ({
  documents: [],
  loading: false,
  error: null,
  errorDetails: null,

  loadDocuments: async (projectId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await documentService.loadDocuments(projectId);
    if (error) {
      // Preserve existing documents so UI stays populated on transient errors
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ documents: data ?? [], loading: false });
    }
  },

  createDocument: async (input) => {
    const { data, error } = await documentService.createDocument(input);
    if (error) return { error: error.userMessage, document: null };
    if (data) {
      set((s) => ({ documents: [data, ...s.documents] }));
    }
    return { error: null, document: data };
  },

  updateDocument: async (documentId, updates) => {
    const { error } = await documentService.updateDocument(documentId, updates);
    if (error) return { error: error.userMessage };
    set((s) => ({
      documents: s.documents.map((d) => (d.id === documentId ? { ...d, ...updates } : d)),
    }));
    return { error: null };
  },

  transitionStatus: async (documentId, status) => {
    const { error } = await documentService.transitionStatus(documentId, status);
    if (error) return { error: error.userMessage };
    set((s) => ({
      documents: s.documents.map((d) => (d.id === documentId ? { ...d, status } : d)),
    }));
    return { error: null };
  },

  deleteDocument: async (documentId) => {
    const { error } = await documentService.deleteDocument(documentId);
    if (error) return { error: error.userMessage };
    // Remove from local state since it's now soft-deleted and filtered by deleted_at IS NULL
    set((s) => ({ documents: s.documents.filter((d) => d.id !== documentId) }));
    return { error: null };
  },

  moveToFolder: async (documentId, folder) => {
    const { error } = await documentService.moveToFolder(documentId, folder);
    if (error) return { error: error.userMessage };
    set((s) => ({
      documents: s.documents.map((d) => (d.id === documentId ? { ...d, folder } : d)),
    }));
    return { error: null };
  },

  clearError: () => {
    // Don't call get() to avoid unused variable warning
    set({ error: null, errorDetails: null });
  },
}));
