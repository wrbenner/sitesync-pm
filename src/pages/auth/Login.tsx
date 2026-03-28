import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { loginSchema } from '../../schemas/auth';
import type { LoginFormData } from '../../schemas/auth';

export function Login() {
  const navigate = useNavigate();
  const { signIn, loading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleSubmit = async (data: LoginFormData) => {
    const result = await signIn(data.email, data.password);
    if (result.error) {
      setError('root', { message: result.error });
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
      <div style={{
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Logo / Brand */}
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
            Welcome back
          </h1>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            marginTop: spacing['2'],
          }}>
            Sign in to your SiteSync account
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          boxShadow: shadows.card,
          padding: spacing['8'],
          border: `1px solid ${colors.borderSubtle}`,
        }}>
          <form onSubmit={handleFormSubmit(handleSubmit)}>
            {errors.root && (
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
                {errors.root.message}
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{
                display: 'block',
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textSecondary,
                marginBottom: spacing['2'],
                letterSpacing: typography.letterSpacing.wide,
              }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.textTertiary,
                }} />
                <input
                  type="email"
                  {...register('email')}
                  placeholder="you@company.com"
                  style={{
                    width: '100%',
                    padding: `${spacing['3']} ${spacing['4']} ${spacing['3']} 40px`,
                    border: `1px solid ${errors.email ? colors.statusCritical : colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.body,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfacePage,
                    outline: 'none',
                    transition: `border-color ${transitions.quick}`,
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                  onBlur={(e) => { if (!errors.email) e.target.style.borderColor = colors.borderDefault; }}
                />
              </div>
              {errors.email && (
                <div style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: '2px' }}>
                  {errors.email.message}
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: spacing['5'] }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing['2'],
              }}>
                <label style={{
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  letterSpacing: typography.letterSpacing.wide,
                }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {/* TODO: forgot password flow */}}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.primaryOrange,
                    fontSize: typography.fontSize.label,
                    fontWeight: typography.fontWeight.medium,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.textTertiary,
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    padding: `${spacing['3']} 40px ${spacing['3']} 40px`,
                    border: `1px solid ${errors.password ? colors.statusCritical : colors.borderDefault}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.body,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfacePage,
                    outline: 'none',
                    transition: `border-color ${transitions.quick}`,
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                  onBlur={(e) => { if (!errors.password) e.target.style.borderColor = colors.borderDefault; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: colors.textTertiary,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <div style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, marginTop: '2px' }}>
                  {errors.password.message}
                </div>
              )}
            </div>

            {/* Submit */}
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
              <LogIn size={16} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p style={{
          textAlign: 'center',
          marginTop: spacing['6'],
          fontSize: typography.fontSize.sm,
          color: colors.textSecondary,
        }}>
          New to SiteSync?{' '}
          <Link
            to="/register"
            style={{
              color: colors.primaryOrange,
              fontWeight: typography.fontWeight.medium,
              textDecoration: 'none',
            }}
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
