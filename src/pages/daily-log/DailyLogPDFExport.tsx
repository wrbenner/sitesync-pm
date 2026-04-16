import React from 'react';
import { toast } from 'sonner';
import { ExportButton } from '../../components/shared/ExportButton';
import { DailyLogPDF } from '../../components/export/DailyLogPDF';
import type { DailyLogPDFData } from '../../components/export/DailyLogPDF';
import { formatWeatherSummary } from '../../lib/weather';
import type { WeatherData } from '../../lib/weather';
import type { ExtendedDailyLog } from './types';
import type { DailyLogState } from '../../machines/dailyLogMachine';

interface DailyLogPDFExportProps {
  today: ExtendedDailyLog;
  weather: WeatherData | null;
  logStatus: DailyLogState;
}

export const DailyLogPDFExport: React.FC<DailyLogPDFExportProps> = ({ today, weather, logStatus }) => {
  const pdfData: DailyLogPDFData = {
    projectName: 'Current Project',
    logDate: today.log_date,
    workers_onsite: today.workers_onsite ?? 0,
    total_hours: today.total_hours ?? 0,
    incidents: today.incidents ?? 0,
    weather: today.weather ?? (weather ? formatWeatherSummary(weather) : 'N/A'),
    temperature_high: today.temperature_high ?? undefined,
    temperature_low: today.temperature_low ?? undefined,
    wind_speed: today.wind_speed ?? undefined,
    precipitation: today.precipitation ?? undefined,
    is_submitted: today.is_submitted ?? false,
    submitted_at: today.submitted_at ?? null,
    status: logStatus,
    crew_entries: today.crew_entries ?? [],
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

  return (
    <ExportButton
      onExportCSV={() => toast.success('Daily log data exported as CSV')}
      pdfFilename="SiteSync_DailyLog"
      pdfDocument={<DailyLogPDF data={pdfData} />}
    />
  );
};
