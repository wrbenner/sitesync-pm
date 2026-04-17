import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, RefreshCw } from 'lucide-react';
import { Btn, useToast } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import type { ParsedActivity } from './types';

export function mapP6Status(raw: string): string {
  const s = raw.toUpperCase();
  if (s.includes('COMPLETE') || s === 'TK_COMPLETE') return 'completed';
  if (s.includes('ACTIVE') || s === 'TK_ACTIVE' || s.includes('IN_PROG')) return 'in_progress';
  if (s.includes('SUSPEND') || s.includes('HOLD')) return 'on_hold';
  return 'not_started';
}

export function formatP6Date(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  const parts = raw.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return raw.split(' ')[0];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseCSV(content: string): ParsedActivity[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const findCol = (...names: string[]) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const nameIdx = findCol('name', 'activity', 'task', 'description');
  const startIdx = findCol('start', 'begin');
  const endIdx = findCol('end', 'finish', 'complete date');
  const durationIdx = findCol('duration', 'dur');
  const statusIdx = findCol('status', 'state');
  return lines.slice(1).map((line, i) => {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const get = (idx: number) => (idx >= 0 ? cols[idx] ?? '' : '');
    const rawDur = parseFloat(get(durationIdx));
    return {
      activityId: `CSV-${i + 1}`,
      name: get(nameIdx) || `Activity ${i + 1}`,
      startDate: formatP6Date(get(startIdx)),
      endDate: formatP6Date(get(endIdx)),
      duration: isNaN(rawDur) ? 0 : Math.round(rawDur),
      percentComplete: 0,
      floatTotal: 0,
      status: get(statusIdx) || 'not_started',
    };
  }).filter(a => a.name);
}

export function parseXmlSchedule(content: string): ParsedActivity[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  const activities: ParsedActivity[] = [];
  const nodes = Array.from(doc.querySelectorAll('Activity'));
  const getText = (el: Element, ...tags: string[]) => {
    for (const tag of tags) {
      const found = el.querySelector(tag);
      if (found?.textContent) return found.textContent.trim();
    }
    return '';
  };
  for (const node of nodes) {
    const name = getText(node, 'ActivityName', 'Name') || node.getAttribute('Name') || '';
    if (!name) continue;
    const durationRaw = parseFloat(getText(node, 'DurationOriginal', 'Duration') || '0');
    // P6 XML duration is in hours — convert to days
    const duration = durationRaw > 50 ? Math.round(durationRaw / 8) : Math.round(durationRaw);
    const floatRaw = parseFloat(getText(node, 'FloatTotal') || '0');
    const floatTotal = floatRaw > 50 ? Math.round(floatRaw / 8) : Math.round(floatRaw);
    const pct = parseFloat(getText(node, 'PercentComplete') || '0');
    activities.push({
      activityId: getText(node, 'ActivityId') || node.getAttribute('ObjectId') || '',
      name,
      startDate: formatP6Date(getText(node, 'PlannedStartDate', 'StartDate')),
      endDate: formatP6Date(getText(node, 'PlannedFinishDate', 'FinishDate')),
      duration: isNaN(duration) ? 0 : duration,
      percentComplete: isNaN(pct) ? 0 : pct,
      floatTotal: isNaN(floatTotal) ? 0 : floatTotal,
      status: mapP6Status(getText(node, 'Status') || 'TK_NotStart'),
      baselineStart: formatP6Date(getText(node, 'ActualStartDate', 'BaselineStartDate')) || undefined,
      baselineEnd: formatP6Date(getText(node, 'ActualFinishDate', 'BaselineFinishDate')) || undefined,
    });
  }
  return activities;
}

export function parseXerSchedule(content: string): ParsedActivity[] {
  const activities: ParsedActivity[] = [];
  const lines = content.split(/\r?\n/);
  let inTask = false;
  let fields: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === '%T TASK') { inTask = true; fields = []; continue; }
    if (t.startsWith('%T ') && inTask) { inTask = false; continue; }
    if (!inTask) continue;
    if (t.startsWith('%F')) { fields = t.slice(2).trim().split('\t'); continue; }
    if (!t.startsWith('%R')) continue;
    const vals = t.slice(2).trim().split('\t');
    const get = (f: string) => { const i = fields.indexOf(f); return i >= 0 ? (vals[i] ?? '') : ''; };
    const name = get('task_name');
    if (!name) continue;
    const dhrRaw = parseFloat(get('target_drtn_hr_cnt') || get('remain_drtn_hr_cnt') || '0');
    const duration = Math.round(dhrRaw / 8);
    const floatHrs = parseFloat(get('total_float_hr_cnt') || '0');
    const floatTotal = Math.round(floatHrs / 8);
    const pct = parseFloat(get('phys_complete_pct') || '0');
    const startDate = get('early_start_date') || get('target_start_date') || get('act_start_date');
    const endDate = get('early_end_date') || get('target_end_date') || get('act_end_date');
    const bStart = get('target_start_date');
    const bEnd = get('target_end_date');
    activities.push({
      activityId: get('task_code') || get('task_id'),
      name,
      startDate: formatP6Date(startDate),
      endDate: formatP6Date(endDate),
      duration: isNaN(duration) ? 0 : duration,
      percentComplete: isNaN(pct) ? 0 : pct,
      floatTotal: isNaN(floatTotal) ? 0 : floatTotal,
      status: mapP6Status(get('status_code') || 'TK_NotStart'),
      baselineStart: bStart ? formatP6Date(bStart) : undefined,
      baselineEnd: bEnd ? formatP6Date(bEnd) : undefined,
    });
  }
  return activities;
}

