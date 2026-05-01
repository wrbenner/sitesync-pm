/**
 * JobProgressView — pulls live import_jobs rows for the current org
 * and renders ImportJobProgress for each.
 */

import React, { useEffect, useState } from 'react';
import { Eyebrow } from '../../../components/atoms';
import { ImportJobProgress, type ImportJobRow } from '../../../components/integrations/ImportJobProgress';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { colors, typography } from '../../../styles/theme';

export const JobProgressView: React.FC = () => {
  const { company } = useAuthStore();
  const [jobs, setJobs] = useState<ImportJobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!company?.id) {
        setJobs([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('import_jobs')
        .select('id, status, total_count, processed_count, error_log, started_at, completed_at')
        .eq('organization_id', company.id)
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (!error && data) setJobs(data as ImportJobRow[]);
      setLoading(false);
    }
    load();
    const handle = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [company?.id]);

  if (loading) {
    return (
      <p style={{ fontFamily: typography.fontFamily.serif, fontStyle: 'italic', color: colors.textTertiary }}>
        Loading jobs…
      </p>
    );
  }
  if (jobs.length === 0) {
    return (
      <p style={{ fontFamily: typography.fontFamily.serif, fontStyle: 'italic', color: colors.textTertiary }}>
        No import jobs yet for this organization.
      </p>
    );
  }
  return (
    <div>
      <Eyebrow>Recent jobs</Eyebrow>
      {jobs.map((j) => (
        <ImportJobProgress key={j.id} job={j} />
      ))}
    </div>
  );
};
