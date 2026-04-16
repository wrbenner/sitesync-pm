import React from 'react';
import { UploadZone } from '../../components/files/UploadZone';

interface FileUploadProps {
  onUpload: (fileName: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => (
  <UploadZone onUpload={onUpload} />
);
