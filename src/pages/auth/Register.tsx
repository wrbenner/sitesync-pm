import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle, Building2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['3']} ${spacing['4']} ${spacing['3']} 40px`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    transition: `border-color ${transitions.quick}`,
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing['2'],
    letterSpacing: typography.letterSpacing.wide,
  };

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
    if (result.error) {
      setError(result.error);
    } else {
      setStep('company');
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName) {
      setError('Please enter your company name.');
      return;
    }

    const result = await createCompany(companyName);
    if (result.error) {
      setError(result.error);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfacePage,
      fontFamily: typography.fontFamily,
      padding: spacing['6'],
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: spacing['10'] }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: borderRadius.lg,
            background: `linear-gradient(135deg, ${colors.primaryOrange}, #FF9C42)`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['4'],
          }}>
            <span style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>S</span>
          </div>
          <h1 style={{
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            letterSpacing: typography.letterSpacing.tight,
            margin: 0,
          }}>
            {step === 'account' ? 'Create your account' : 'Set up your company'}
          </h1>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            marginTop: spacing['2'],
          }}>
            {step === 'account'
              ? 'Start managing your construction projects with AI'
              : 'Your team will be organized under this company'}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex',
          gap: spacing['2'],
          marginBottom: spacing['6'],
          justifyContent: 'center',
        }}>
          {['account', 'company'].map((s, i) => (
            <div key={s} style={{
              width: 80,
              height: 3,
              borderRadius: borderRadius.full,
              backgroundColor: i <= (step === 'account' ? 0 : 1) ? colors.primaryOrange : colors.borderDefault,
              transition: `background-color ${transitions.quick}`,
            }} />
          ))}
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.card,
          padding: spacing['8'],
          border: `1px solid ${colors.borderSubtle}`,
        }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: spacing['3'],
              borderRadius: borderRadius.md,
              backgroundColor: colors.statusCriticalSubtle,
              color: colors.statusCritical,
              fontSize: typography.fontSize.sm,
              marginBottom: spacing['5'],
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {step === 'account' ? (
            <form onSubmit={handleAccountSubmit}>
              {/* Name fields */}
              <div style={{ display: 'flex', gap: spacing['3'], marginBottom: spacing['5'] }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)', color: colors.textTertiary,
                    }} />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                      onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Last name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)', color: colors.textTertiary,
                    }} />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      style={inputStyle}
                      onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                      onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: spacing['5'] }}>
                <label style={labelStyle}>Work email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: colors.textTertiary,
                  }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@construction.com"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                    onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: spacing['6'] }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: colors.textTertiary,
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    style={{ ...inputStyle, paddingRight: '40px' }}
                    onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                    onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', color: colors.textTertiary,
                      cursor: 'pointer', padding: 0, display: 'flex',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: `${spacing['3']} ${spacing['6']}`,
                  backgroundColor: loading ? colors.textTertiary : colors.primaryOrange,
                  color: '#fff',
                  border: 'none',
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: `background-color ${transitions.quick}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing['2'],
                }}
                onMouseEnter={(e) => { if (!loading) (e.target as HTMLElement).style.backgroundColor = colors.orangeHover; }}
                onMouseLeave={(e) => { if (!loading) (e.target as HTMLElement).style.backgroundColor = colors.primaryOrange; }}
              >
                <UserPlus size={16} />
                {loading ? 'Creating account...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCompanySubmit}>
              <div style={{ marginBottom: spacing['6'] }}>
                <label style={labelStyle}>Company name</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} style={{
                    position: 'absolute', left: '12px', top: '50%',
                    transform: 'translateY(-50%)', color: colors.textTertiary,
                  }} />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Turner Construction"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                    onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
                    autoFocus
                  />
                </div>
                <p style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  marginTop: spacing['2'],
                }}>
                  You can invite team members and manage roles after setup.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: `${spacing['3']} ${spacing['6']}`,
                  backgroundColor: loading ? colors.textTertiary : colors.primaryOrange,
                  color: '#fff',
                  border: 'none',
                  borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.body,
                  fontWeight: typography.fontWeight.semibold,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: `background-color ${transitions.quick}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing['2'],
                }}
                onMouseEnter={(e) => { if (!loading) (e.target as HTMLElement).style.backgroundColor = colors.orangeHover; }}
                onMouseLeave={(e) => { if (!loading) (e.target as HTMLElement).style.backgroundColor = colors.primaryOrange; }}
              >
                <Building2 size={16} />
                {loading ? 'Setting up...' : 'Create Company'}
              </button>
            </form>
          )}
        </div>

        {/* Sign in link */}
        <p style={{
          textAlign: 'center',
          marginTop: spacing['6'],
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
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
      </div>
    </div>
  );
}
