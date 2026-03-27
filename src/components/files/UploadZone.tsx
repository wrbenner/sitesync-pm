import React, { useState, useCallback } from 'react';
import { Upload, File, CheckCircle, Sparkles } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface UploadZoneProps {
  onUpload: (fileName: string) => void;
}

interface UploadItem {
  id: number;
  name: string;
  progress: number;
  status: 'uploading' | 'categorizing' | 'done';
  aiCategory?: string;
}

const aiCategories = ['Structural Drawings', 'MEP Specifications', 'Safety Documentation', 'Budget Reports', 'Meeting Minutes', 'Shop Drawings'];

export const UploadZone: React.FC<UploadZoneProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const simulateUpload = useCallback((fileName: string) => {
    const id = Date.now();
    const item: UploadItem = { id, name: fileName, progress: 0, status: 'uploading' };
    setUploads((prev) => [...prev, item]);

    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 8 + Math.random() * 12;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploads((prev) => prev.map((u) => u.id === id ? { ...u, progress: 100, status: 'categorizing' } : u));
        // AI categorization
        setTimeout(() => {
          const cat = aiCategories[Math.floor(Math.random() * aiCategories.length)];
          setUploads((prev) => prev.map((u) => u.id === id ? { ...u, status: 'done', aiCategory: cat } : u));
          onUpload(fileName);
        }, 800);
      } else {
        setUploads((prev) => prev.map((u) => u.id === id ? { ...u, progress } : u));
      }
    }, 150);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const names = ['Floor_8_Structural_Rev_C.pdf', 'MEP_Specs_Update.pdf', 'Safety_Report_March.pdf'];
    simulateUpload(names[Math.floor(Math.random() * names.length)]);
  }, [simulateUpload]);

  const handleClick = () => {
    simulateUpload('Site_Photo_Batch_' + new Date().toISOString().slice(0, 10) + '.zip');
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          border: `2px dashed ${isDragging ? colors.primaryOrange : colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          padding: `${spacing['8']} ${spacing['4']}`,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? colors.orangeSubtle : 'transparent',
          transition: `all ${transitions.instant}`,
        }}
      >
        <Upload size={32} color={isDragging ? colors.primaryOrange : colors.textTertiary} style={{ marginBottom: spacing['3'] }} />
        <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: isDragging ? colors.primaryOrange : colors.textPrimary, margin: 0, marginBottom: spacing['1'] }}>
          {isDragging ? 'Drop files here' : 'Drag and drop files or click to upload'}
        </p>
        <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
          PDF, DWG, XLS, DOC, images up to 100MB
        </p>
      </div>

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div style={{ marginTop: spacing['3'], display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {uploads.map((upload) => (
            <div key={upload.id} style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: `${spacing['2']} ${spacing['3']}`,
              backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
            }}>
              <File size={16} color={upload.status === 'done' ? colors.statusActive : colors.textTertiary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{upload.name}</p>
                {upload.status === 'uploading' && (
                  <div style={{ marginTop: spacing['1'], height: 3, backgroundColor: colors.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: colors.primaryOrange, borderRadius: 2, width: `${upload.progress}%`, transition: 'width 150ms ease-out' }} />
                  </div>
                )}
                {upload.status === 'categorizing' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                    <Sparkles size={10} color={colors.statusReview} style={{ animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>AI categorizing...</span>
                  </div>
                )}
                {upload.status === 'done' && upload.aiCategory && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginTop: 2 }}>
                    <Sparkles size={10} color={colors.statusReview} />
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>{upload.aiCategory}</span>
                  </div>
                )}
              </div>
              {upload.status === 'done' && <CheckCircle size={16} color={colors.statusActive} />}
              {upload.status === 'uploading' && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{Math.round(upload.progress)}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
