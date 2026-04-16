import { colors } from '../../styles/theme';
import React from 'react';
import { FolderOpen, FileText, Image, Table, File as FileIcon } from 'lucide-react';

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size?: string;
  itemCount?: number;
  totalSize?: number;
  lastModified?: string;
  modifiedDate: string;
  parent_id?: string | null;
  parent_folder_id?: string | null;
  content_type?: string | null;
}

export const fileGradients: Record<string, string> = {
  pdf: `linear-gradient(135deg, ${colors.statusInfo} 0%, ${colors.statusReview} 100%)`,
  xlsx: `linear-gradient(135deg, ${colors.statusActive} 0%, ${colors.chartCyan} 100%)`,
  dwg: `linear-gradient(135deg, ${colors.primaryOrange} 0%, ${colors.orangeGradientEnd} 100%)`,
  zip: `linear-gradient(135deg, ${colors.gray600} 0%, ${colors.textTertiary} 100%)`,
  default: `linear-gradient(135deg, ${colors.statusInfo} 0%, ${colors.statusReview} 100%)`,
  folder: `linear-gradient(135deg, rgba(244, 120, 32, 0.12) 0%, rgba(244, 120, 32, 0.04) 100%)`,
};

export function getGradient(file: FileItem): string {
  if (file.type === 'folder') return fileGradients.folder;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return fileGradients[ext] || fileGradients.default;
}

export function getApprovalStatus(file: FileItem): { label: string; color: string } | null {
  if (file.type === 'folder') return null;
  if (file.name.includes('Structural') || file.name.includes('Calculations')) return { label: 'Approved', color: colors.statusActive };
  if (file.name.includes('MEP') || file.name.includes('Spec')) return { label: 'Pending Review', color: colors.statusPending };
  return { label: 'Draft', color: colors.textTertiary };
}

export function getFileTypeIcon(file: FileItem, size = 16): React.ReactElement {
  if (file.type === 'folder') return React.createElement(FolderOpen, { size, color: colors.primaryOrange });
  const ct = (file.content_type ?? '').toLowerCase();
  if (ct.includes('pdf')) return React.createElement(FileText, { size, color: '#DC2626' });
  if (ct.includes('image')) return React.createElement(Image, { size, color: colors.statusInfo });
  if (ct.includes('spreadsheet') || ct.includes('excel') || ct.includes('csv')) return React.createElement(Table, { size, color: colors.statusActive });
  return React.createElement(FileIcon, { size, color: colors.textTertiary });
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
