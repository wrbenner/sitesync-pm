import React, { useState, useRef } from 'react';
import { Search, Sparkles, FileText, FolderOpen, Zap } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || '/api/ai'
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || ''

interface SearchResult {
  id: number;
  name: string;
  type: 'file' | 'folder';
  match: string;
  category: string;
  semanticScore?: number; // cosine similarity 0-1
}

interface DocumentSearchProps {
  onSelect?: (result: SearchResult) => void;
}

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  if (!AI_ENDPOINT || AI_ENDPOINT === '/api/ai') return null
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (AI_API_KEY) headers['Authorization'] = `Bearer ${AI_API_KEY}`
    const res = await fetch(`${AI_ENDPOINT}/embed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: query }),
    })
    if (!res.ok) return null
    const data = await res.json() as { embedding?: number[] }
    return data.embedding || null
  } catch {
    return null
  }
}

async function semanticSearch(query: string): Promise<SearchResult[]> {
  const embedding = await getQueryEmbedding(query)

  if (embedding) {
    // Query via cosine similarity against document_embeddings table
    try {
      const { data } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.6,
        match_count: 10,
      }) as { data: Array<{ id: number; name: string; category: string; similarity: number }> | null }

      if (data && data.length > 0) {
        return data.map((row) => ({
          id: row.id,
          name: row.name,
          type: 'file' as const,
          match: `${Math.round(row.similarity * 100)}% semantic match`,
          category: row.category || 'Documents',
          semanticScore: row.similarity,
        }))
      }
    } catch {
      // Fall through to keyword search
    }
  }

  // Keyword fallback
  const { data } = await supabase
    .from('documents')
    .select('id, name, category')
    .ilike('name', `%${query}%`)
    .limit(10)

  return (data || []).map((doc: Record<string, unknown>) => ({
    id: doc.id as number,
    name: doc.name as string,
    type: 'file' as const,
    match: 'Keyword match',
    category: (doc.category as string) || 'Documents',
  }))
}

export const DocumentSearch: React.FC<DocumentSearchProps> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setIsSemanticMode(false); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await semanticSearch(q)
        const hasSemantic = res.some((r) => r.semanticScore != null)
        setIsSemanticMode(hasSemantic)
        setResults(res)
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`,
        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full,
        border: `1px solid ${query ? colors.borderFocus : 'transparent'}`,
        transition: `border-color ${transitions.instant}`,
      }}>
        <Search size={16} color={colors.textTertiary} />
        <input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search files... try &quot;structural floor 8&quot;"
          style={{
            flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none',
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, color: colors.textPrimary,
          }}
        />
        {query && (
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            {isSemanticMode
              ? <><Zap size={12} color={colors.primaryOrange} /><span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange }}>Semantic</span></>
              : <><Sparkles size={12} color={colors.statusReview} /><span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>Smart Search</span></>
            }
          </div>
        )}
      </div>

      {(results.length > 0 || searching) && (
        <div style={{ marginTop: spacing['2'], backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md, border: `1px solid ${colors.borderSubtle}`, overflow: 'hidden' }}>
          {searching ? (
            <div style={{ padding: spacing['4'], textAlign: 'center' }}>
              <Sparkles size={16} color={colors.statusReview} style={{ animation: 'pulse 1s infinite' }} />
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>Searching documents...</p>
            </div>
          ) : (
            results.map((result, i) => (
              <div
                key={result.id}
                onClick={() => onSelect?.(result)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['3'],
                  padding: `${spacing['3']} ${spacing['4']}`,
                  borderBottom: i < results.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                  cursor: 'pointer', transition: `background-color ${transitions.instant}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                {result.type === 'folder' ? <FolderOpen size={16} color={colors.primaryOrange} /> : <FileText size={16} color={colors.textTertiary} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{result.name}</p>
                  <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 1 }}>{result.match}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexShrink: 0 }}>
                  {result.semanticScore != null && (
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold }}>
                      {Math.round(result.semanticScore * 100)}%
                    </span>
                  )}
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium }}>{result.category}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
