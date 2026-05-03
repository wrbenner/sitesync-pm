import React, { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, DollarSign, Plus, Building2, HardHat,
} from 'lucide-react';
import { PageContainer } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { duration, easing } from '../../styles/animations';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useProjectStore } from '../../stores/projectStore';
import { logAuditEntry } from '../../lib/auditLogger';
import { ensureOrganizationMembership } from '../../lib/ensureOrganizationMembership';
import { staggerContainer, staggerItem, staggerTransition } from './types';

const CreateProjectModal = lazy(() => import('../../components/forms/CreateProjectModal'));

export const WelcomeOnboarding: React.FC<{ onProjectCreated: () => void }> = ({ onProjectCreated }) => {
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const handleSubmit = async (data: Record<string, unknown>) => {
    // Ensure the user has an active organization and is a member of it.
    // Self-heals users whose onboarding never created an org membership row.
    const orgId = user?.id ? await ensureOrganizationMembership(user.id) : null;
    if (!orgId) {
      toast.error('Failed to create project: no active organization. Please sign out and back in.');
      return;
    }

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: data.name as string,
        organization_id: orgId,
        address: (data.address as string) || null,
        city: (data.city as string) || null,
        state: (data.state as string) || null,
        project_type: (data.project_type as string) || null,
        contract_value: data.contract_value ? Number(data.contract_value) : null,
        start_date: (data.start_date as string) || null,
        target_completion: (data.target_completion as string) || null,
        description: (data.description as string) || null,
        status: 'active',
        owner_id: user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      toast.error(`Failed to create project: ${error.message}`);
      return;
    }

    // Add creator as project manager — critical for RBAC access
    if (user?.id && newProject) {
      const { error: memberError } = await supabase.from('project_members').insert({
        project_id: newProject.id,
        user_id: user.id,
        role: 'project_manager',
        accepted_at: new Date().toISOString(),
      });
      if (memberError) {
        console.error('Failed to add project member:', memberError);
        toast.error('Project created but failed to set you as project manager. Please contact support.');
      }
    }

    // Audit trail: project creation is a governance event
    if (newProject) {
      logAuditEntry({
        projectId: newProject.id,
        entityType: 'project',
        entityId: newProject.id,
        action: 'create',
        afterState: {
          name: newProject.name,
          status: newProject.status,
          owner_id: newProject.owner_id,
          project_type: newProject.project_type,
          contract_value: newProject.contract_value,
        },
      }).catch(() => {})
    }

    // Set as active project and refresh queries
    if (newProject) {
      useProjectStore.getState().setActiveProject(newProject.id);
      // Update store projects list directly
      useProjectStore.setState((s) => ({
        projects: [newProject, ...s.projects],
        activeProject: newProject,
        activeProjectId: newProject.id,
      }));
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
      setShowModal(false);
      onProjectCreated();
    }
  };

  return (
    <PageContainer>
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reducedMotion ? undefined : { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: spacing['8'],
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: borderRadius.xl,
            backgroundColor: colors.primaryOrange,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['6'],
            boxShadow: shadows.glow,
          }}
        >
          <HardHat size={40} color={colors.white} />
        </div>

        <h1
          style={{
            fontSize: typography.fontSize['4xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing['3'],
            letterSpacing: typography.letterSpacing.tight,
          }}
        >
          Welcome to SiteSync PM
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.subtitle,
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing['8'],
            maxWidth: 480,
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          The construction management platform that thinks like a 30 year veteran superintendent.
          Create your first project to get started.
        </p>

        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['4']} ${spacing['8']}`,
            minHeight: 56,
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.lg,
            fontSize: typography.fontSize.subtitle,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${colors.brand400}66`,
            transition: `transform ${duration.fast}ms ${easing.standard}, box-shadow ${duration.fast}ms ${easing.standard}`,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(-2px)';
            el.style.boxShadow = `0 6px 20px ${colors.brand400}80`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.transform = 'translateY(0)';
            el.style.boxShadow = `0 4px 12px ${colors.brand400}66`;
          }}
        >
          <Plus size={20} />
          Create Your First Project
        </button>

        <motion.div
          style={{
            display: 'flex',
            gap: spacing['8'],
            marginTop: spacing['12'],
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
          variants={staggerContainer}
          initial={reducedMotion ? undefined : 'initial'}
          animate={reducedMotion ? undefined : 'animate'}
        >
          {[
            { icon: <Building2 size={20} />, label: 'RFIs, Submittals, Change Orders' },
            { icon: <Calendar size={20} />, label: 'Schedule and Daily Logs' },
            { icon: <DollarSign size={20} />, label: 'Budget and Payment Tracking' },
          ].map((item) => (
            <motion.div
              key={item.label}
              variants={staggerItem}
              transition={staggerTransition}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                color: colors.textTertiary,
                fontSize: typography.fontSize.sm,
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <Suspense fallback={null}>
        {showModal && (
          <CreateProjectModal
            open={showModal}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
          />
        )}
      </Suspense>
    </PageContainer>
  );
};
