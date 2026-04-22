// TODO: Migrate to entityStore — see src/stores/entityStore.ts
import { create } from 'zustand';
import { supabase, fromTable } from '../lib/supabase';

export interface LocalFile {
  id: string;
  project_id: string;
  name: string;
  file_type: string;
  size: number;
  storage_path: string;
  uploaded_by: string;
  folder_path: string;
  created_at: string;
  // Local only: for previewing uploaded files before Supabase
  localUrl?: string;
}

export interface LocalDrawing {
  id: string;
  project_id: string;
  set_number: string;
  title: string;
  discipline: string;
  current_revision: string;
  created_at: string;
  updated_at: string;
  sheets?: LocalDrawingSheet[];
}

export interface LocalDrawingSheet {
  id: string;
  drawing_id: string;
  sheet_number: string;
  title: string;
  file_id: string | null;
  revision: string;
  uploaded_at: string;
  // Local only
  localUrl?: string;
}

interface FileState {
  files: LocalFile[];
  drawings: LocalDrawing[];
  loading: boolean;
  error: string | null;

  loadFiles: (projectId: string) => Promise<void>;
  uploadFile: (projectId: string, userId: string, file: File, folderPath?: string) => Promise<{ error: string | null; record: LocalFile | null }>;
  deleteFile: (fileId: string) => Promise<{ error: string | null }>;
  loadDrawings: (projectId: string) => Promise<void>;
  uploadDrawingSet: (projectId: string, userId: string, setNumber: string, title: string, discipline: string, files: File[]) => Promise<{ error: string | null }>;
}

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
};

export { formatFileSize };

export const useFileStore = create<FileState>()((set, get) => ({
  files: [],
  drawings: [],
  loading: false,
  error: null,

  loadFiles: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ files: (data ?? []) as LocalFile[], loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  uploadFile: async (projectId, userId, file, folderPath = '/Documents') => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown';

    // Upload to Supabase storage
    const storagePath = `${projectId}/${folderPath}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, file);

    if (uploadError) return { error: uploadError.message, record: null };

    // Create file record in database
    const { data, error: dbError } = await fromTable('files')
      .insert({
        project_id: projectId,
        name: file.name,
        file_type: ext,
        size: file.size,
        storage_path: storagePath,
        uploaded_by: userId,
        folder_path: folderPath,
      })
      .select()
      .single();

    if (dbError) return { error: dbError.message, record: null };

    const record = data as LocalFile;
    set((s) => ({ files: [record, ...s.files] }));
    return { error: null, record };
  },

  deleteFile: async (fileId) => {
    // Get the file to find storage path
    const file = get().files.find((f) => f.id === fileId);
    if (file) {
      await supabase.storage.from('project-files').remove([file.storage_path]);
    }

    const { error } = await supabase.from('files').delete().eq('id', fileId);
    if (!error) {
      set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
    }
    return { error: error?.message ?? null };
  },

  loadDrawings: async (projectId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('project_id', projectId)
        .order('sheet_number');

      if (error) throw error;

      const drawings = (data ?? []) as LocalDrawing[];

      // Batch-load sheets for all drawings in one query (avoid N+1)
      if (drawings.length > 0) {
        const drawingIds = drawings.map((d) => d.id);
        const { data: allSheets } = await supabase
          .from('drawing_sheets')
          .select('*')
          .in('drawing_id', drawingIds)
          .order('sheet_number');

        const sheetsByDrawing = new Map<string, LocalDrawingSheet[]>();
        for (const sheet of (allSheets ?? []) as LocalDrawingSheet[]) {
          const list = sheetsByDrawing.get(sheet.drawing_id) ?? [];
          list.push(sheet);
          sheetsByDrawing.set(sheet.drawing_id, list);
        }
        for (const drawing of drawings) {
          drawing.sheets = sheetsByDrawing.get(drawing.id) ?? [];
        }
      }

      set({ drawings, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  uploadDrawingSet: async (projectId, userId, setNumber, title, discipline, files) => {
    // Create drawing record
    const { data: dwgData, error: dwgError } = await fromTable('drawings')
      .insert({
        project_id: projectId,
        sheet_number: setNumber,
        title,
        discipline,
        current_revision: 'A',
      })
      .select()
      .single();

    if (dwgError) return { error: dwgError.message };

    const drawing = dwgData as LocalDrawing;
    drawing.sheets = [];

    // Upload each file as a sheet
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const storagePath = `${projectId}/drawings/${setNumber}/${Date.now()}_${file.name}`;

      const { error: uploadErr } = await supabase.storage.from('project-files').upload(storagePath, file);
      if (uploadErr) continue;

      // Create file record
      const { data: fileData } = await fromTable('files')
        .insert({
          project_id: projectId,
          name: file.name,
          file_type: file.name.split('.').pop() || 'pdf',
          size: file.size,
          storage_path: storagePath,
          uploaded_by: userId,
          folder_path: `/Drawings/${setNumber}`,
        })
        .select()
        .single();

      // Create sheet record
      const { data: sheetData } = await fromTable('drawing_sheets')
        .insert({
          drawing_id: drawing.id,
          sheet_number: `${setNumber}-${i + 1}`,
          title: file.name.replace(/\.[^.]+$/, ''),
          file_id: fileData?.id ?? null,
          revision: 'A',
        })
        .select()
        .single();

      if (sheetData) drawing.sheets!.push(sheetData as LocalDrawingSheet);
    }

    set((s) => ({ drawings: [drawing, ...s.drawings] }));
    return { error: null };
  },
}));
