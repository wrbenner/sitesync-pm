import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, Btn } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import {
  Upload,
  FileText,
  CheckSquare,
  Square,
  Filter,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedSubmittal {
  id: string;
  specSection: string;
  specTitle: string;
  submittalType: 'shop_drawing' | 'product_data' | 'sample' | 'test_report' | 'certificate';
  description: string;
  discipline: 'structural' | 'architectural' | 'mechanical' | 'electrical' | 'plumbing';
  isSelected: boolean;
  confidence: number;
}

export interface SpecParserProps {
  projectId: string;
  onExtractComplete?: (items: ExtractedSubmittal[]) => void;
}

// ─── Simulated Data ─────────────────────────────────────────────────────────

const SIMULATED_SUBMITTALS: Omit<ExtractedSubmittal, 'isSelected'>[] = [
  // Division 03 — Concrete
  { id: 'ext-001', specSection: '03 10 00', specTitle: 'Concrete Forming', submittalType: 'shop_drawing', description: 'Formwork layout and shoring plan for elevated slabs', discipline: 'structural', confidence: 0.95 },
  { id: 'ext-002', specSection: '03 20 00', specTitle: 'Concrete Reinforcing', submittalType: 'shop_drawing', description: 'Reinforcing steel shop drawings with bar schedules', discipline: 'structural', confidence: 0.97 },
  { id: 'ext-003', specSection: '03 30 00', specTitle: 'Cast-in-Place Concrete', submittalType: 'product_data', description: 'Concrete mix design submittals for all specified classes', discipline: 'structural', confidence: 0.93 },
  { id: 'ext-004', specSection: '03 30 00', specTitle: 'Cast-in-Place Concrete', submittalType: 'test_report', description: 'Compressive strength test reports per ACI 318', discipline: 'structural', confidence: 0.91 },
  { id: 'ext-005', specSection: '03 35 00', specTitle: 'Concrete Finishing', submittalType: 'sample', description: 'Concrete finish samples for exposed aggregate areas', discipline: 'architectural', confidence: 0.78 },
  // Division 05 — Steel
  { id: 'ext-006', specSection: '05 12 00', specTitle: 'Structural Steel Framing', submittalType: 'shop_drawing', description: 'Structural steel erection drawings with connection details', discipline: 'structural', confidence: 0.98 },
  { id: 'ext-007', specSection: '05 12 00', specTitle: 'Structural Steel Framing', submittalType: 'certificate', description: 'Mill certificates for structural steel members', discipline: 'structural', confidence: 0.94 },
  { id: 'ext-008', specSection: '05 21 00', specTitle: 'Steel Joist Framing', submittalType: 'shop_drawing', description: 'Steel joist and joist girder shop drawings', discipline: 'structural', confidence: 0.92 },
  { id: 'ext-009', specSection: '05 31 00', specTitle: 'Steel Decking', submittalType: 'product_data', description: 'Composite steel deck product data and load tables', discipline: 'structural', confidence: 0.89 },
  { id: 'ext-010', specSection: '05 50 00', specTitle: 'Metal Fabrications', submittalType: 'shop_drawing', description: 'Miscellaneous metals — handrails, ladders, embed plates', discipline: 'structural', confidence: 0.87 },
  // Division 07 — Thermal & Moisture
  { id: 'ext-011', specSection: '07 21 00', specTitle: 'Thermal Insulation', submittalType: 'product_data', description: 'Insulation product data with R-values and fire ratings', discipline: 'architectural', confidence: 0.86 },
  { id: 'ext-012', specSection: '07 41 00', specTitle: 'Roof Panels', submittalType: 'shop_drawing', description: 'Metal roof panel layout and flashing details', discipline: 'architectural', confidence: 0.92 },
  { id: 'ext-013', specSection: '07 52 00', specTitle: 'Modified Bituminous Membrane', submittalType: 'product_data', description: 'Roofing membrane manufacturer data and warranty info', discipline: 'architectural', confidence: 0.88 },
  { id: 'ext-014', specSection: '07 62 00', specTitle: 'Sheet Metal Flashing', submittalType: 'shop_drawing', description: 'Flashing and sheet metal details at roof penetrations', discipline: 'architectural', confidence: 0.84 },
  { id: 'ext-015', specSection: '07 84 00', specTitle: 'Firestopping', submittalType: 'product_data', description: 'Firestop system data with UL listing documentation', discipline: 'architectural', confidence: 0.90 },
  { id: 'ext-016', specSection: '07 92 00', specTitle: 'Joint Sealants', submittalType: 'sample', description: 'Color samples for exposed sealant joints', discipline: 'architectural', confidence: 0.72 },
  // Division 08 — Openings
  { id: 'ext-017', specSection: '08 11 00', specTitle: 'Metal Doors and Frames', submittalType: 'shop_drawing', description: 'Hollow metal door and frame schedule with hardware', discipline: 'architectural', confidence: 0.95 },
  { id: 'ext-018', specSection: '08 14 00', specTitle: 'Wood Doors', submittalType: 'product_data', description: 'Wood door product data — species, core type, finish', discipline: 'architectural', confidence: 0.88 },
  { id: 'ext-019', specSection: '08 41 00', specTitle: 'Entrances and Storefronts', submittalType: 'shop_drawing', description: 'Aluminum storefront system shop drawings', discipline: 'architectural', confidence: 0.93 },
  { id: 'ext-020', specSection: '08 44 00', specTitle: 'Curtain Wall', submittalType: 'shop_drawing', description: 'Curtain wall system shop drawings with structural calcs', discipline: 'architectural', confidence: 0.96 },
  { id: 'ext-021', specSection: '08 71 00', specTitle: 'Door Hardware', submittalType: 'product_data', description: 'Hardware sets schedule with manufacturer cut sheets', discipline: 'architectural', confidence: 0.91 },
  // Division 09 — Finishes
  { id: 'ext-022', specSection: '09 21 00', specTitle: 'Plaster and Gypsum Board', submittalType: 'product_data', description: 'Gypsum board assemblies — fire-rated and acoustic', discipline: 'architectural', confidence: 0.87 },
  { id: 'ext-023', specSection: '09 30 00', specTitle: 'Tiling', submittalType: 'sample', description: 'Tile samples — porcelain, ceramic, and natural stone', discipline: 'architectural', confidence: 0.82 },
  { id: 'ext-024', specSection: '09 51 00', specTitle: 'Acoustical Ceilings', submittalType: 'product_data', description: 'Acoustical ceiling tile product data with NRC ratings', discipline: 'architectural', confidence: 0.85 },
  { id: 'ext-025', specSection: '09 65 00', specTitle: 'Resilient Flooring', submittalType: 'sample', description: 'LVT and rubber flooring color/pattern samples', discipline: 'architectural', confidence: 0.79 },
  { id: 'ext-026', specSection: '09 68 00', specTitle: 'Carpeting', submittalType: 'sample', description: 'Carpet tile samples with backing specifications', discipline: 'architectural', confidence: 0.76 },
  { id: 'ext-027', specSection: '09 91 00', specTitle: 'Painting', submittalType: 'product_data', description: 'Paint color schedule with VOC compliance data', discipline: 'architectural', confidence: 0.83 },
  // Division 15 — Mechanical (legacy numbering)
  { id: 'ext-028', specSection: '23 05 00', specTitle: 'Common Work Results for HVAC', submittalType: 'product_data', description: 'Pipe and fitting product data for HVAC piping systems', discipline: 'mechanical', confidence: 0.88 },
  { id: 'ext-029', specSection: '23 21 00', specTitle: 'Hydronic Piping', submittalType: 'shop_drawing', description: 'Hydronic piping isometric drawings and riser diagrams', discipline: 'mechanical', confidence: 0.91 },
  { id: 'ext-030', specSection: '23 31 00', specTitle: 'HVAC Ducts and Casings', submittalType: 'shop_drawing', description: 'Ductwork fabrication drawings with sizing calculations', discipline: 'mechanical', confidence: 0.94 },
  { id: 'ext-031', specSection: '23 34 00', specTitle: 'HVAC Fans', submittalType: 'product_data', description: 'Fan performance curves and sound power data', discipline: 'mechanical', confidence: 0.86 },
  { id: 'ext-032', specSection: '23 64 00', specTitle: 'Packaged Water Chillers', submittalType: 'product_data', description: 'Chiller performance data, electrical, and piping requirements', discipline: 'mechanical', confidence: 0.93 },
  { id: 'ext-033', specSection: '23 73 00', specTitle: 'Indoor Air Handling Units', submittalType: 'shop_drawing', description: 'AHU arrangement drawings with accessories schedule', discipline: 'mechanical', confidence: 0.90 },
  { id: 'ext-034', specSection: '23 82 00', specTitle: 'Terminal Units', submittalType: 'product_data', description: 'VAV box selection schedules with controls integration', discipline: 'mechanical', confidence: 0.85 },
  // Division 22 — Plumbing
  { id: 'ext-035', specSection: '22 05 00', specTitle: 'Common Work Results for Plumbing', submittalType: 'product_data', description: 'Plumbing pipe and fitting product data', discipline: 'plumbing', confidence: 0.87 },
  { id: 'ext-036', specSection: '22 11 00', specTitle: 'Facility Water Distribution', submittalType: 'shop_drawing', description: 'Domestic water riser diagrams and pipe sizing calcs', discipline: 'plumbing', confidence: 0.89 },
  { id: 'ext-037', specSection: '22 13 00', specTitle: 'Facility Sanitary Sewerage', submittalType: 'shop_drawing', description: 'Sanitary waste and vent isometric drawings', discipline: 'plumbing', confidence: 0.88 },
  { id: 'ext-038', specSection: '22 34 00', specTitle: 'Fuel-Fired Domestic Water Heaters', submittalType: 'product_data', description: 'Water heater product data with efficiency ratings', discipline: 'plumbing', confidence: 0.84 },
  { id: 'ext-039', specSection: '22 40 00', specTitle: 'Plumbing Fixtures', submittalType: 'product_data', description: 'Fixture cut sheets — lavatories, water closets, urinals', discipline: 'plumbing', confidence: 0.92 },
  // Division 26 — Electrical
  { id: 'ext-040', specSection: '26 05 00', specTitle: 'Common Work Results for Electrical', submittalType: 'product_data', description: 'Wire and cable product data with conductor schedules', discipline: 'electrical', confidence: 0.88 },
  { id: 'ext-041', specSection: '26 24 00', specTitle: 'Switchboards and Panelboards', submittalType: 'shop_drawing', description: 'Electrical panel schedules and one-line diagrams', discipline: 'electrical', confidence: 0.96 },
  { id: 'ext-042', specSection: '26 27 00', specTitle: 'Low-Voltage Distribution Equipment', submittalType: 'product_data', description: 'Distribution transformer product data with efficiency', discipline: 'electrical', confidence: 0.90 },
  { id: 'ext-043', specSection: '26 28 00', specTitle: 'Low-Voltage Circuit Protective Devices', submittalType: 'product_data', description: 'Circuit breaker coordination study and trip settings', discipline: 'electrical', confidence: 0.87 },
  { id: 'ext-044', specSection: '26 29 00', specTitle: 'Low-Voltage Controllers', submittalType: 'shop_drawing', description: 'Motor control center drawings with starter schedules', discipline: 'electrical', confidence: 0.91 },
  { id: 'ext-045', specSection: '26 51 00', specTitle: 'Interior Lighting', submittalType: 'product_data', description: 'Luminaire cut sheets with photometric data', discipline: 'electrical', confidence: 0.93 },
  { id: 'ext-046', specSection: '26 56 00', specTitle: 'Exterior Lighting', submittalType: 'product_data', description: 'Site lighting fixtures with pole and base details', discipline: 'electrical', confidence: 0.85 },
  { id: 'ext-047', specSection: '27 10 00', specTitle: 'Structured Cabling', submittalType: 'shop_drawing', description: 'Structured cabling riser diagram and pathway layouts', discipline: 'electrical', confidence: 0.82 },
];

// ─── Processing Steps ───────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  'Reading PDF...',
  'Analyzing sections...',
  'Extracting submittal requirements...',
  'Organizing by division...',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  shop_drawing: 'Shop Drawing',
  product_data: 'Product Data',
  sample: 'Sample',
  test_report: 'Test Report',
  certificate: 'Certificate',
};

