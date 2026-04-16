import React, { useState, useCallback } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}
interface Layouts { [breakpoint: string]: Layout[] }
import { GripVertical, Plus, RotateCcw, X } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { duration, easing } from '../../styles/animations';
import { widgetDefinitions, getWidgetDef } from './WidgetRegistry';
import { WeatherImpactWidget } from './widgets/WeatherImpactWidget';
import { LiveSiteWidget } from './widgets/LiveSiteWidget';
import { AIInsightsWidget } from './widgets/AIInsightsWidget';
import { CashFlowWidget } from './widgets/CashFlowWidget';
import { RiskHeatmapWidget } from './widgets/RiskHeatmapWidget';
import { ProductivityPulseWidget } from './widgets/ProductivityPulseWidget';
import { MilestoneTimelineWidget } from './widgets/MilestoneTimelineWidget';
import { PhotoFeedWidget } from './widgets/PhotoFeedWidget';
import { BIMPreviewWidget } from './widgets/BIMPreviewWidget';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const widgetComponents: Record<string, React.FC> = {
  'weather-impact': WeatherImpactWidget,
  'live-site': LiveSiteWidget,
  'ai-insights': AIInsightsWidget,
  'cash-flow': CashFlowWidget,
  'risk-heatmap': RiskHeatmapWidget,
  'productivity-pulse': ProductivityPulseWidget,
  'milestone-timeline': MilestoneTimelineWidget,
  'photo-feed': PhotoFeedWidget,
  'bim-preview': BIMPreviewWidget,
};

const STORAGE_KEY = 'sitesync-dashboard-layout';
const WIDGETS_KEY = 'sitesync-dashboard-widgets';

const defaultWidgets = [
  'weather-impact',
  'ai-insights',
  'live-site',
  'cash-flow',
  'risk-heatmap',
  'productivity-pulse',
  'milestone-timeline',
  'photo-feed',
  'bim-preview',
];

function getDefaultLayout(widgets: string[]): Layout[] {
  let x = 0;
  let y = 0;
  return widgets.map((type) => {
    const def = getWidgetDef(type);
    const w = def?.defaultW ?? 4;
    const h = def?.defaultH ?? 3;

    if (x + w > 12) {
      x = 0;
      y += h;
    }

    const item: Layout = {
      i: type,
      x,
      y,
      w,
      h,
      minW: def?.minW ?? 2,
      minH: def?.minH ?? 2,
    };
    x += w;
    return item;
  });
}

