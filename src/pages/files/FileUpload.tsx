import React from 'react';
import { UploadZone } from '../../components/files/UploadZone';

interface FileUploadProps {
  onUpload: (fileName: string) => void;
  onFileReady?: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload, onFileReady }) => (
  <UploadZone onUpload={onUpload} onFileReady={onFileReady} />
);
