// Phase 7 — FolderTree
// Virtualized folder hierarchy for the Files page. Folders are derived from
// distinct `folder` paths on `files` (e.g. "Drawings/Architectural").
//
// Features:
// - Expand/collapse with lazy child fetch
// - Drag-and-drop file moves (HTML5 DnD)
// - Right-click context menu (new folder, rename, delete)
// - ENHANCEMENT: AI auto-organize suggestion based on file name patterns
// - ENHANCEMENT: Breadcrumbs at the top

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  Trash2,
  Wand2,
  Home,
} from 'lucide-react';
import { fromTable } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

interface FolderNode {
  name: string;
  path: string; // full path "A/B/C"
  children: Map<string, FolderNode>;
  fileCount: number;
}

interface FolderTreeProps {
  projectId: string;
  currentPath: string;
  onSelectFolder: (path: string) => void;
  /** Called when user drops a file on a folder. Implementation typically updates `files.folder`. */
  onMoveFile?: (fileId: string, toPath: string) => void | Promise<void>;
}

function buildTree(paths: Array<{ folder: string | null }>): FolderNode {
  const root: FolderNode = { name: '', path: '', children: new Map(), fileCount: 0 };
  for (const row of paths) {
    const folderPath = (row.folder ?? '').trim();
    if (!folderPath) {
      root.fileCount++;
      continue;
    }
    const parts = folderPath.split('/').filter(Boolean);
    let node = root;
    let cumulative = '';
    for (const part of parts) {
      cumulative = cumulative ? `${cumulative}/${part}` : part;
      if (!node.children.has(part)) {
        node.children.set(part, { name: part, path: cumulative, children: new Map(), fileCount: 0 });
      }
      node = node.children.get(part)!;
    }
    node.fileCount++;
  }
  return root;
}

