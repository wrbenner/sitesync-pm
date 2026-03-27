import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

const MOCK_FILES: LocalFile[] = [
  { id: 'file-1', project_id: 'project-1', name: 'Structural Calculations.pdf', file_type: 'pdf', size: 4500000, storage_path: '/documents/structural-calcs.pdf', uploaded_by: 'user-1', folder_path: '/Documents/Structural', created_at: '2025-03-15T10:00:00Z' },
  { id: 'file-2', project_id: 'project-1', name: 'MEP Coordination Drawings.dwg', file_type: 'dwg', size: 12800000, storage_path: '/documents/mep-coord.dwg', uploaded_by: 'user-2', folder_path: '/Drawings/MEP', created_at: '2025-03-18T14:00:00Z' },
  { id: 'file-3', project_id: 'project-1', name: 'Project Schedule.xlsx', file_type: 'xlsx', size: 850000, storage_path: '/documents/schedule.xlsx', uploaded_by: 'user-1', folder_path: '/Documents/Schedule', created_at: '2025-03-20T09:00:00Z' },
  { id: 'file-4', project_id: 'project-1', name: 'Safety Plan.pdf', file_type: 'pdf', size: 2200000, storage_path: '/documents/safety-plan.pdf', uploaded_by: 'user-3', folder_path: '/Documents/Safety', created_at: '2025-03-10T08:00:00Z' },
  { id: 'file-5', project_id: 'project-1', name: 'Budget Summary.xlsx', file_type: 'xlsx', size: 1500000, storage_path: '/documents/budget-summary.xlsx', uploaded_by: 'user-1', folder_path: '/Documents/Budget', created_at: '2025-03-22T11:00:00Z' },
  { id: 'file-6', project_id: 'project-1', name: 'Spec Section 05 12 00.pdf', file_type: 'pdf', size: 3100000, storage_path: '/documents/spec-051200.pdf', uploaded_by: 'user-2', folder_path: '/Documents/Specs', created_at: '2025-03-12T13:00:00Z' },
  { id: 'file-7', project_id: 'project-1', name: 'Fire Protection Submittal.pdf', file_type: 'pdf', size: 5600000, storage_path: '/documents/fire-prot-sub.pdf', uploaded_by: 'user-3', folder_path: '/Documents/Submittals', created_at: '2025-03-16T10:00:00Z' },
  { id: 'file-8', project_id: 'project-1', name: 'Site Photos 2025-03-21.zip', file_type: 'zip', size: 45000000, storage_path: '/documents/site-photos.zip', uploaded_by: 'user-1', folder_path: '/Photos', created_at: '2025-03-21T16:00:00Z' },
];

const MOCK_DRAWINGS: LocalDrawing[] = [
  {
    id: 'dwg-1', project_id: 'project-1', set_number: 'A-001', title: 'Floor Plans Levels 7 through 12',
    discipline: 'Architectural', current_revision: 'C', created_at: '2025-03-20T09:00:00Z', updated_at: '2025-03-20T09:00:00Z',
    sheets: [
      { id: 'sht-1', drawing_id: 'dwg-1', sheet_number: 'A-001-1', title: 'Level 7 Floor Plan', file_id: null, revision: 'C', uploaded_at: '2025-03-20T09:00:00Z' },
      { id: 'sht-2', drawing_id: 'dwg-1', sheet_number: 'A-001-2', title: 'Level 8 Floor Plan', file_id: null, revision: 'C', uploaded_at: '2025-03-20T09:00:00Z' },
    ],
  },
  {
    id: 'dwg-2', project_id: 'project-1', set_number: 'S-001', title: 'Structural Framing Plans',
    discipline: 'Structural', current_revision: 'B', created_at: '2025-03-15T09:00:00Z', updated_at: '2025-03-19T09:00:00Z',
    sheets: [
      { id: 'sht-3', drawing_id: 'dwg-2', sheet_number: 'S-001-1', title: 'Foundation Plan', file_id: null, revision: 'B', uploaded_at: '2025-03-15T09:00:00Z' },
    ],
  },
  {
    id: 'dwg-3', project_id: 'project-1', set_number: 'M-001', title: 'Mechanical System Layout',
    discipline: 'Mechanical', current_revision: 'A', created_at: '2025-03-18T09:00:00Z', updated_at: '2025-03-18T09:00:00Z',
    sheets: [],
  },
  {
    id: 'dwg-4', project_id: 'project-1', set_number: 'E-001', title: 'Electrical Power Plan',
    discipline: 'Electrical', current_revision: 'B', created_at: '2025-03-14T09:00:00Z', updated_at: '2025-03-21T09:00:00Z',
    sheets: [],
  },
  {
    id: 'dwg-5', project_id: 'project-1', set_number: 'P-001', title: 'Plumbing Riser Diagram',
    discipline: 'Plumbing', current_revision: 'A', created_at: '2025-03-17T09:00:00Z', updated_at: '2025-03-17T09:00:00Z',
    sheets: [],
  },
  {
    id: 'dwg-6', project_id: 'project-1', set_number: 'FP-001', title: 'Fire Protection System Layout',
    discipline: 'Fire Protection', current_revision: 'B', created_at: '2025-03-14T09:00:00Z', updated_at: '2025-03-14T09:00:00Z',
    sheets: [],
  },
];

