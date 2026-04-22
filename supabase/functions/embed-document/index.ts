// embed-document — Chunk a document and generate OpenAI embeddings for each chunk.
// Flow: fetch PDF/text → extract text → split into ~500-token chunks → embed → store.


import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireUuid,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const EMBED_MODEL = 'text-embedding-ada-002'
const CHUNK_TARGET_CHARS = 2000      // ~500 tokens
const CHUNK_OVERLAP_CHARS = 200      // ~50 tokens
const MAX_CHUNKS_PER_DOC = 400

interface EmbedBody {
  project_id?: string
  document_id?: string | null
  document_name?: string
  document_url?: string
  text?: string
}

// Extract text from a fetched file. For PDFs we currently rely on the caller
// sending text via `text`, or we fetch and attempt naive extraction. The
// heavy lifting (proper PDF parsing) happens client-side with pdfjs-dist.
async function fetchDocumentText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new HttpError(400, `Could not fetch document (${res.status})`)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('text/') || ct.includes('json')) {
    return await res.text()
  }
  // Binary (PDF, etc.) — return empty and expect caller to supply `text`.
  return ''
}

function chunkText(raw: string): string[] {
  const clean = raw.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks: string[] = []
  let i = 0
  while (i < clean.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    const end = Math.min(clean.length, i + CHUNK_TARGET_CHARS)
    // Prefer breaking at sentence boundaries near the target end
    let breakAt = end
    if (end < clean.length) {
      const slice = clean.slice(i, end)
      const lastPeriod = slice.lastIndexOf('. ')
      if (lastPeriod > CHUNK_TARGET_CHARS * 0.6) breakAt = i + lastPeriod + 1
    }
    const piece = clean.slice(i, breakAt).trim()
    if (piece) chunks.push(piece)
    if (breakAt >= clean.length) break
    i = Math.max(breakAt - CHUNK_OVERLAP_CHARS, i + 1)
  }
  return chunks
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new HttpError(502, `OpenAI embedding failed: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<EmbedBody>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, projectId)

    const documentName = (body.document_name || 'Untitled').toString().slice(0, 500)
    const documentId = body.document_id ?? null

    let text = (body.text || '').toString()
    if (!text && body.document_url) {
      text = await fetchDocumentText(body.document_url)
    }
    if (!text || text.trim().length < 20) {
      throw new HttpError(400, 'No extractable text content provided')
    }

    const chunks = chunkText(text)
    if (chunks.length === 0) {
      throw new HttpError(400, 'Document produced no chunks')
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new HttpError(500, 'OPENAI_API_KEY not configured')

    // Clear any existing chunks for this (project, document_id) combo to allow re-indexing.
    if (documentId) {
      await supabase
        .from('document_chunks')
        .delete()
        .eq('project_id', projectId)
        .eq('document_id', documentId)
    }

    // Embed in batches of 50
    const BATCH = 50
    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const embeddings = await embedBatch(batch, apiKey)
      for (let j = 0; j < batch.length; j++) {
        rows.push({
          project_id: projectId,
          document_id: documentId,
          document_name: documentName,
          chunk_index: i + j,
          content: batch[j],
          embedding: embeddings[j],
          metadata: { chars: batch[j].length },
        })
      }
    }

    const { error: insertErr } = await supabase.from('document_chunks').insert(rows)
    if (insertErr) throw new HttpError(500, `Insert failed: ${insertErr.message}`)

    return new Response(
      JSON.stringify({ ok: true, chunks: rows.length, document_name: documentName }),
      { status: 200, headers },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