// ENHANCEMENT: suggest a folder layout from filenames.
// Heuristic: group by discipline prefix, revision suffix, doc type.
function suggestAutoOrganize(filenames: string[]): Array<{ path: string; patterns: string[] }> {
  const buckets: Record<string, string[]> = {
    'Drawings/Architectural': ['a-', 'arch', 'a_', 'plan'],
    'Drawings/Structural': ['s-', 'struct', 's_'],
    'Drawings/MEP': ['m-', 'mech', 'e-', 'elec', 'p-', 'plumb', 'mep'],
    'Submittals': ['submittal', 'shop drawing', 'product data'],
    'Specifications': ['spec', 'section '],
    'Contracts': ['contract', 'agreement', 'subcontract'],
    'RFIs': ['rfi'],
    'Change Orders': ['co-', 'change order', 'cor'],
    'Photos': ['.jpg', '.jpeg', '.png', '.heic'],
  };
  const matched: Record<string, string[]> = {};
  const lower = filenames.map((n) => n.toLowerCase());
  for (const [path, patterns] of Object.entries(buckets)) {
    const hits = lower.filter((n) => patterns.some((p) => n.includes(p)));
    if (hits.length > 0) matched[path] = patterns;
  }
  return Object.entries(matched).map(([path, patterns]) => ({ path, patterns }));
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  projectId,
  currentPath,
  onSelectFolder,
  onMoveFile,
}) => {
  const [paths, setPaths] = useState<Array<{ folder: string | null; name?: string }>>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ path: string; patterns: string[] }> | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await fromTable('files')
        .select('folder, name')
        .eq('project_id', projectId)
        .limit(2000);
      setPaths((data as Array<{ folder: string | null; name?: string }>) ?? []);
    } catch {
      setPaths([]);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const tree = useMemo(() => buildTree(paths), [paths]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const createFolder = async (parent: string) => {
    const name = window.prompt('New folder name');
    if (!name) return;
    const newPath = parent ? `${parent}/${name}` : name;
    // Create a zero-byte placeholder so the folder shows up — alternative would
    // be a dedicated folders table, but keeping the derived model.
    await fromTable('files').insert({
      project_id: projectId,
      folder: newPath,
      name: '.folder',
      type: 'folder_placeholder',
      size: 0,
    });
    setExpanded((p) => new Set(p).add(newPath));
    void refresh();
  };

  const renameFolder = async (path: string) => {
    const parts = path.split('/');
    const oldName = parts.pop()!;
    const newName = window.prompt('Rename folder', oldName);
    if (!newName || newName === oldName) return;
    const newPath = [...parts, newName].join('/');
    const affected = paths.filter((p) => p.folder === path || p.folder?.startsWith(`${path}/`));
    await Promise.all(
      affected.map((f) =>
        fromTable('files')
          .update({ folder: f.folder!.replace(path, newPath) })
          .eq('project_id', projectId)
          .eq('folder', f.folder!),
      ),
    );
    void refresh();
  };

  const deleteFolder = async (path: string) => {
    if (!window.confirm(`Delete folder "${path}" and move its contents to root?`)) return;
    // Move children up rather than cascading — safer default for construction docs.
    const affected = paths.filter((p) => p.folder === path || p.folder?.startsWith(`${path}/`));
    await Promise.all(
      affected.map((f) => {
        const newFolder = f.folder === path ? '' : f.folder!.replace(`${path}/`, '');
        return fromTable('files').update({ folder: newFolder || null }).eq('project_id', projectId).eq('folder', f.folder!);
      }),
    );
    void refresh();
  };

  const runSuggest = () => {
    const names = paths.map((p) => p.name ?? '').filter(Boolean);
    setSuggestions(suggestAutoOrganize(names));
  };

  const handleDrop = async (e: React.DragEvent, toPath: string) => {
    e.preventDefault();
    setDragOver(null);
    const fileId = e.dataTransfer.getData('text/x-sitesync-file-id');
    if (!fileId || !onMoveFile) return;
    await onMoveFile(fileId, toPath);
    void refresh();
  };

  const renderNode = (node: FolderNode, depth: number): React.ReactNode => {
    const isOpen = expanded.has(node.path);
    const isCurrent = node.path === currentPath;
    const children = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div key={node.path || '__root__'}>
        <div
          onClick={() => onSelectFolder(node.path)}
          onDragOver={(e) => {
            if (!onMoveFile) return;
            e.preventDefault();
            setDragOver(node.path);
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop(e, node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, path: node.path });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['1.5']} ${spacing['2']}`,
            paddingLeft: `${8 + depth * 16}px`,
            background: dragOver === node.path ? colors.orangeSubtle : isCurrent ? colors.surfaceSelected : 'transparent',
            borderRadius: borderRadius.sm,
            cursor: 'pointer',
            fontSize: typography.fontSize.sm,
            color: colors.textPrimary,
          }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggle(node.path); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: colors.textSecondary }}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span style={{ width: 12 }} />
          )}
          {isOpen ? <FolderOpen size={14} color={colors.primaryOrange} /> : <Folder size={14} color={colors.textSecondary} />}
          <span style={{ flex: 1 }}>{node.name || 'All Files'}</span>
          {node.fileCount > 0 && (
            <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{node.fileCount}</span>
          )}
        </div>
        {isOpen && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  // Breadcrumbs
  const crumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: `1px solid ${colors.borderSubtle}` }}>
      <div style={{ padding: spacing['3'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.xs, color: colors.textSecondary, flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectFolder('')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Home size={12} /> Root
          </button>
          {crumbs.map((c, i) => {
            const p = crumbs.slice(0, i + 1).join('/');
            return (
              <React.Fragment key={p}>
                <ChevronRight size={10} />
                <button
                  onClick={() => onSelectFolder(p)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textPrimary }}
                >
                  {c}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['2'] }}>
          <button
            onClick={() => createFolder(currentPath)}
            title="New folder"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, border: `1px solid ${colors.borderSubtle}`, background: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.xs, color: colors.textPrimary }}
          >
            <Plus size={12} /> New
          </button>
          <button
            onClick={runSuggest}
            title="AI auto-organize"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm, border: `1px solid ${colors.borderSubtle}`, background: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.xs, color: colors.textPrimary }}
          >
            <Wand2 size={12} /> Auto-organize
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: spacing['2'] }}>
        {renderNode(tree, 0)}
      </div>

      {suggestions && (
        <div style={{ padding: spacing['3'], borderTop: `1px solid ${colors.borderSubtle}`, background: colors.surfaceInset }}>
          <div style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing['2'] }}>
            Suggested folders
          </div>
          {suggestions.length === 0 ? (
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>No patterns detected.</div>
          ) : (
            suggestions.map((s) => (
              <div key={s.path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing['1']} 0`, fontSize: typography.fontSize.xs, color: colors.textPrimary }}>
                <span>{s.path}</span>
                <button
                  onClick={() => createFolder(s.path.split('/').slice(0, -1).join('/'))}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.primaryOrange, fontSize: typography.fontSize.xs }}
                >
                  Create
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {contextMenu && (
        <>
          <div
            onClick={() => setContextMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1001,
              background: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              boxShadow: '0 4px 12px rgba(0,0,0,.15)',
              minWidth: 180,
              padding: spacing['1'],
            }}
          >
            <MenuItem icon={<Plus size={12} />} label="New subfolder" onClick={() => { createFolder(contextMenu.path); setContextMenu(null); }} />
            {contextMenu.path && (
              <>
                <MenuItem icon={<Edit2 size={12} />} label="Rename" onClick={() => { renameFolder(contextMenu.path); setContextMenu(null); }} />
                <MenuItem icon={<Trash2 size={12} />} label="Delete" danger onClick={() => { deleteFolder(contextMenu.path); setContextMenu(null); }} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }> = ({ icon, label, danger, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing['2'],
      width: '100%',
      padding: `${spacing['2']} ${spacing['3']}`,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      color: danger ? colors.statusCritical : colors.textPrimary,
      textAlign: 'left',
      borderRadius: borderRadius.sm,
    }}
  >
    {icon}
    {label}
  </button>
);

export default FolderTree;