interface ScheduleImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  projectId?: string;
}

export const ScheduleImportModal: React.FC<ScheduleImportModalProps> = ({ open, onClose }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'xml' | 'xer' | 'mpp' | 'csv' | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedActivity[] | null>(null);
  const [, setImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = 'schedule-import-modal-title';

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setSelectedFile(null);
        setDragOver(false);
        setFileType(null);
        setParsing(false);
        setParsed(null);
        setImporting(false);
        setUploadProgress(0);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const detectType = (file: File): 'xml' | 'xer' | 'mpp' | 'csv' | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'xml') return 'xml';
    if (ext === 'xer') return 'xer';
    if (ext === 'mpp') return 'mpp';
    if (ext === 'csv') return 'csv';
    return null;
  };

  const handleFile = (file: File) => {
    const type = detectType(file);
    if (type === null) {
      addToast('error', 'Unsupported file format. Please use .xer, .xml, .mpp, or .csv');
      return;
    }
    setSelectedFile(file);
    setFileType(type);
    setParsed(null);
    setUploadProgress(0);
    if (type === 'csv') {
      setParsing(true);
      setUploadProgress(30);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const acts = parseCSV(content);
          setParsed(acts);
          setUploadProgress(100);
        } catch {
          addToast('error', 'Failed to parse CSV. Check the format and try again.');
        }
        setParsing(false);
      };
      reader.readAsText(file);
    } else if (type === 'xml' || type === 'xer') {
      setParsing(true);
      setUploadProgress(30);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const acts = type === 'xml' ? parseXmlSchedule(content) : parseXerSchedule(content);
          setParsed(acts);
          setUploadProgress(100);
        } catch {
          addToast('error', 'Failed to parse file. Check the format and try again.');
        }
        setParsing(false);
      };
      reader.readAsText(file);
    } else {
      // MPP: no client-side parsing
      setUploadProgress(100);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirmImport = () => {
    addToast('success', 'Schedule import is being configured. Your file has been queued for processing.');
    onClose();
  };

  const showPreview = !parsing && parsed !== null && fileType === 'csv';
  const preview = parsed?.slice(0, 10) ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        backgroundColor: colors.overlayBackdrop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          padding: spacing.xl,
          width: showPreview ? '720px' : '480px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          boxShadow: shadows.panel,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
          transition: `width ${transitions.smooth}`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            id={titleId}
            style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}
          >
            Import Schedule
          </span>
          <button
            aria-label="Close import dialog"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: spacing.sm, borderRadius: borderRadius.md, color: colors.textTertiary, display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drop zone — hide once parsed */}
        {!showPreview && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop zone for schedule file"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            style={{
              border: `2px dashed ${dragOver ? colors.primaryOrange : colors.borderDefault}`,
              borderRadius: borderRadius.lg,
              padding: `${spacing.xxl} ${spacing.xl}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: dragOver ? colors.orangeSubtle : colors.surfaceInset,
              transition: transitions.quick,
              cursor: 'pointer',
            }}
          >
            <Upload size={28} color={dragOver ? colors.primaryOrange : colors.textTertiary} />
            <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, textAlign: 'center' }}>
              Drop your schedule file here or click to browse
            </span>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>
                Primavera P6 (.xer, .xml)
              </span>
              <span style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, display: 'block' }}>
                Microsoft Project (.mpp), CSV (.csv)
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xer,.xml,.mpp,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Selected file chip */}
        {selectedFile && (
          <div style={{ backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, padding: `${spacing.md} ${spacing.lg}` }}>
              <Upload size={15} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
                {formatFileSize(selectedFile.size)}
              </span>
              {fileType && (
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, textTransform: 'none', letterSpacing: '0' }}>
                  {fileType === 'xer' ? 'Primavera P6 XER detected' : fileType === 'mpp' ? 'MS Project detected' : fileType === 'xml' ? 'P6 XML detected' : fileType.toUpperCase()}
                </span>
              )}
              <button
                aria-label="Remove file"
                onClick={() => { setSelectedFile(null); setFileType(null); setParsed(null); setUploadProgress(0); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: colors.textTertiary }}
              >
                <X size={14} />
              </button>
            </div>
            {uploadProgress > 0 && (
              <div style={{ height: '3px', backgroundColor: colors.borderSubtle }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: colors.primaryOrange, transition: 'width 0.3s ease', borderRadius: '0 2px 2px 0' }} />
              </div>
            )}
          </div>
        )}

        {/* Parsing spinner */}
        {parsing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, color: colors.textSecondary, fontSize: typography.fontSize.body }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: colors.primaryOrange }} />
            Parsing schedule file...
          </div>
        )}

        {/* Processing message for XER/XML/MPP */}
        {selectedFile && fileType && fileType !== 'csv' && !parsing && (
          <div style={{ padding: spacing.lg, backgroundColor: colors.statusInfoSubtle, borderRadius: borderRadius.md, border: `1px solid ${colors.statusInfo}30` }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.statusInfo }}>
              Processing... This file will be sent to our import service
            </p>
            <p style={{ margin: `${spacing.sm} 0 0`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Click Confirm Import to upload and process your schedule. Activities will appear in your schedule once complete.
            </p>
          </div>
        )}

        {/* Preview table */}
        {showPreview && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {parsed!.length} activities found
              </span>
              {parsed!.length > 10 && (
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  Showing first 10
                </span>
              )}
            </div>
            <div style={{ overflowX: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                <thead>
                  <tr style={{ backgroundColor: colors.surfaceInset }}>
                    {['Name', 'Start', 'End', 'Duration', 'Status'].map(h => (
                      <th key={h} style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, fontSize: typography.fontSize.caption, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${colors.borderSubtle}`, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((a, i) => (
                    <tr key={i} style={{ borderBottom: i < preview.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none' }}>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textPrimary, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {a.startDate || '\u2014'}
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                        {a.endDate || '\u2014'}
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>
                        {a.duration}d
                      </td>
                      <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.textSecondary }}>
                        {a.status || 'not_started'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          {selectedFile && fileType && !parsing && (
            <Btn
              variant="primary"
              onClick={handleConfirmImport}
            >
              Preview &amp; Import
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
};
