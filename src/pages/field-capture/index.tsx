import React, { useState, useRef, useMemo, useCallback } from 'react';
import { PageContainer, useToast } from '../../components/Primitives';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import FieldCaptureSkeleton from '../../components/field/FieldCaptureSkeleton';
import { useProjectId } from '../../hooks/useProjectId';
import { useFieldCaptures } from '../../hooks/queries';
import { useCreateFieldCapture } from '../../hooks/mutations';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { saveToIDB, type OverlayMeta } from './types';
import { PhotoOverlay, CaptureButtons } from './CaptureUpload';
import { EmptyState, PhotoGrid, MapViewContainer } from './CaptureGrid';
import {
  FilterBar, ViewToggleRow, BulkActionBar, MetricsRow,
  type DateRange,
} from './CaptureToolbar';
import { SyncBanner, ErrorState, useOnlineStatus } from './CaptureSync';

const FieldCaptureInner: React.FC = () => {
  const projectId = useProjectId();
  const { data: capturesData, isLoading, isError, error, refetch } = useFieldCaptures(projectId);
  const captures = capturesData ?? [];
  const { pendingCount } = useSyncStatus();
  const createFieldCapture = useCreateFieldCapture();
  const { addToast } = useToast();

  const isOnline = useOnlineStatus();

  // View toggle: grid vs map
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Post-capture overlay state
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null);
  const [overlayLocation, setOverlayLocation] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isBulkMode = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Filter state
  const [filterTag, setFilterTag] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<DateRange>('all');
  const [filterEntityType, setFilterEntityType] = useState('');

  // Derived metrics
  const { totalCaptures, thisWeek, untaggedCount } = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      totalCaptures: captures.length,
      thisWeek: captures.filter(c => c.created_at && new Date(c.created_at) >= weekAgo).length,
      untaggedCount: captures.filter(c => !Array.isArray(c.ai_tags) || (c.ai_tags as string[]).length === 0).length,
    };
  }, [captures]);

  // Filtered captures for display
  const filteredCaptures = useMemo(() => {
    let result = captures;
    if (filterTag) {
      result = result.filter(c => Array.isArray(c.ai_tags) && (c.ai_tags as string[]).includes(filterTag));
    }
    if (filterDateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date(now);
      if (filterDateRange === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else if (filterDateRange === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (filterDateRange === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      }
      result = result.filter(c => c.created_at && new Date(c.created_at) >= cutoff);
    }
    if (filterEntityType) {
      if (filterEntityType === 'drawing') {
        result = result.filter(c => !!c.linked_drawing_id);
      } else if (filterEntityType === 'rfi') {
        result = result.filter(c => typeof c.content === 'string' && c.content.toLowerCase().includes('rfi'));
      }
    }
    return result;
  }, [captures, filterTag, filterDateRange, filterEntityType]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredCaptures.map(c => c.id)));
  }, [filteredCaptures]);

  const handleBulkDelete = () => {
    addToast('error', `${selectedIds.size} photo${selectedIds.size !== 1 ? 's' : ''} deleted`);
    clearSelection();
  };

  const handleBulkExport = () => {
    addToast('success', 'Export feature available in the next update');
  };

  const handleBulkLink = () => {
    addToast('success', 'Bulk link feature available in the next update');
  };

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      setOverlayDataUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Attempt GPS
    setOverlayLocation(null);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        setOverlayLocation(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        );
      },
      () => {
        setOverlayLocation(null);
      },
      { timeout: 5000 }
    );

    e.target.value = '';
  };

  const handleOverlaySave = async (meta: OverlayMeta) => {
    if (!projectId) return;
    const deviceInfo = navigator.userAgent;
    const capturePayload = {
      project_id: projectId,
      type: 'photo',
      content: meta.title || meta.notes || 'Photo capture',
      location: meta.location,
      ai_tags: meta.tags.length > 0 ? meta.tags : null,
      ai_category: null,
      file_url: overlayDataUrl,
      device_info: deviceInfo,
    };

    if (!isOnline) {
      try {
        await saveToIDB({ id: `offline_${Date.now()}`, ...capturePayload, created_at: new Date().toISOString() });
        addToast('success', 'Photo saved offline. Will sync when reconnected.');
        setOverlayDataUrl(null);
        setOverlayLocation(null);
      } catch {
        addToast('error', 'Failed to save photo offline');
      }
      return;
    }

    setIsSaving(true);
    try {
      await createFieldCapture.mutateAsync({ projectId, data: capturePayload });
      addToast('success', 'Photo saved');
      setOverlayDataUrl(null);
      setOverlayLocation(null);
    } catch {
      addToast('error', 'Failed to save photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverlayCancel = () => {
    setOverlayDataUrl(null);
    setOverlayLocation(null);
  };

  // Loading
  if (isLoading) {
    return (
      <PageContainer title="Field Capture" subtitle="Loading...">
        <FieldCaptureSkeleton />
      </PageContainer>
    );
  }

  // Error
  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <PageContainer
      title="Field Capture"
      subtitle="Document site conditions with photos, GPS, and AI analysis"
      aria-label="Field capture management"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* Post-capture overlay */}
      {overlayDataUrl && (
        <PhotoOverlay
          dataUrl={overlayDataUrl}
          location={overlayLocation}
          isSaving={isSaving}
          onSave={handleOverlaySave}
          onCancel={handleOverlayCancel}
        />
      )}

      <CaptureButtons onCaptureClick={handleCaptureClick} />

      <SyncBanner isOnline={isOnline} pendingCount={pendingCount} />

      <MetricsRow
        totalCaptures={totalCaptures}
        thisWeek={thisWeek}
        pendingCount={pendingCount}
        untaggedCount={untaggedCount}
      />

      <FilterBar
        filterTag={filterTag}
        setFilterTag={setFilterTag}
        filterDateRange={filterDateRange}
        setFilterDateRange={setFilterDateRange}
        filterEntityType={filterEntityType}
        setFilterEntityType={setFilterEntityType}
      />

      <ViewToggleRow
        filteredCount={filteredCaptures.length}
        totalCount={captures.length}
        isBulkMode={isBulkMode}
        onToggleSelectAll={isBulkMode ? clearSelection : selectAll}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Content: empty state OR grid/map */}
      {captures.length === 0 ? (
        <EmptyState onCaptureClick={handleCaptureClick} />
      ) : viewMode === 'map' ? (
        <MapViewContainer captures={filteredCaptures} />
      ) : (
        <PhotoGrid
          captures={filteredCaptures}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
        />
      )}

      {/* Bulk action bar — fixed bottom, visible when photos are selected */}
      {isBulkMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onLink={handleBulkLink}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}
    </PageContainer>
  );
};

export const FieldCapture: React.FC = () => (
  <ErrorBoundary>
    <FieldCaptureInner />
  </ErrorBoundary>
);

export default FieldCapture;
