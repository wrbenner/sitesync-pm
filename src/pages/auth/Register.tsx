import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle,
  Building2, ArrowRight,
  HardHat, BarChart3, FileCheck, Cloud,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

/* ─────────────────────── Helpers ─────────────────────── */

const APPLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: colors.borderSubtle };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;

  if (s <= 1) return { score: 1, label: 'Weak', color: colors.statusCritical };
  if (s <= 2) return { score: 2, label: 'Fair', color: colors.statusPending };
  if (s <= 3) return { score: 3, label: 'Good', color: colors.statusInfo };
  return { score: 4, label: 'Strong', color: colors.statusActive };
}

const FEATURES = [
  { icon: HardHat, label: 'Project Management', desc: 'RFIs, submittals, and change orders' },
  { icon: BarChart3, label: 'Real-Time Analytics', desc: 'Budget tracking and schedule insights' },
  { icon: FileCheck, label: 'Punch Lists', desc: 'Photo-attached, location-tagged items' },
  { icon: Cloud, label: 'AI-Powered', desc: 'Weather forecasts and risk analysis' },
];

/* ─────────────────────── Sub-components ─────────────────────── */

const PremiumInput: React.FC<{
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  rightElement?: React.ReactNode;
}> = ({ id, type = 'text', label, value, onChange, placeholder, icon, required, autoComplete, autoFocus, rightElement }) => {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          color: focused ? colors.textPrimary : colors.textSecondary,
          marginBottom: spacing['1.5'],
          transition: 'color 120ms ease',
          letterSpacing: typography.letterSpacing.wide,
        }}
      >
        {label}{required && <span style={{ color: colors.primaryOrange, marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)',
            color: focused ? colors.primaryOrange : colors.textTertiary,
            transition: 'color 120ms ease', display: 'flex', pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          id={id} type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          autoComplete={autoComplete} autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', height: 48,
            padding: `0 ${rightElement ? '44px' : spacing['4']} 0 ${icon ? '40px' : spacing['4']}`,
            fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${focused ? colors.primaryOrange : colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            outline: 'none',
            boxShadow: focused ? `0 0 0 3px ${colors.orangeSubtle}` : 'none',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            boxSizing: 'border-box' as const,
          }}
        />
        {rightElement && (
          <span style={{
            position: 'absolute', right: spacing['3'], top: '50%', transform: 'translateY(-50%)',
            display: 'flex',
          }}>
            {rightElement}
          </span>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────── Main Component ─────────────────────── */

export function Register() {
  const navigate = useNavigate();
  const { signUp, createCompany, loading } = useAuthStore();
  const [step, setStep] = useState<'account' | 'company'>('account');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    const result = await signUp(email, password, firstName, lastName);
    if (result.error) setError(result.error);
    else setStep('company');
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName) {
      setError('Please enter your company name.');
      return;
    }
    const result = await createCompany(companyName);
    if (result.error) setError(result.error);
    else navigate('/dashboard');
  };

  const pwStrength = getPasswordStrength(password);

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%', height: 48,
    padding: `0 ${spacing['6']}`,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily,
    color: colors.white,
    background: loading
      ? colors.orangeHover
      : `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
    border: 'none',
    borderRadius: borderRadius.md,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 160ms ease',
    opacity: loading ? 0.8 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: spacing['2'],
    boxShadow: loading ? 'none' : '0 2px 8px rgba(244, 120, 32, 0.25)',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: typography.fontFamily,
    }}>
      <style>{`
        @keyframes float-glow { 0%, 100% { opacity: 0.4; transform: translateY(0); } 50% { opacity: 0.7; transform: translateY(-8px); } }
      `}</style>

      {/* ─── Left Panel — Brand ─── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: spacing['12'],
        background: 'linear-gradient(145deg, #1A1613 0%, #2A1F16 50%, #1A1613 100%)',
        position: 'relative', overflow: 'hidden', minHeight: '100vh',
      }}>
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244, 120, 32, 0.12) 0%, transparent 70%)',
          top: '20%', left: '30%',
          animation: 'float-glow 6s ease-in-out infinite', pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: APPLE_EASE }}
          style={{ position: 'relative', zIndex: 1, maxWidth: 440, width: '100%' }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: borderRadius.xl,
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing['8'],
            boxShadow: '0 4px 20px rgba(244, 120, 32, 0.3)',
          }}>
            <span style={{ color: colors.white, fontSize: typography.fontSize.medium, fontWeight: typography.fontWeight.bold }}>S</span>
          </div>

          <h1 style={{
            fontSize: '36px', fontWeight: typography.fontWeight.bold,
            color: '#FFFFFF', margin: 0,
            letterSpacing: typography.letterSpacing.tighter,
            lineHeight: typography.lineHeight.tight,
          }}>
            Build smarter.
            <br />
            <span style={{ color: colors.primaryOrange }}>Ship faster.</span>
          </h1>

          <p style={{
            fontSize: typography.fontSize.title, color: 'rgba(255,255,255,0.55)',
            margin: 0, marginTop: spacing['4'],
            lineHeight: typography.lineHeight.relaxed, maxWidth: 360,
          }}>
            Construction management powered by real-time data and AI insights.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginTop: spacing['10'] }}>
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.4, ease: APPLE_EASE }}
                style={{
                  padding: spacing['4'], borderRadius: borderRadius.lg,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <feat.icon size={20} color={colors.primaryOrange} strokeWidth={1.5} />
                <p style={{ margin: 0, marginTop: spacing['2'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: 'rgba(255,255,255,0.85)' }}>
                  {feat.label}
                </p>
                <p style={{ margin: 0, marginTop: 2, fontSize: typography.fontSize.caption, color: 'rgba(255,255,255,0.4)' }}>
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── Right Panel — Registration ─── */}
      <div style={{
        width: 520, minWidth: 420,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: `${spacing['10']} ${spacing['12']}`,
        backgroundColor: colors.surfacePage,
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Header */}
              <div style={{ marginBottom: spacing['6'] }}>
                <h2 style={{
                  fontSize: typography.fontSize.large,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                  letterSpacing: typography.letterSpacing.tight,
                }}>
                  {step === 'account' ? 'Create your account' : 'Set up your company'}
                </h2>
                <p style={{
                  fontSize: typography.fontSize.body,
                  color: colors.textTertiary,
                  margin: 0, marginTop: spacing['1.5'],
                }}>
                  {step === 'account'
                    ? 'Start managing your projects with AI'
                    : 'Your team will be organized under this company'
                  }
                </p>
              </div>

              {/* Step indicator */}
              <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['6'] }}>
                {['account', 'company'].map((s, i) => (
                  <div key={s} style={{
                    flex: 1, height: 3, borderRadius: borderRadius.full,
                    backgroundColor: i <= (step === 'account' ? 0 : 1) ? colors.primaryOrange : colors.borderSubtle,
                    transition: `background-color ${transitions.quick}`,
                  }} />
                ))}
              </div>

              {/* Card */}
              <div style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.xl,
                boxShadow: shadows.card,
                padding: spacing['7'],
                border: `1px solid ${colors.borderSubtle}`,
              }}>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: spacing['3'], borderRadius: borderRadius.md,
                        backgroundColor: colors.statusCriticalSubtle,
                        color: colors.statusCritical,
                        fontSize: typography.fontSize.sm,
                        marginBottom: spacing['4'],
                      }}
                    >
                      <AlertCircle size={16} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {step === 'account' ? (
                  <form onSubmit={handleAccountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
                      <PremiumInput
                        id="reg-first" label="First name"
                        value={firstName} onChange={setFirstName}
                        placeholder="John" icon={<User size={16} />}
                        required autoFocus
                      />
                      <PremiumInput
                        id="reg-last" label="Last name"
                        value={lastName} onChange={setLastName}
                        placeholder="Smith" required
                      />
                    </div>

                    <PremiumInput
                      id="reg-email" type="email" label="Work email"
                      value={email} onChange={setEmail}
                      placeholder="john@construction.com"
                      icon={<Mail size={16} />} required autoComplete="email"
                    />

                    <div>
                      <PremiumInput
                        id="reg-password" type={showPassword ? 'text' : 'password'}
                        label="Password" value={password}
                        onChange={setPassword}
                        placeholder="Minimum 8 characters"
                        icon={<Lock size={16} />} required autoComplete="new-password"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: 0, display: 'flex', color: colors.textTertiary,
                            }}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                      />
                      {password && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          style={{ marginTop: spacing['1.5'] }}
                        >
                          <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                backgroundColor: i <= pwStrength.score ? pwStrength.color : colors.borderSubtle,
                                transition: 'background-color 200ms ease',
                              }} />
                            ))}
                          </div>
                          <span style={{ fontSize: typography.fontSize.caption, color: pwStrength.color, fontWeight: typography.fontWeight.medium }}>
                            {pwStrength.label}
                          </span>
                        </motion.div>
                      )}
                    </div>

                    <button type="submit" disabled={loading} style={primaryBtnStyle}>
                      <UserPlus size={16} />
                      {loading ? 'Creating account...' : 'Continue'}
                      {!loading && <ArrowRight size={16} />}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
                    <PremiumInput
                      id="reg-company" label="Company name"
                      value={companyName} onChange={setCompanyName}
                      placeholder="Turner Construction"
                      icon={<Building2 size={16} />} required autoFocus
                    />
                    <p style={{
                      margin: 0, fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                    }}>
                      You can invite team members and manage roles after setup.
                    </p>
                    <button type="submit" disabled={loading} style={primaryBtnStyle}>
                      <Building2 size={16} />
                      {loading ? 'Setting up...' : 'Create Company'}
                      {!loading && <ArrowRight size={16} />}
                    </button>
                  </form>
                )}
              </div>

              {/* Sign in link */}
              <p style={{
                textAlign: 'center', marginTop: spacing['6'],
                fontSize: typography.fontSize.sm, color: colors.textTertiary,
              }}>
                Already have an account?{' '}
                <Link
                  to="/login"
                  style={{
                    color: colors.orangeText,
                    fontWeight: typography.fontWeight.medium,
                    textDecoration: 'none',
                  }}
                >
                  Sign in
                </Link>
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
