import React, { useState, useEffect } from 'react';
import { Save, Users, Building2 } from 'lucide-react';
import { useProjectContext } from '../../stores/projectContextStore';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

interface MemberWithProfile {
  profile?: { first_name?: string; last_name?: string };
}

export function ProjectSettings() {
  const { activeProject, updateProject, members, loadMembers } = useProjectContext();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.name);
      setAddress(activeProject.address ?? '');
      setProjectType(activeProject.project_type ?? '');
      setTotalValue(activeProject.total_value?.toString() ?? '');
      setDescription(activeProject.description ?? '');
      setStartDate(activeProject.start_date ?? '');
      setEndDate(activeProject.scheduled_end_date ?? '');
      loadMembers(activeProject.id);
    }
  }, [activeProject?.id]);

  const handleSave = async () => {
    if (!activeProject) return;
    setSaving(true);
    await updateProject(activeProject.id, {
      name,
      address: address || null,
      project_type: projectType || null,
      total_value: totalValue ? parseFloat(totalValue) : null,
      description: description || null,
      start_date: startDate || null,
      scheduled_end_date: endDate || null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['2']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base,
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    boxSizing: 'border-box',
    transition: `border-color ${transitions.quick}`,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing['1'],
    letterSpacing: typography.letterSpacing.wide,
  };

  if (!activeProject) {
    return (
      <div style={{
        maxWidth: '800px', margin: '0 auto', padding: `${spacing['10']} ${spacing['6']}`,
        textAlign: 'center', color: colors.textTertiary, fontFamily: typography.fontFamily,
      }}>
        No active project selected.
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: `${spacing['8']} ${spacing['6']}`,
      fontFamily: typography.fontFamily,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing['8'],
      }}>
        <div>
          <h1 style={{
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            letterSpacing: typography.letterSpacing.tight,
            margin: 0,
          }}>
            Project Settings
          </h1>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            marginTop: spacing['1'],
          }}>
            Configure {activeProject.name}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['5']}`,
            backgroundColor: saved ? colors.statusActive : colors.primaryOrange,
            color: colors.white,
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: `background-color ${transitions.quick}`,
          }}
        >
          <Save size={16} />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Project Details Card */}
      <div style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
        padding: spacing['6'],
        marginBottom: spacing['6'],
      }}>
        <h2 style={{
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: `0 0 ${spacing['5']} 0`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
        }}>
          <Building2 size={18} color={colors.primaryOrange} />
          Project Details
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['5'] }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="1200 Main Street, Dallas, TX"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
          <div>
            <label style={labelStyle}>Project Type</label>
            <input
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              placeholder="Commercial, Residential, Mixed Use..."
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
          <div>
            <label style={labelStyle}>Total Value ($)</label>
            <input
              type="number"
              value={totalValue}
              onChange={(e) => setTotalValue(e.target.value)}
              placeholder="47500000"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
          <div>
            <label style={labelStyle}>Scheduled End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project scope..."
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
              }}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
        </div>
      </div>

      {/* Team Members Card */}
      <div style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
        padding: spacing['6'],
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing['5'],
        }}>
          <h2 style={{
            fontSize: typography.fontSize.title,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
          }}>
            <Users size={18} color={colors.primaryOrange} />
            Project Team
          </h2>
          <span style={{
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
          }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>

        {members.length === 0 ? (
          <div style={{
            padding: spacing['8'],
            textAlign: 'center',
            color: colors.textTertiary,
            fontSize: typography.fontSize.sm,
          }}>
            No team members assigned. Add members from the Team page.
          </div>
        ) : (
          <div>
            {members.map((member, i) => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: `${spacing['3']} 0`,
                  borderBottom: i < members.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: borderRadius.full,
                  backgroundColor: colors.orangeSubtle,
                  color: colors.orangeText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  marginRight: spacing['3'],
                }}>
                  {member.user_id?.substring(0, 2).toUpperCase() ?? '??'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    color: colors.textPrimary,
                  }}>
                    {(member as unknown as MemberWithProfile).profile?.first_name ?? 'Team'} {(member as unknown as MemberWithProfile).profile?.last_name ?? 'Member'}
                  </div>
                </div>
                <div style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  textTransform: 'capitalize',
                }}>
                  {member.role.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
