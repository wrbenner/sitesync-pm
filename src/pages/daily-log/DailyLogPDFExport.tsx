import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { DailyLogPDF } from '../../components/export/DailyLogPDF';
import type { DailyLogPDFData } from '../../components/export/DailyLogPDF';
import { formatWeatherSummary } from '../../lib/weather';
import type { WeatherData } from '../../lib/weather';
import type { ExtendedDailyLog } from './types';
import type { DailyLogState } from '../../machines/dailyLogMachine';
import { useProjectId } from '../../hooks/useProjectId';
import { useProject } from '../../hooks/queries';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  transitions,
  touchTarget,
} from '../../styles/theme';

interface DailyLogPDFExportProps {
  today: ExtendedDailyLog;
  weather: WeatherData | null;
  logStatus: DailyLogState;
}

function buildPdfData(
  today: ExtendedDailyLog,
  weather: WeatherData | null,
  logStatus: DailyLogState,
  projectName: string,
): DailyLogPDFData {
  const isSubmittedOrApproved =
    today.status === 'submitted' || today.status === 'approved';

  return {
    projectName,
    logDate: today.log_date,
    workers_onsite: today.workers_onsite ?? 0,
    total_hours: today.total_hours ?? 0,
    incidents: today.incidents ?? 0,
    weather: today.weather ?? (weather ? formatWeatherSummary(weather) : 'N/A'),
    temperature_high: today.temperature_high ?? undefined,
    temperature_low: today.temperature_low ?? undefined,
    wind_speed: today.wind_speed ?? undefined,
    precipitation: today.precipitation ?? undefined,
    is_submitted: isSubmittedOrApproved,
    submitted_at: isSubmittedOrApproved ? (today.updated_at ?? null) : null,
    status: logStatus,
    crew_entries: (today.crew_entries ?? []).map((e) => ({
      company: e.company ?? '',
      trade: e.trade ?? '',
      headcount: e.headcount ?? 0,
      hours: e.hours ?? 0,
    })),
    equipment_entries: today.equipment_entries ?? [],
    material_deliveries: today.material_deliveries ?? [],
    workPerformed: today.summary ?? '',
    safety_observations: today.safety_observations ?? '',
    toolbox_talk_topic: today.toolbox_talk_topic ?? '',
    visitors: today.visitors ?? [],
    incident_details: today.incident_details ?? [],
    superintendent_signature_url: today.superintendent_signature_url,
    manager_signature_url: today.manager_signature_url,
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const DailyLogPDFExport: React.FC<DailyLogPDFExportProps> = ({
  today,
  weather,
  logStatus,
}) => {
  const projectId = useProjectId();
  const { data: project } = useProject(projectId);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = useCallback(async () => {
    if (isGenerating) return;

    const projectName =
      (project as { name?: string } | undefined)?.name || 'Project';
    const pdfData = buildPdfData(today, weather, logStatus, projectName);

    setIsGenerating(true);
    const toastId = toast.loading('Generating daily log PDF…');
    try {
      const blob = await pdf(<DailyLogPDF data={pdfData} />).toBlob();
      const dateStr = today.log_date || new Date().toISOString().slice(0, 10);
      const projectSlug = projectName.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Project';
      triggerDownload(blob, `Daily_Log_${projectSlug}_${dateStr}.pdf`);
      toast.success('Daily log PDF downloaded', { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`PDF export failed: ${msg}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, project, today, weather, logStatus]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isGenerating}
      aria-busy={isGenerating}
      aria-label={isGenerating ? 'Generating PDF' : 'Export daily log as PDF'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing['1'],
        padding: `0 ${spacing['3']}`,
        minHeight: touchTarget.field,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceRaised,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        fontFamily: typography.fontFamily,
        color: colors.textPrimary,
        cursor: isGenerating ? 'wait' : 'pointer',
        opacity: isGenerating ? 0.6 : 1,
        transition: `all ${transitions.instant}`,
      }}
    >
      <Download size={14} aria-hidden="true" />
      {isGenerating ? 'Generating…' : 'Export PDF'}
    </button>
  );
};
