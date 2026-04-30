// ─────────────────────────────────────────────────────────────────────────────
// Iris service — service-local types (Wave 1, Tab D)
// ─────────────────────────────────────────────────────────────────────────────
// Per CONTRACT.md: do NOT redefine StreamItem / IrisEnhancement / IrisDraftType
// here — those live in src/types/stream.ts (locked). This file only adds
// service-local types: the persisted draft shape and the lightweight project
// context object that templates need to build prompts.
// ─────────────────────────────────────────────────────────────────────────────

import type { IrisDraftType } from '../../types/stream'

export type IrisDraftStatus = 'pending' | 'approved' | 'rejected' | 'edited'

export interface IrisDraft {
  id: string                         // mirrors StreamItem.id ("rfi-123" etc.)
  type: IrisDraftType
  content: string
  sources: string[]                  // human-readable source descriptors
  status: IrisDraftStatus
  generatedAt: string                // ISO datetime
  editedContent?: string
  confidence?: number                // 0..1 — copied from the template
  error?: string                     // populated when generation fails
}

export interface ProjectContextSnapshot {
  projectId: string | null
  projectName: string | null
  userName: string | null
  // Optional weather + crew snapshot for daily-log drafts. Templates degrade
  // gracefully when these are absent.
  weather?: {
    summary: string
    tempF?: number
  }
  workforceCount?: number
  fieldEntryCount?: number
  // Today (or "yesterday") so daily-log templates can self-date.
  asOfDate?: string                  // YYYY-MM-DD
}