function loadSavedLayout(): Layout[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function loadSavedWidgets(): string[] | null {
  try {
    const saved = localStorage.getItem(WIDGETS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

interface WidgetPickerProps {
  open: boolean;
  onClose: () => void;
  activeWidgets: string[];
  onAdd: (type: string) => void;
}

const WidgetPicker: React.FC<WidgetPickerProps> = ({ open, onClose, activeWidgets, onAdd }) => {
  if (!open) return null;
  const available = widgetDefinitions.filter((w) => !activeWidgets.includes(w.type));

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: zIndex.popover, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlayDark, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: '480px', maxWidth: '90vw', backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl, boxShadow: shadows.panel, overflow: 'hidden', animation: `scaleIn ${duration.normal}ms ${easing.apple}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Add Widget</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: spacing['3'], maxHeight: '400px', overflowY: 'auto' }}>
          {available.length === 0 && (
            <p style={{ padding: spacing['5'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>All widgets are already on your dashboard.</p>
          )}
          {available.map((widget) => (
            <button
              key={widget.type}
              onClick={() => { onAdd(widget.type); onClose(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: 'transparent', border: 'none',
                borderRadius: borderRadius.md, cursor: 'pointer', textAlign: 'left',
                fontFamily: typography.fontFamily, transition: `background-color ${transitions.instant}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
            >
              <span style={{ fontSize: typography.fontSize.large, width: 40, textAlign: 'center' }}>{widget.icon}</span>
              <div>
                <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, margin: 0 }}>{widget.label}</p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: 2 }}>{widget.description}</p>
              </div>
              <Plus size={16} color={colors.textTertiary} style={{ marginLeft: 'auto', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const DashboardGrid: React.FC = () => {
  const { width, containerRef } = useContainerWidth();
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => loadSavedWidgets() || defaultWidgets);
  const [layouts, setLayouts] = useState<Layouts>(() => {
    const saved = loadSavedLayout();
    return { lg: saved || getDefaultLayout(activeWidgets) };
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(() => localStorage.getItem('sitesync-tip-dismissed') === 'true');

  const handleLayoutChange = useCallback((_layout: unknown, allLayouts: unknown) => {
    setLayouts(allLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts.lg || _layout));
  }, []);

  const handleAddWidget = useCallback((type: string) => {
    const def = getWidgetDef(type);
    const newWidgets = [...activeWidgets, type];
    setActiveWidgets(newWidgets);
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(newWidgets));

    const currentLayout = layouts.lg || [];
    const maxY = currentLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const newItem: Layout = {
      i: type,
      x: 0,
      y: maxY,
      w: def?.defaultW ?? 4,
      h: def?.defaultH ?? 3,
      minW: def?.minW ?? 2,
      minH: def?.minH ?? 2,
    };
    const newLayout = [...currentLayout, newItem];
    setLayouts({ lg: newLayout });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  }, [activeWidgets, layouts]);

  const handleRemoveWidget = useCallback((type: string) => {
    const newWidgets = activeWidgets.filter((w) => w !== type);
    setActiveWidgets(newWidgets);
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(newWidgets));

    const newLayout = (layouts.lg || []).filter((item) => item.i !== type);
    setLayouts({ lg: newLayout });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newLayout));
  }, [activeWidgets, layouts]);

  const handleReset = useCallback(() => {
    setActiveWidgets(defaultWidgets);
    const layout = getDefaultLayout(defaultWidgets);
    setLayouts({ lg: layout });
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(defaultWidgets));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, []);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <button
          onClick={() => setPickerOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: colors.primaryOrange,
            color: colors.white, border: 'none', borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
            fontFamily: typography.fontFamily, cursor: 'pointer',
            transition: `background-color ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
        >
          <Plus size={14} />
          Add Widget
        </button>
        <button
          onClick={handleReset}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['3']}`, backgroundColor: 'transparent',
            color: colors.textTertiary, border: 'none', borderRadius: borderRadius.base,
            fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, cursor: 'pointer',
            transition: `color ${transitions.instant}`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
        >
          <RotateCcw size={14} />
          Reset Layout
        </button>
      </div>

      {/* Layout tip */}
      {!tipDismissed && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['2']} ${spacing['4']}`, marginBottom: spacing['3'],
          backgroundColor: colors.orangeSubtle, borderRadius: borderRadius.md,
        }}>
          <GripVertical size={14} color={colors.primaryOrange} />
          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Tip: Drag widgets to customize your layout. Resize from the bottom right corner.
          </span>
          <button
            onClick={() => { setTipDismissed(true); localStorage.setItem('sitesync-tip-dismissed', 'true'); }}
            style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid */}
      <div ref={containerRef}>
      <ResponsiveGridLayout
        width={width}
        layouts={layouts}
        breakpoints={{ lg: 996, md: 768, sm: 480 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={80}
        onLayoutChange={handleLayoutChange}
        onDragStart={() => setIsDragging(true)}
        onDragStop={() => setIsDragging(false)}
        containerPadding={[0, 0]}
        margin={[16, 16]}
        dragConfig={{ enabled: true, handle: ".widget-drag-handle" }}
        resizeConfig={{ enabled: true }}
      >
        {activeWidgets.map((type) => {
          const WidgetComponent = widgetComponents[type];
          if (!WidgetComponent) return null;

          return (
            <div key={type}>
              <div
                style={{
                  height: '100%',
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.xl,
                  boxShadow: isDragging ? shadows.cardHover : shadows.card,
                  border: `1px solid ${colors.borderSubtle}`,
                  padding: spacing['4'],
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: `box-shadow ${duration.normal}ms ${easing.standard}, transform ${duration.normal}ms ${easing.standard}`,
                }}
                onMouseEnter={(e) => {
                  if (!isDragging) {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.cardHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDragging) {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.card;
                  }
                }}
              >
                {/* Drag handle + remove */}
                <div
                  className="widget-drag-handle"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: spacing['1'],
                    cursor: 'grab',
                    marginTop: `-${spacing['1']}`,
                  }}
                >
                  <span title="Drag to rearrange"><GripVertical size={14} color={colors.borderDefault} /></span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveWidget(type); }}
                    style={{
                      width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.sm,
                      cursor: 'pointer', color: colors.textTertiary, opacity: 0.4,
                      transition: `opacity ${transitions.instant}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4'; }}
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Widget content */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <WidgetComponent />
                </div>
              </div>
            </div>
          );
        })}
      </ResponsiveGridLayout>
      </div>

      <WidgetPicker open={pickerOpen} onClose={() => setPickerOpen(false)} activeWidgets={activeWidgets} onAdd={handleAddWidget} />
    </div>
  );
};