let fileCounter = 8;

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
    if (!isSupabaseConfigured) {
      set({ files: MOCK_FILES.filter((f) => f.project_id === projectId), loading: false });
      return;
    }

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

    if (!isSupabaseConfigured) {
      fileCounter++;
      const localUrl = URL.createObjectURL(file);
      const newFile: LocalFile = {
        id: `file-${Date.now()}`,
        project_id: projectId,
        name: file.name,
        file_type: ext,
        size: file.size,
        storage_path: `/documents/${file.name}`,
        uploaded_by: userId,
        folder_path: folderPath,
        created_at: new Date().toISOString(),
        localUrl,
      };
      set((s) => ({ files: [newFile, ...s.files] }));
      return { error: null, record: newFile };
    }

    // Upload to Supabase storage
    const storagePath = `${projectId}/${folderPath}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file);

    if (uploadError) return { error: uploadError.message, record: null };

    // Create file record in database
    const { data, error: dbError } = await (supabase.from('files') as any)
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
    if (!isSupabaseConfigured) {
      set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
      return { error: null };
    }

    // Get the file to find storage path
    const file = get().files.find((f) => f.id === fileId);
    if (file) {
      await supabase.storage.from('documents').remove([file.storage_path]);
    }

    const { error } = await supabase.from('files').delete().eq('id', fileId);
    if (!error) {
      set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
    }
    return { error: error?.message ?? null };
  },

  loadDrawings: async (projectId) => {
    if (!isSupabaseConfigured) {
      set({ drawings: MOCK_DRAWINGS.filter((d) => d.project_id === projectId), loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('project_id', projectId)
        .order('set_number');

      if (error) throw error;

      const drawings = (data ?? []) as LocalDrawing[];

      // Load sheets for each drawing
      for (const drawing of drawings) {
        const { data: sheets } = await supabase
          .from('drawing_sheets')
          .select('*')
          .eq('drawing_id', drawing.id)
          .order('sheet_number');

        drawing.sheets = (sheets ?? []) as LocalDrawingSheet[];
      }

      set({ drawings, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  uploadDrawingSet: async (projectId, userId, setNumber, title, discipline, files) => {
    if (!isSupabaseConfigured) {
      const newDrawing: LocalDrawing = {
        id: `dwg-${Date.now()}`,
        project_id: projectId,
        set_number: setNumber,
        title,
        discipline,
        current_revision: 'A',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sheets: files.map((f, i) => ({
          id: `sht-${Date.now()}-${i}`,
          drawing_id: `dwg-${Date.now()}`,
          sheet_number: `${setNumber}-${i + 1}`,
          title: f.name.replace(/\.[^.]+$/, ''),
          file_id: null,
          revision: 'A',
          uploaded_at: new Date().toISOString(),
          localUrl: URL.createObjectURL(f),
        })),
      };
      set((s) => ({ drawings: [newDrawing, ...s.drawings] }));
      return { error: null };
    }

    // Create drawing record
    const { data: dwgData, error: dwgError } = await (supabase.from('drawings') as any)
      .insert({
        project_id: projectId,
        set_number: setNumber,
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

      const { error: uploadErr } = await supabase.storage.from('drawings').upload(storagePath, file);
      if (uploadErr) continue;

      // Create file record
      const { data: fileData } = await (supabase.from('files') as any)
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
      const { data: sheetData } = await (supabase.from('drawing_sheets') as any)
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
