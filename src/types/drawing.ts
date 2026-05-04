import type { TableRow } from './database';

export type DrawingStatus =
  | 'current'
  | 'superseded'
  | 'void'
  | 'for_review'
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'archived';

export type MarkupType =
  | 'pen'
  | 'highlighter'
  | 'text'
  | 'shape'
  | 'pin'
  | 'measure';

export type DrawingMarkup = TableRow<'drawing_markups'>;

export interface CreateDrawingInput {
  project_id: string;
  title: string;
  file_url?: string;
  discipline?: string | null;
  set_name?: string;
  sheet_number?: string;
  revision?: string;
  received_date?: string;
  previous_revision_id?: string;
  change_description?: string;
  // Pipeline fields (added for PDF page splitting workflow)
  thumbnail_url?: string;
  total_pages?: number;
  source_filename?: string;
  file_size_bytes?: number;
  processing_status?: string;
}

export interface CreateMarkupInput {
  drawing_id: string;
  project_id: string;
  type?: MarkupType;
  data: Record<string, unknown>;
  layer?: string;
  note?: string;
  linked_rfi_id?: string;
  linked_punch_item_id?: string;
}
