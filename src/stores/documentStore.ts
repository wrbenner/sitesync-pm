import { create } from 'zustand';
import { documentService } from '../services/documentService';
import type { DocumentRecord, CreateDocumentInput, UploadDocumentInput, UploadProgress } from '../services/documentService';
import type { DocumentStatus } from '../machines/documentMachine';
import type { ServiceError } from '../services/errors';

interface DocumentState {
  documents: DocumentRecord[];
  loading: boolean;
  error: string | null;
  errorDetails: ServiceError | null;
  uploadProgress: Record<string, UploadProgress>;

  loadDocuments: (projectId: string) => Promise<void>;
  createDocument: (
    input: CreateDocumentInput,
  ) => Promise<{ error: string | null; document: DocumentRecord | null }>;
  uploadDocument: (
    input: UploadDocumentInput,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<{ error: string | null; document: DocumentRecord | null }>;
  uploadVersion: (
    parentDocumentId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<{ error: string | null; document: DocumentRecord | null }>;
  transitionStatus: (
    documentId: string,
    newStatus: DocumentStatus,
  ) => Promise<{ error: string | null }>;
  updateDocument: (
    documentId: string,
    updates: Partial<DocumentRecord>,
  ) => Promise<{ error: string | null }>;
  deleteDocument: (documentId: string) => Promise<{ error: string | null }>;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  documents: [],
  loading: false,
  error: null,
  errorDetails: null,
  uploadProgress: {},

  loadDocuments: async (projectId) => {
    set({ loading: true, error: null, errorDetails: null });
    const { data, error } = await documentService.loadDocuments(projectId);
    if (error) {
      set({ error: error.userMessage, errorDetails: error, loading: false });
    } else {
      set({ documents: data ?? [], loading: false });
    }
  },

  createDocument: async (input) => {
    const { data, error } = await documentService.createDocument(input);
    if (error) {
      set({ error: error.userMessage, errorDetails: error });
      return { error: error.userMessage, document: null };
    }
    if (data) {
      set((s) => ({ documents: [data, ...s.documents] }));
    }
    return { error: null, document: data };
  },

  uploadDocument: async (input, file, onProgress) => {
    const tempId = `uploading-${Date.now()}`;
    set((s) => ({
      uploadProgress: { ...s.uploadProgress, [tempId]: { loaded: 0, total: file.size, percent: 0 } },
    }));

    const { data, error } = await documentService.uploadDocument(input, file, (progress) => {
      set((s) => ({ uploadProgress: { ...s.uploadProgress, [tempId]: progress } }));
      onProgress?.(progress);
    });

    set((s) => {
      const next = { ...s.uploadProgress };
      delete next[tempId];
      return { uploadProgress: next };
    });

    if (error) {
      set({ error: error.userMessage, errorDetails: error });
      return { error: error.userMessage, document: null };
    }
    if (data) {
      set((s) => ({ documents: [data, ...s.documents] }));
    }
    return { error: null, document: data };
  },

  uploadVersion: async (parentDocumentId, file, onProgress) => {
    const tempId = `version-${parentDocumentId}-${Date.now()}`;
    set((s) => ({
      uploadProgress: { ...s.uploadProgress, [tempId]: { loaded: 0, total: file.size, percent: 0 } },
    }));

    const { data, error } = await documentService.uploadVersion(parentDocumentId, file, (progress) => {
      set((s) => ({ uploadProgress: { ...s.uploadProgress, [tempId]: progress } }));
      onProgress?.(progress);
    });

    set((s) => {
      const next = { ...s.uploadProgress };
      delete next[tempId];
      return { uploadProgress: next };
    });

    if (error) {
      set({ error: error.userMessage, errorDetails: error });
      return { error: error.userMessage, document: null };
    }
    if (data) {
      set((s) => ({ documents: [data, ...s.documents] }));
    }
    return { error: null, document: data };
  },

  transitionStatus: async (documentId, newStatus) => {
    const prev = get().documents;
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === documentId ? { ...d, document_status: newStatus } : d,
      ),
    }));
    const { error } = await documentService.transitionStatus(documentId, newStatus);
    if (error) {
      set({ documents: prev, error: error.userMessage, errorDetails: error });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  updateDocument: async (documentId, updates) => {
    const prev = get().documents;
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === documentId ? { ...d, ...updates } : d,
      ),
    }));
    const { error } = await documentService.updateDocument(documentId, updates);
    if (error) {
      set({ documents: prev, error: error.userMessage, errorDetails: error });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  deleteDocument: async (documentId) => {
    const prev = get().documents;
    set((s) => ({ documents: s.documents.filter((d) => d.id !== documentId) }));

    const { error } = await documentService.deleteDocument(documentId);
    if (error) {
      set({ documents: prev, error: error.userMessage, errorDetails: error });
      return { error: error.userMessage };
    }
    return { error: null };
  },

  clearError: () => set({ error: null, errorDetails: null }),
}));
