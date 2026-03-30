import { create, insert, search } from '@orama/orama'
import type { AnyOrama, SearchParams } from '@orama/orama'

export interface SearchResult {
  type: 'rfi' | 'submittal' | 'punch_item' | 'drawing' | 'task' | 'contact' | 'file'
  id: number
  title: string
  subtitle: string
  link: string
}

interface SearchDoc {
  type: string
  entityId: number
  title: string
  subtitle: string
  link: string
}

export interface SearchDataSources {
  rfis?: { id: number; rfiNumber: string; title: string; status: string; from: string }[]
  submittals?: { id: number; submittalNumber: string; title: string; status: string; from: string }[]
  punchList?: { id: number; itemNumber: string; description: string; area: string; status: string }[]
  drawings?: { id: number; setNumber: string; title: string; discipline: string }[]
  tasks?: { id: number; title: string; assignee: { name: string }; status: string }[]
  directory?: { id: number; contactName: string; company: string; role: string }[]
  files?: { id: number; name: string; type: string }[]
}

let searchDb: AnyOrama | null = null

export async function createSearchIndex(sources: SearchDataSources = {}): Promise<AnyOrama> {
  const db = await create({
    schema: {
      type: 'string',
      entityId: 'number',
      title: 'string',
      subtitle: 'string',
      link: 'string',
    } as const,
  })

  const docs: SearchDoc[] = [
    ...(sources.rfis ?? []).map((rfi) => ({
      type: 'rfi',
      entityId: rfi.id,
      title: `${rfi.rfiNumber}: ${rfi.title}`,
      subtitle: `${rfi.status} · ${rfi.from}`,
      link: '/rfis',
    })),
    ...(sources.submittals ?? []).map((sub) => ({
      type: 'submittal',
      entityId: sub.id,
      title: `${sub.submittalNumber}: ${sub.title}`,
      subtitle: `${sub.status} · ${sub.from}`,
      link: '/submittals',
    })),
    ...(sources.punchList ?? []).map((item) => ({
      type: 'punch_item',
      entityId: item.id,
      title: `${item.itemNumber}: ${item.description}`,
      subtitle: `${item.area} · ${item.status}`,
      link: '/punch-list',
    })),
    ...(sources.drawings ?? []).map((d) => ({
      type: 'drawing',
      entityId: d.id,
      title: `${d.setNumber}: ${d.title}`,
      subtitle: d.discipline,
      link: '/drawings',
    })),
    ...(sources.tasks ?? []).map((t) => ({
      type: 'task',
      entityId: t.id,
      title: t.title,
      subtitle: `${t.assignee.name} · ${t.status}`,
      link: '/tasks',
    })),
    ...(sources.directory ?? []).map((c) => ({
      type: 'contact',
      entityId: c.id,
      title: c.contactName,
      subtitle: `${c.company} · ${c.role}`,
      link: '/directory',
    })),
    ...(sources.files ?? []).map((f) => ({
      type: 'file',
      entityId: f.id,
      title: f.name,
      subtitle: f.type === 'folder' ? 'Folder' : 'File',
      link: '/files',
    })),
  ]

  for (const doc of docs) {
    await insert(db, doc)
  }

  searchDb = db
  return db
}

export async function searchAll(query: string, limit = 10, sources?: SearchDataSources): Promise<SearchResult[]> {
  if (!searchDb) {
    await createSearchIndex(sources)
  }

  const results = await search(searchDb as AnyOrama, {
    term: query,
    limit,
  } as SearchParams<AnyOrama>)

  return results.hits.map((hit) => {
    const doc = hit.document as unknown as SearchDoc
    return {
      type: doc.type as SearchResult['type'],
      id: doc.entityId,
      title: doc.title,
      subtitle: doc.subtitle,
      link: doc.link,
    }
  })
}

/** Invalidate the cached search index so it rebuilds on next search */
export function invalidateSearchIndex(): void {
  searchDb = null
}