const TYPE_COLORS: Record<string, { fg: string; bg: string }> = {
  shop_drawing: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  product_data: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  sample: { fg: colors.statusReview, bg: colors.statusReviewSubtle },
  test_report: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  certificate: { fg: colors.primaryOrange, bg: colors.orangeSubtle },
};

const DISCIPLINE_COLORS: Record<string, { fg: string; bg: string }> = {
  structural: { fg: '#C93B3B', bg: '#FDF2F2' },
  architectural: { fg: '#7C5DC7', bg: '#F3F0FF' },
  mechanical: { fg: '#06B6D4', bg: '#ECFDFD' },
  electrical: { fg: '#D97706', bg: '#FFFBEB' },
  plumbing: { fg: '#3A7BC8', bg: '#EBF5FF' },
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return colors.statusActive;
  if (confidence >= 0.6) return colors.statusPending;
  return colors.statusCritical;
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 0.85) return colors.statusActiveSubtle;
  if (confidence >= 0.6) return colors.statusPendingSubtle;
  return colors.statusCriticalSubtle;
}

// ─── Component ──────────────────────────────────────────────────────────────

type ParseState = 'idle' | 'processing' | 'complete';

const SpecParser: React.FC<SpecParserProps> = ({ projectId: _projectId, onExtractComplete }) => {
  const [state, setState] = useState<ParseState>('idle');
  const [processingStep, setProcessingStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [items, setItems] = useState<ExtractedSubmittal[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Filters
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Simulated parsing ─────────────────────────────────────────────────

  const simulateParsing = useCallback((name: string) => {
    setState('processing');
    setFileName(name);
    setProcessingStep(0);
    setProgress(0);

    const totalDuration = 3000;
    const stepDuration = totalDuration / PROCESSING_STEPS.length;
    const progressInterval = 50;
    const progressPerTick = 100 / (totalDuration / progressInterval);

    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += progressInterval;
      const newProgress = Math.min(elapsed * progressPerTick / 100 * 100, 100);
      setProgress(newProgress);
      const stepIndex = Math.min(
        Math.floor(elapsed / stepDuration),
        PROCESSING_STEPS.length - 1
      );
      setProcessingStep(stepIndex);

      if (elapsed >= totalDuration) {
        clearInterval(timer);
        const extractedItems: ExtractedSubmittal[] = SIMULATED_SUBMITTALS.map((s) => ({
          ...s,
          isSelected: s.confidence >= 0.8,
        }));
        setItems(extractedItems);
        setState('complete');
      }
    }, progressInterval);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        simulateParsing(file.name);
      }
    },
    [simulateParsing]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        simulateParsing(file.name);
      }
    },
    [simulateParsing]
  );

  // ── Selection ─────────────────────────────────────────────────────────

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  }, []);

  const selectAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, isSelected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, isSelected: false })));
  }, []);

  // ── Filtering ─────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (disciplineFilter !== 'all' && item.discipline !== disciplineFilter) return false;
      if (typeFilter !== 'all' && item.submittalType !== typeFilter) return false;
      if (item.confidence < confidenceThreshold) return false;
      return true;
    });
  }, [items, disciplineFilter, typeFilter, confidenceThreshold]);

  const selectedCount = filteredItems.filter((i) => i.isSelected).length;

  // ── Stats ─────────────────────────────────────────────────────────────

  const divisions = useMemo(() => {
    const divs = new Set(items.map((i) => i.specSection.substring(0, 2)));
    return divs.size;
  }, [items]);

  // ── Import ────────────────────────────────────────────────────────────

  const handleImport = useCallback(() => {
    const selected = items.filter((i) => i.isSelected);
    onExtractComplete?.(selected);
  }, [items, onExtractComplete]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setState('idle');
    setItems([]);
    setFileName('');
    setProgress(0);
    setProcessingStep(0);
    setDisciplineFilter('all');
    setTypeFilter('all');
    setConfidenceThreshold(0);
    setShowFilterPanel(false);
  }, []);

  // ─── Render: Upload Zone ──────────────────────────────────────────────

  if (state === 'idle') {
    return (
      <Card>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? colors.primaryOrange : colors.borderDefault}`,
            borderRadius: borderRadius.xl,
            padding: spacing['16'],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backgroundColor: isDragOver ? colors.orangeSubtle : colors.surfaceInset,
            transition: `all ${transitions.quick}`,
            minHeight: '280px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: borderRadius.full,
              backgroundColor: isDragOver ? colors.orangeLight : colors.surfaceRaised,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing['5'],
              transition: `all ${transitions.quick}`,
              boxShadow: isDragOver ? shadows.glow : shadows.card,
            }}
          >
            <Upload
              size={28}
              color={isDragOver ? colors.primaryOrange : colors.textSecondary}
            />
          </div>
          <p
            style={{
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: spacing['2'],
            }}
          >
            Drop your project specifications here
          </p>
          <p
            style={{
              fontSize: typography.fontSize.body,
              color: colors.textTertiary,
              margin: 0,
              marginBottom: spacing['5'],
            }}
          >
            Upload a PDF to automatically extract submittal requirements
          </p>
          <Btn variant="secondary" size="sm" icon={<FileText size={14} />}>
            Browse Files
          </Btn>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </Card>
    );
  }

  // ─── Render: Processing ───────────────────────────────────────────────

  if (state === 'processing') {
    return (
      <Card>
        <div
          style={{
            padding: spacing['10'],
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: spacing['6'],
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: borderRadius.full,
              backgroundColor: colors.orangeSubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Loader2
              size={28}
              color={colors.primaryOrange}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                margin: 0,
                marginBottom: spacing['1'],
              }}
            >
              Parsing Specification
            </p>
            <p
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textTertiary,
                margin: 0,
              }}
            >
              {fileName}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div
              style={{
                height: '6px',
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.full,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: colors.primaryOrange,
                  borderRadius: borderRadius.full,
                  transition: `width ${transitions.quick}`,
                }}
              />
            </div>
          </div>

          {/* Processing steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], width: '100%', maxWidth: '360px' }}>
            {PROCESSING_STEPS.map((step, idx) => {
              const isActive = idx === processingStep;
              const isComplete = idx < processingStep;
              return (
                <div
                  key={step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['3'],
                    opacity: idx > processingStep ? 0.35 : 1,
                    transition: `opacity ${transitions.quick}`,
                  }}
                >
                  {isComplete ? (
                    <CheckCircle2 size={16} color={colors.statusActive} />
                  ) : isActive ? (
                    <Loader2
                      size={16}
                      color={colors.primaryOrange}
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: borderRadius.full,
                        border: `1.5px solid ${colors.borderDefault}`,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: isActive ? colors.textPrimary : isComplete ? colors.statusActive : colors.textTertiary,
                      fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                    }}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spin keyframes */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </Card>
    );
  }

  // ─── Render: Results ──────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>
      {/* Stats bar */}
      <Card padding={spacing['4']}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: spacing['3'],
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: borderRadius.md,
                backgroundColor: colors.statusActiveSubtle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={18} color={colors.statusActive} />
            </div>
            <div>
              <p
                style={{
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                }}
              >
                Found {items.length} submittal requirements across {divisions} divisions
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textTertiary,
                  margin: 0,
                }}
              >
                {fileName}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
            <Btn variant="ghost" size="sm" onClick={handleReset} icon={<X size={14} />}>
              Reset
            </Btn>
          </div>
        </div>
      </Card>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spacing['3'],
        }}
      >
        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <Btn variant="ghost" size="sm" onClick={selectAll}>
            Select All
          </Btn>
          <Btn variant="ghost" size="sm" onClick={deselectAll}>
            Deselect All
          </Btn>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              marginLeft: spacing['2'],
            }}
          >
            {selectedCount} of {filteredItems.length} selected
          </span>
        </div>

        <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
          <Btn
            variant="ghost"
            size="sm"
            icon={<Filter size={14} />}
            onClick={() => setShowFilterPanel((p) => !p)}
          >
            Filters
            <ChevronDown size={12} style={{ marginLeft: '4px' }} />
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={selectedCount === 0}
            icon={<CheckSquare size={14} />}
          >
            Import Selected ({selectedCount})
          </Btn>
        </div>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <Card padding={spacing['4']}>
          <div
            style={{
              display: 'flex',
              gap: spacing['5'],
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            {/* Discipline filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  marginBottom: spacing['1.5'],
                  textTransform: 'uppercase' as const,
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                Discipline
              </label>
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                style={{
                  padding: `${spacing['2']} ${spacing['3']}`,
                  fontSize: typography.fontSize.sm,
                  borderRadius: borderRadius.base,
                  border: `1px solid ${colors.borderDefault}`,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  outline: 'none',
                  cursor: 'pointer',
                  minWidth: '140px',
                }}
              >
                <option value="all">All Disciplines</option>
                <option value="structural">Structural</option>
                <option value="architectural">Architectural</option>
                <option value="mechanical">Mechanical</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
              </select>
            </div>

            {/* Type filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  marginBottom: spacing['1.5'],
                  textTransform: 'uppercase' as const,
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: `${spacing['2']} ${spacing['3']}`,
                  fontSize: typography.fontSize.sm,
                  borderRadius: borderRadius.base,
                  border: `1px solid ${colors.borderDefault}`,
                  backgroundColor: colors.surfaceRaised,
                  color: colors.textPrimary,
                  outline: 'none',
                  cursor: 'pointer',
                  minWidth: '140px',
                }}
              >
                <option value="all">All Types</option>
                <option value="shop_drawing">Shop Drawing</option>
                <option value="product_data">Product Data</option>
                <option value="sample">Sample</option>
                <option value="test_report">Test Report</option>
                <option value="certificate">Certificate</option>
              </select>
            </div>

            {/* Confidence threshold */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  marginBottom: spacing['1.5'],
                  textTransform: 'uppercase' as const,
                  letterSpacing: typography.letterSpacing.wider,
                }}
              >
                Min Confidence: {Math.round(confidenceThreshold * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(confidenceThreshold * 100)}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value) / 100)}
                style={{
                  width: '160px',
                  accentColor: colors.primaryOrange,
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Results table */}
      <Card padding="0">
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: typography.fontSize.sm,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  backgroundColor: colors.surfaceInset,
                }}
              >
                <th style={thStyle({ width: '44px', textAlign: 'center' })}>&nbsp;</th>
                <th style={thStyle({ width: '100px' })}>Section</th>
                <th style={thStyle({ minWidth: '160px' })}>Title</th>
                <th style={thStyle({ width: '120px' })}>Type</th>
                <th style={thStyle({ minWidth: '200px' })}>Description</th>
                <th style={thStyle({ width: '120px' })}>Discipline</th>
                <th style={thStyle({ width: '120px' })}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    cursor: 'pointer',
                    backgroundColor: item.isSelected ? colors.surfaceSelected : 'transparent',
                    transition: `background-color ${transitions.instant}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!item.isSelected) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.surfaceHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = item.isSelected
                      ? colors.surfaceSelected
                      : 'transparent';
                  }}
                >
                  {/* Checkbox */}
                  <td style={tdStyle({ textAlign: 'center' })}>
                    {item.isSelected ? (
                      <CheckSquare size={16} color={colors.primaryOrange} />
                    ) : (
                      <Square size={16} color={colors.textTertiary} />
                    )}
                  </td>

                  {/* Spec Section */}
                  <td style={tdStyle({})}>
                    <span
                      style={{
                        fontFamily: typography.fontFamilyMono,
                        fontSize: typography.fontSize.label,
                        color: colors.textPrimary,
                        fontWeight: typography.fontWeight.medium,
                      }}
                    >
                      {item.specSection}
                    </span>
                  </td>

                  {/* Title */}
                  <td style={tdStyle({})}>
                    <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {item.specTitle}
                    </span>
                  </td>

                  {/* Type badge */}
                  <td style={tdStyle({})}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: `${spacing['0.5']} ${spacing['2']}`,
                        borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        backgroundColor: TYPE_COLORS[item.submittalType]?.bg ?? colors.statusNeutralSubtle,
                        color: TYPE_COLORS[item.submittalType]?.fg ?? colors.textTertiary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {TYPE_LABELS[item.submittalType] ?? item.submittalType}
                    </span>
                  </td>

                  {/* Description */}
                  <td style={tdStyle({})}>
                    <span style={{ color: colors.textSecondary, lineHeight: typography.lineHeight.snug }}>
                      {item.description}
                    </span>
                  </td>

                  {/* Discipline badge */}
                  <td style={tdStyle({})}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: `${spacing['0.5']} ${spacing['2']}`,
                        borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        textTransform: 'capitalize',
                        backgroundColor: DISCIPLINE_COLORS[item.discipline]?.bg ?? '#F7F8FA',
                        color: DISCIPLINE_COLORS[item.discipline]?.fg ?? colors.textTertiary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.discipline}
                    </span>
                  </td>

                  {/* Confidence */}
                  <td style={tdStyle({})}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                      <div
                        style={{
                          flex: 1,
                          height: '6px',
                          backgroundColor: getConfidenceBg(item.confidence),
                          borderRadius: borderRadius.full,
                          overflow: 'hidden',
                          minWidth: '48px',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${item.confidence * 100}%`,
                            backgroundColor: getConfidenceColor(item.confidence),
                            borderRadius: borderRadius.full,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.medium,
                          color: getConfidenceColor(item.confidence),
                          minWidth: '32px',
                          textAlign: 'right',
                        }}
                      >
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: spacing['10'],
                      textAlign: 'center',
                      color: colors.textTertiary,
                      fontSize: typography.fontSize.body,
                    }}
                  >
                    <AlertCircle
                      size={20}
                      style={{ marginBottom: spacing['2'], opacity: 0.5 }}
                    />
                    <p style={{ margin: 0 }}>No submittals match your current filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ─── Table Cell Styles ──────────────────────────────────────────────────────

function thStyle(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: `${spacing['3']} ${spacing['4']}`,
    textAlign: 'left',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wider,
    whiteSpace: 'nowrap',
    ...extra,
  };
}

function tdStyle(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: `${spacing['3']} ${spacing['4']}`,
    verticalAlign: 'middle',
    ...extra,
  };
}

export default SpecParser;
