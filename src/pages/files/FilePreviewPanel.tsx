import React from 'react';
import { FilePreview } from '../../components/files/FilePreview';
import type { FileItem } from './fileTypes';

interface FilePreviewPanelProps {
  file: FileItem | null;
  onClose: () => void;
}

export const FilePreviewPanel: React.FC<FilePreviewPanelProps> = ({ file, onClose }) => (
  <FilePreview file={file} onClose={onClose} />
);
