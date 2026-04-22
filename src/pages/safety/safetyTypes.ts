// Shared types and constants for the safety domain
import { colors } from '../../styles/theme';

export type TabKey = 'incidents' | 'inspections' | 'toolbox' | 'certifications' | 'corrective_actions' | 'ptp' | 'osha_logs' | 'jha' | 'sds' | 'permits';

export const OSHA_SEVERITY: Record<string, { fg: string; bg: string; label: string }> = {
  near_miss:          { fg: colors.statusNeutral,   bg: colors.statusNeutralSubtle,   label: 'Near Miss' },
  first_aid:          { fg: colors.statusPending,   bg: colors.statusPendingSubtle,   label: 'First Aid' },
  medical_treatment:  { fg: colors.statusWarning,   bg: colors.statusWarningSubtle,   label: 'Medical Treatment' },
  lost_time:          { fg: colors.statusCritical,  bg: colors.statusCriticalSubtle,  label: 'Lost Time' },
  fatality:           { fg: colors.textPrimary,     bg: colors.statusNeutralSubtle,   label: 'Fatality' },
};

export function getSeverityStyle(severity: string | null): { fg: string; bg: string; label: string } {
  if (!severity) return { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: 'Unknown' };
  return OSHA_SEVERITY[severity] ?? { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: severity.replace(/_/g, ' ') };
}

export const CHECKLIST_TEMPLATES = {
  daily_walk: {
    label: 'Daily Safety Walk',
    items: [
      'PPE worn correctly by all workers on site',
      'Housekeeping complete, slip and trip hazards clear',
      'Fall protection in place at all open edges and floor openings',
      'Fire extinguishers accessible and inspection tags current',
      'Emergency exits clear and properly marked',
      'First aid kit stocked and accessible',
    ],
  },
  weekly_audit: {
    label: 'Weekly Site Audit',
    items: [
      'Scaffold inspection tags current and planks in good condition',
      'Electrical panels covered, GFCI functional and tagged',
      'Crane and rigging pre-inspection complete and documented',
      'Excavation and shoring adequate per soil classification',
      'Chemical storage proper and SDS binder current',
      'Site perimeter fencing and security intact',
    ],
  },
  monthly_equipment: {
    label: 'Monthly Equipment Inspection',
    items: [
      'Fire extinguisher hydrostatic test and service tags current',
      'Emergency eyewash and shower stations flushed and tested',
      'GFCI outlets and cords tested, tagged, and documented',
      'Equipment operator certifications current and on file',
      'Personal fall arrest harnesses and lanyards inspected',
      'AED pads and battery status current, first aid restocked',
    ],
  },
} as const;

export type TemplateKey = keyof typeof CHECKLIST_TEMPLATES;
