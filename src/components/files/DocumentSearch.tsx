import React, { useState } from 'react';
import { Search, Sparkles, FileText, FolderOpen } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';

interface SearchResult {
  id: number;
  name: string;
  type: 'file' | 'folder';
  match: string;
  category: string;
}

const mockResults: Record<string, SearchResult[]> = {
  'structural floor 8': [
    { id: 1, name: 'S-001 Structural Grid Layout', type: 'file', match: 'Drawing set with Floor 8 structural details', category: 'Drawings' },
    { id: 2, name: 'Structural Calculations', type: 'folder', match: 'Contains Floor 8 load calculations and steel specs', category: 'Engineering' },
  ],
  'mep spec': [
    { id: 3, name: 'MEP Specifications.pdf', type: 'file', match: 'Mechanical, Electrical, Plumbing specs (4.2 MB)', category: 'Specifications' },
    { id: 4, name: 'M-001 HVAC System Diagram', type: 'file', match: 'HVAC layout diagram, Rev A', category: 'Drawings' },
  ],
  'safety': [
    { id: 5, name: 'Safety Documentation', type: 'folder', match: '18 items including incident reports and training records', category: 'Safety' },
    { id: 6, name: 'Safety Audit Q1 2026.pdf', type: 'file', match: 'Quarterly safety audit results and findings', category: 'Reports' },
  ],
};

interface DocumentSearchProps {
  onSelect?: (result: SearchResult) => void;
}

export const DocumentSearch: React.FC<DocumentSearchProps> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }

    setSearching(true);
    setTimeout(() => {
      const key = Object.keys(mockResults).find((k) => q.toLowerCase().includes(k));
      setResults(key ? mockResults[key] : []);
      setSearching(false);
    }, 300);
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
            <Sparkles size={12} color={colors.statusReview} />
            <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview }}>Smart Search</span>
          </div>
        )}
      </div>

      {/* Results */}
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
                <span style={{ fontSize: typography.fontSize.caption, color: colors.statusReview, fontWeight: typography.fontWeight.medium, flexShrink: 0 }}>{result.category}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
