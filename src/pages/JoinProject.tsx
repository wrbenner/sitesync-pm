import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { acceptInvitation } from '../api/endpoints/subInvitations';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { Btn } from '../components/Primitives';
import { CheckCircle, AlertTriangle, Loader2, HardHat, ArrowRight } from 'lucide-react';

type Phase = 'validating' | 'needs_auth' | 'ready' | 'accepting' | 'success' | 'error';

const JoinProject: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('validating');
  const [error, setError] = useState('');
  const [projectName, setProjectName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviterEmail, setInviterEmail] = useState('');
  const [resultRole, setResultRole] = useState('');
  const [resultProjectId, setResultProjectId] = useState('');

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token found.');
      setPhase('error');
      return;
    }

    (async () => {
      try {
        const { data: invitation, error: fetchError } = await supabase
          .from('portal_invitations')
          .select('*, projects!inner(id, name)')
          .eq('token', token)
          .single();

        if (fetchError || !invitation) {
          setError('This invitation link is invalid or has already been used.');
          setPhase('error');
          return;
        }

        if (invitation.accepted) {
          setError('This invitation has already been accepted.');
          setPhase('error');
          return;
        }

        if (new Date(invitation.expires_at) < new Date()) {
          setError('This invitation has expired. Ask the project manager to send a new one.');
          setPhase('error');
          return;
        }

        const project = invitation.projects as { id: string; name: string };
        const perms = (invitation.permissions ?? {}) as Record<string, unknown>;
        setProjectName(project.name);
        setCompanyName((perms.company_name as string) ?? '');
        setEmail(invitation.email ?? '');

        // Check if user is already authenticated
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          setPhase('ready');
        } else {
          setPhase('needs_auth');
        }
      } catch {
        setError('Something went wrong validating your invitation.');
        setPhase('error');
      }
    })();
  }, [token]);

  const handleAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName } },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      setPhase('ready');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setAuthLoading(false);
    }
  }, [email, password, firstName, lastName, isSignUp]);

  const handleAccept = useCallback(async () => {
    if (!token) return;
    setPhase('accepting');
    try {
      const result = await acceptInvitation(token);
      setResultRole(result.role);
      setResultProjectId(result.projectId);
      setProjectName(result.projectName);
      setPhase('success');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceBase,
      padding: spacing['4'],
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.lg,
        padding: spacing['8'],
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: spacing['6'] }}>
          <HardHat size={40} color={colors.primary} style={{ marginBottom: spacing['3'] }} />
          <h1 style={{
            fontSize: typography.fontSize.h3,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
          }}>
            SiteSync PM
          </h1>
        </div>

        {/* Validating */}
        {phase === 'validating' && (
          <div style={{ textAlign: 'center', padding: spacing['8'] }}>
            <Loader2 size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: colors.textSecondary, marginTop: spacing['3'] }}>Validating your invitation...</p>
          </div>
        )}

        {/* Needs Auth */}
        {phase === 'needs_auth' && (
          <div>
            <div style={{
              textAlign: 'center',
              marginBottom: spacing['6'],
              padding: spacing['4'],
              backgroundColor: colors.orangeSubtle,
              borderRadius: borderRadius.lg,
            }}>
              <p style={{ margin: 0, fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>
                You have been invited to <strong>{projectName}</strong>
              </p>
              {companyName && (
                <p style={{ margin: 0, marginTop: spacing['1'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  as {companyName}
                </p>
              )}
            </div>

            <h2 style={{
              fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              marginBottom: spacing['4'],
            }}>
              {isSignUp ? 'Create your account' : 'Sign in to continue'}
            </h2>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {isSignUp && (
                <div style={{ display: 'flex', gap: spacing['3'] }}>
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
              )}
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder={isSignUp ? 'Create a password (8+ characters)' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
              />
              {authError && (
                <p style={{ color: colors.statusCritical, fontSize: typography.fontSize.sm, margin: 0 }}>
                  {authError}
                </p>
              )}
              <Btn
                variant="primary"
                type="submit"
                disabled={authLoading}
                style={{ width: '100%', minHeight: 56, fontSize: typography.fontSize.body }}
              >
                {authLoading ? 'Please wait...' : isSignUp ? 'Create Account & Join Project' : 'Sign In & Join Project'}
              </Btn>
            </form>

            <button
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
              style={{
                marginTop: spacing['4'],
                background: 'none',
                border: 'none',
                color: colors.primary,
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                textAlign: 'center',
                width: '100%',
              }}
            >
              {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </button>
          </div>
        )}

        {/* Ready to accept */}
        {phase === 'ready' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: spacing['5'],
              backgroundColor: colors.orangeSubtle,
              borderRadius: borderRadius.lg,
              marginBottom: spacing['5'],
            }}>
              <p style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Join {projectName}
              </p>
              {companyName && (
                <p style={{ margin: 0, marginTop: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  as {companyName}
                </p>
              )}
            </div>
            <p style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: spacing['5'] }}>
              You will have access to project plans, RFIs, submittals, and more.
            </p>
            <Btn
              variant="primary"
              onClick={handleAccept}
              style={{ width: '100%', minHeight: 56, fontSize: typography.fontSize.body }}
              icon={<ArrowRight size={18} />}
            >
              Accept Invitation
            </Btn>
          </div>
        )}

        {/* Accepting */}
        {phase === 'accepting' && (
          <div style={{ textAlign: 'center', padding: spacing['8'] }}>
            <Loader2 size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: colors.textSecondary, marginTop: spacing['3'] }}>Joining project...</p>
          </div>
        )}

        {/* Success */}
        {phase === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} color={colors.statusActive} style={{ marginBottom: spacing['4'] }} />
            <h2 style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              marginBottom: spacing['2'],
            }}>
              Welcome to {projectName}
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: spacing['5'] }}>
              You have joined as {resultRole.replace(/_/g, ' ')}. You can now view plans, submit RFIs, and track your work.
            </p>
            <Btn
              variant="primary"
              onClick={() => navigate(`/projects/${resultProjectId}/dashboard`)}
              style={{ width: '100%', minHeight: 56, fontSize: typography.fontSize.body }}
              icon={<ArrowRight size={18} />}
            >
              Go to Project
            </Btn>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={48} color={colors.statusCritical} style={{ marginBottom: spacing['4'] }} />
            <h2 style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              marginBottom: spacing['2'],
            }}>
              Invitation Error
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm, marginBottom: spacing['5'] }}>
              {error}
            </p>
            <Btn
              variant="secondary"
              onClick={() => navigate('/login')}
              style={{ width: '100%', minHeight: 56 }}
            >
              Go to Login
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${spacing['3']} ${spacing['4']}`,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceBase,
  outline: 'none',
  minHeight: 56,
  boxSizing: 'border-box',
};

export default JoinProject;
