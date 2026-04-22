// query-brain — Answer a question using RAG over project documents.
// Flow: embed question → vector search → stuff top-K chunks into Claude/GPT → return answer + citations.


import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireUuid,
  sanitizeForPrompt,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const EMBED_MODEL = 'text-embedding-ada-002'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const TOP_K = 5

interface QueryBody {
  project_id?: string
  question?: string
}

interface Citation {
  document_name: string
  document_id: string | null
  chunk_index: number
  page?: number | null
  excerpt: string
  similarity: number
}

async function embed(query: string, apiKey: string): Promise<number[]> {
  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: query }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new HttpError(502, `OpenAI embedding failed: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.data[0].embedding
}

interface Chunk {
  id: string
  document_id: string | null
  document_name: string
  chunk_index: number
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

async function askClaude(
  question: string,
  chunks: Chunk[],
  apiKey: string,
): Promise<string> {
  const context = chunks
    .map((c, i) => {
      const page = (c.metadata as { page?: number })?.page
      const pageStr = page ? ` (page ${page})` : ''
      return `[Source ${i + 1}: ${c.document_name}${pageStr}]\n${c.content}`
    })
    .join('\n\n---\n\n')

  const systemPrompt = `You are the Project Brain — an expert construction project assistant that answers questions based ONLY on the provided document excerpts.

RULES:
1. Answer ONLY using information from the excerpts. If the answer is not in the excerpts, say "I couldn't find this in your project documents."
2. Cite sources inline using [Source N] notation matching the numbered sources provided.
3. Be direct and concise. Construction professionals want answers, not filler.
4. When quoting specific values (dates, dollar amounts, specifications), cite the exact source.
5. Never invent or hallucinate details.`

  const userPrompt = `Question: ${question}\n\nDocument excerpts:\n\n${context}\n\nAnswer the question using only these excerpts. Include inline citations like [Source 1].`

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new HttpError(502, `Claude request failed: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const block = data.content?.[0]
  return (block && block.type === 'text' ? block.text : '') || 'No answer produced.'
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<QueryBody>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, projectId)

    const question = sanitizeForPrompt((body.question || '').toString(), 2000)
    if (question.length < 3) throw new HttpError(400, 'Question too short')

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!openaiKey) throw new HttpError(500, 'OPENAI_API_KEY not configured')
    if (!anthropicKey) throw new HttpError(500, 'ANTHROPIC_API_KEY not configured')

    // 1. Embed the question
    const queryEmbedding = await embed(question, openaiKey)

    // 2. Vector search
    const { data: matches, error: matchErr } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      p_project_id: projectId,
      match_count: TOP_K,
      match_threshold: 0.0,
    })
    if (matchErr) throw new HttpError(500, `Vector search failed: ${matchErr.message}`)

    const chunks = (matches || []) as Chunk[]
    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I couldn't find anything in your project documents that answers this. Try indexing more files first.",
          citations: [],
        }),
        { status: 200, headers },
      )
    }

    // 3. Ask Claude
    const answer = await askClaude(question, chunks, anthropicKey)

    const citations: Citation[] = chunks.map((c) => ({
      document_name: c.document_name,
      document_id: c.document_id,
      chunk_index: c.chunk_index,
      page: (c.metadata as { page?: number })?.page ?? null,
      excerpt: c.content.slice(0, 300),
      similarity: c.similarity,
    }))

    return new Response(JSON.stringify({ answer, citations }), { status: 200, headers })
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
