import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Box, FileUp, X, Info } from 'lucide-react';
import { PageContainer } from '../../components/Primitives';
import { BIMViewer } from '../../components/bim/BIMViewer';
import type { BIMLinkedItem } from '../../components/bim/BIMViewer';
import { IFCViewer } from '../../components/bim/IFCViewer';
import type { IFCParseResult } from '../../components/bim/IFCViewer';
import { useIFCModel } from '../../hooks/useIFCModel';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

// ── Page Component ─────────────────────────────────────────────────────────

const BIMViewerPage: React.FC = () => {
  const [modelUrl, setModelUrl] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [ifcResult, setIfcResult] = useState<IFCParseResult | null>(null);
  const [ifcParsing, setIfcParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ifc = useIFCModel();

  const ifcMeshes: THREE.Object3D[] | undefined = ifc.model ? [ifc.model.root] : undefined;

  const handleFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'glb' || ext === 'gltf') {
      ifc.reset();
      setIfcResult(null);
      const url = URL.createObjectURL(file);
      setModelUrl(url);
      setFileName(file.name);
      return;
    }

    if (ext === 'ifc') {
      if (modelUrl) URL.revokeObjectURL(modelUrl);
      setModelUrl(undefined);
      setFileName(file.name);
      setIfcResult(null);

      // Geometry path (web-ifc WASM → Three.js meshes)
      ifc.loadFile(file).catch((err) => {
        console.error('IFC geometry load failed:', err);
        toast.error('Failed to load IFC geometry');
      });

      // Metadata path (Supabase edge function → building stats sidebar)
      setIfcParsing(true);
      (async () => {
        try {
          const text = await file.text();
          const { data, error } = await supabase.functions.invoke('parse-ifc', {
            body: { ifc_text: text.slice(0, 5 * 1024 * 1024) },
          });
          if (error) throw error;
          setIfcResult(data as IFCParseResult);
        } catch (err) {
          console.error('IFC metadata parse failed:', err);
        } finally {
          setIfcParsing(false);
        }
      })();
      return;
    }

    alert('Please upload a .glb, .gltf, or .ifc file.');
  }, [ifc, modelUrl]);

  // Update displayed filename when the IFC hook errors out
  useEffect(() => {
    if (ifc.error) toast.error(ifc.error);
  }, [ifc.error]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const clearModel = useCallback(() => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    setModelUrl(undefined);
    setFileName(null);
    setIfcResult(null);
    ifc.reset();
  }, [modelUrl, ifc]);

  const handleElementClick = useCallback((elementId: string) => {
    setSelectedElementId(elementId);
  }, []);

  return (
    <PageContainer title="3D Model Viewer (BIM)" subtitle="View and inspect 3D building models with linked construction items">
      {/* ── Upload area ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['4'],
          marginBottom: spacing['5'],
          flexWrap: 'wrap' as const,
        }}
      >
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: '1 1 320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['3'],
            padding: `${spacing['4']} ${spacing['6']}`,
            border: `2px dashed ${isDragOver ? '#F47820' : colors.borderDefault}`,
            borderRadius: borderRadius.lg,
            background: isDragOver ? 'rgba(244,120,32,0.04)' : colors.surfaceInset,
            cursor: 'pointer',
            transition: `border-color ${transitions.quick}, background ${transitions.quick}`,
            minHeight: 64,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf,.ifc,.IFC"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          <FileUp size={20} color={isDragOver ? '#F47820' : colors.textTertiary} />
          <span
            style={{
              fontSize: typography.fontSize.body,
              color: isDragOver ? '#F47820' : colors.textSecondary,
              fontFamily: typography.fontFamily,
            }}
          >
            {fileName ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                <strong>{fileName}</strong>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearModel();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    border: 'none',
                    borderRadius: '50%',
                    background: colors.statusCriticalSubtle,
                    color: '#E05252',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ) : (
              'Drop a .glb / .gltf / .ifc file here, or click to upload'
            )}
          </span>
        </div>

        {!modelUrl && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['3']}`,
              background: colors.statusInfoSubtle,
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm,
              color: '#3A7BC8',
              fontFamily: typography.fontFamily,
            }}
          >
            <Info size={14} />
            Demo building shown below with sample markers
          </div>
        )}
      </div>

      {/* ── Selected element indicator ─────────────────────── */}
      {selectedElementId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            marginBottom: spacing['3'],
            padding: `${spacing['2']} ${spacing['3']}`,
            background: colors.surfaceInset,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
            fontFamily: typography.fontFamily,
          }}
        >
          <Box size={14} color={colors.primaryOrange} />
          Selected: <code style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{selectedElementId}</code>
        </div>
      )}

      {/* ── 3D Viewer ───────────────────────────────────────── */}
      <div
        style={{
          borderRadius: borderRadius.xl,
          overflow: 'hidden',
          boxShadow: shadows.panel,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <BIMViewer
          modelUrl={modelUrl}
          meshes={ifcMeshes}
          linkedItems={[] as BIMLinkedItem[]}
          onElementClick={handleElementClick}
          height={640}
        />
      </div>

      {/* ── IFC progress ───────────────────────────────────── */}
      {ifc.isLoading && (
        <div
          style={{
            marginTop: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            background: colors.surfaceInset,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
            fontFamily: typography.fontFamily,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
            <span>{ifc.progress.message || 'Loading IFC…'}</span>
            <span>{Math.round(ifc.progress.progress * 100)}%</span>
          </div>
          <div style={{ height: 4, background: colors.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.round(ifc.progress.progress * 100)}%`,
                background: '#F47820',
                transition: 'width 200ms ease',
              }}
            />
          </div>
        </div>
      )}

      {/* ── IFC metadata sidebar ────────────────────────────── */}
      {(ifcResult || ifcParsing) && (
        <div style={{ marginTop: spacing['4'] }}>
          <IFCViewer result={ifcResult} hideUpload />
        </div>
      )}

      {/* ── Help text ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: spacing['6'],
          marginTop: spacing['4'],
          flexWrap: 'wrap' as const,
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}
      >
        <span>Left drag: Orbit</span>
        <span>Right drag: Pan</span>
        <span>Scroll: Zoom</span>
        <span>Click markers: View details</span>
      </div>
    </PageContainer>
  );
};

export default BIMViewerPage;
