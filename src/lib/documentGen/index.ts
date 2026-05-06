/**
 * Public surface of the documentGen lib.
 */
export type { ProjectSnapshot, ProjectSnapshotMeta } from './snapshot'
export { loadSnapshot } from './snapshot'
export type { GeneratedDocument, DocumentSection } from './monthlyReport'
export { generateMonthlyReport } from './monthlyReport'
export { generateOwnerWeeklyDigest } from './ownerWeeklyDigest'
export { generateMeetingMinutes } from './meetingMinutes'
export type { MeetingMinutesInput } from './meetingMinutes'
export { generateCloseoutPackage } from './closeoutPackage'
