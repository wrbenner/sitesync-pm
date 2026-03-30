// Integration provider registry.
// Maps integration type strings to their provider implementations.

import type { IntegrationProvider } from './base'
import { procoreProvider } from './procore'
import { msProjectProvider } from './msProject'
import { quickbooksProvider } from './quickbooks'
import { emailProvider } from './email'
import { slackProvider } from './slack'
import { teamsProvider } from './teams'
import { googleDriveProvider } from './googleDrive'
import { sharePointProvider } from './sharepoint'
import { primaveraP6Provider } from './primaveraP6'
import { autodeskBIMProvider } from './autodeskBIM'
import { sageProvider } from './sage'

export { INTEGRATION_REGISTRY, type IntegrationMeta, type IntegrationStatus, type SyncResult } from './base'
export type { IntegrationProvider } from './base'

// All registered providers
const providers: Record<string, IntegrationProvider> = {
  procore_import: procoreProvider,
  ms_project: msProjectProvider,
  quickbooks: quickbooksProvider,
  email_resend: emailProvider,
  slack: slackProvider,
  teams: teamsProvider,
  google_drive: googleDriveProvider,
  sharepoint: sharePointProvider,
  primavera_p6: primaveraP6Provider,
  autodesk_bim360: autodeskBIMProvider,
  sage: sageProvider,
}

export function getProvider(type: string): IntegrationProvider | null {
  return providers[type] ?? null
}

export function getProviderTypes(): string[] {
  return Object.keys(providers)
}

// Re-export email functions for direct use
export { sendRFIResponseEmail, sendSubmittalTransmittal, sendDailyLogSummaryEmail } from './email'

// Re-export Slack notification functions
export {
  sendSlackRFINotification,
  sendSlackSubmittalNotification,
  sendSlackDailyLogNotification,
  sendSlackScheduleChangeNotification,
} from './slack'

// Re-export Teams notification functions
export {
  sendTeamsRFINotification,
  sendTeamsSubmittalNotification,
} from './teams'
