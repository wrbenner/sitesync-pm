import React, { useState } from 'react';
import { Plus, Trash2, HardHat } from 'lucide-react';
import { Card, Btn, Modal, InputField, EmptyState } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { useProjectId } from '../../hooks/useProjectId';
import { usePreTaskPlans, useCreatePreTaskPlan } from '../../hooks/queries/enterprise-modules';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

interface Hazard {
  hazard: string;
  control_measure: string;
  ppe_required: string;
}

interface PTP {
  id: string;
  date: string;
  crew_name: string | null;
  foreman: string | null;
  task_description: string;
  hazards: Hazard[];
  emergency_plan: string | null;
  status: string;
}

export const PreTaskPlansTab: React.FC = () => {
  const projectId = useProjectId();
  const { user } = useAuth();
  const { data: ptps, isLoading } = usePreTaskPlans(projectId ?? undefined);
  const createPtp = useCreatePreTaskPlan();
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    crew_name: '',
    foreman: '',
    task_description: '',
    emergency_plan: '',
    hazards: [{ hazard: '', control_measure: '', ppe_required: '' }] as Hazard[],
  });

  const list = (ptps ?? []) as unknown as PTP[];

  const addHazardRow = () => {
    setForm({ ...form, hazards: [...form.hazards, { hazard: '', control_measure: '', ppe_required: '' }] });
  };

  const removeHazardRow = (idx: number) => {
    setForm({ ...form, hazards: form.hazards.filter((_, i) => i !== idx) });
  };

  const updateHazard = (idx: number, field: keyof Hazard, value: string) => {
    const newHazards = [...form.hazards];
    newHazards[idx] = { ...newHazards[idx], [field]: value };
    setForm({ ...form, hazards: newHazards });
  };

  const handleSubmit = async () => {
    if (!projectId || !form.task_description) {
      toast.error('Task description required');
      return;
    }
    try {
      await createPtp.mutateAsync({
        project_id: projectId,
        date: form.date,
        crew_name: form.crew_name || null,
        foreman: form.foreman || null,
        task_description: form.task_description,
        hazards: form.hazards.filter((h) => h.hazard),
        emergency_plan: form.emergency_plan || null,
        status: 'active',
        created_by: user?.id,
      });
      toast.success('Pre-Task Plan created');
      setModalOpen(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        crew_name: '', foreman: '', task_description: '', emergency_plan: '',
        hazards: [{ hazard: '', control_measure: '', ppe_required: '' }],
      });
    } catch (err) {
      toast.error('Failed: ' + ((err as Error).message || 'unknown'));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
        <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold }}>Pre-Task Plans</h3>
        <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setModalOpen(true)} style={{ minHeight: 56 }}>New PTP</Btn>
      </div>

      {isLoading ? (
        <Card><p style={{ color: colors.textTertiary }}>Loading...</p></Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<HardHat size={48} />} title="No Pre-Task Plans" description="Pre-Task Plans (PTPs) document hazards and controls before starting work." />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {list.map((ptp) => (
            <Card key={ptp.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
                <div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{ptp.task_description}</p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {new Date(ptp.date).toLocaleDateString()} • {ptp.crew_name || 'No crew'} • Foreman: {ptp.foreman || 'N/A'}
                  </p>
                </div>
                <span style={{
                  padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  color: ptp.status === 'active' ? colors.statusActive : colors.textTertiary,
                  backgroundColor: ptp.status === 'active' ? colors.statusActiveSubtle : colors.surfaceInset,
                }}>{ptp.status}</span>
              </div>
              {ptp.hazards && ptp.hazards.length > 0 && (
                <div style={{ marginTop: spacing['2'] }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
                    {ptp.hazards.length} hazards identified
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Pre-Task Plan" width="700px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <InputField label="Crew" value={form.crew_name} onChange={(v) => setForm({ ...form, crew_name: v })} placeholder="e.g. Crew A" />
            <InputField label="Foreman" value={form.foreman} onChange={(v) => setForm({ ...form, foreman: v })} placeholder="Name" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Task Description</label>
            <textarea
              value={form.task_description}
              onChange={(e) => setForm({ ...form, task_description: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['2'] }}>
              <h4 style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium }}>Hazards & Controls</h4>
              <Btn variant="ghost" onClick={addHazardRow}>+ Add hazard</Btn>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {form.hazards.map((h, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: spacing['2'], padding: spacing['2'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
                  <InputField value={h.hazard} onChange={(v) => updateHazard(idx, 'hazard', v)} placeholder="Hazard" />
                  <InputField value={h.control_measure} onChange={(v) => updateHazard(idx, 'control_measure', v)} placeholder="Control measure" />
                  <InputField value={h.ppe_required} onChange={(v) => updateHazard(idx, 'ppe_required', v)} placeholder="PPE" />
                  <button
                    onClick={() => removeHazardRow(idx)}
                    disabled={form.hazards.length === 1}
                    style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: colors.statusCritical, opacity: form.hazards.length === 1 ? 0.3 : 1 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Emergency Plan</label>
            <textarea
              value={form.emergency_plan}
              onChange={(e) => setForm({ ...form, emergency_plan: e.target.value })}
              rows={2}
              placeholder="Meeting point, emergency contacts, etc."
              style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.base, border: `1px solid ${colors.borderLight}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} loading={createPtp.isPending}>Create</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};
