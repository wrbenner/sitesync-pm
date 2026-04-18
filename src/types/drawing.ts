import type { Drawing, TableRow } from './database';

export type DrawingStatus =
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

export type AnnotationType =
  | 'rectangle'
  | 'text'
  | 'polygon'
  | 'pin'
  | 'measure'
  | 'highlight'
  | 'draw';

export type DrawingMarkup = TableRow<'drawing_markups'>;

export type DrawingVersion = Drawing & {
  _versionIndex?: number;
};

export interface CreateDrawingInput {
  project_id: string;
  title: string;
  file_url?: string;
  discipline?: string;
  set_name?: string;
  sheet_number?: string;
  revision?: string;
  received_date?: string;
  previous_revision_id?: string;
  change_description?: string;
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

export interface CreateAnnotationInput {
  drawing_id: string;
  project_id: string;
  annotation_type?: AnnotationType;
  coordinates?: Record<string, unknown>;
  color?: string;
  page_number?: number;
  note?: string;
  layer?: string;
  linked_rfi_id?: string;
  linked_punch_item_id?: string;
}

export interface UpdateAnnotationInput {
  annotation_type?: AnnotationType;
  coordinates?: Record<string, unknown>;
  color?: string;
  page_number?: number;
  note?: string;
  layer?: string;
}

export interface UploadDrawingInput {
  title?: string;
  discipline?: string;
  set_name?: string;
  sheet_number?: string;
  revision?: string;
  received_date?: string;
  previous_revision_id?: string;
  change_description?: string;
}
