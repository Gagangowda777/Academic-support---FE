import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../lib/roles';

const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'demo.student@transcendgroup.org', password: 'Student@2026' },
  { role: 'Faculty', email: 'faculty@transcendgroup.org', password: 'Faculty@2026' },
  { role: 'HOD / Dept Admin', email: 'hod@transcendgroup.org', password: 'HodAdmin@2026' },
  { role: 'Examination Cell', email: 'examcell@transcendgroup.org', password: 'ExamCell@2026' },
  { role: 'Academic Admin', email: 'academic@transcendgroup.org', password: 'AcadAdmin@2026' },
  { role: 'Super Admin', email: 'superadmin@transcendgroup.org', password: 'SuperAdmin@2026' },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const redirectTo = location.state?.from?.pathname || '/portal';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login({ email, password, role });
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function useDemoAccount(account) {
    const match = ROLES.find((item) => item.label === account.role);
    if (match) setRole(match.value);
    setEmail(account.email);
    setPassword(account.password);
    setShowDemo(false);
    setError('');
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <Brand />

        <div className="auth-divider" />

        <h1 id="login-title" className="auth-title">
          Campus Portal
        </h1>
        <p className="auth-subtitle">Sign in with your institutional account</p>

        <div className="role-picker">
          <span className="field-label">SIGN IN AS</span>
          <div className="role-grid" role="radiogroup" aria-label="Account type">
            {ROLES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={role === item.value}
                className={`role-chip${role === item.value ? ' role-chip--active' : ''}`}
                onClick={() => setRole(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label className="field-label" htmlFor="email">
              EMAIL OR ENROLLMENT ID
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="username"
              className="text-input"
              placeholder="demo.student@transcendgroup.org"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="field-label" htmlFor="password">
              PASSWORD
            </label>
            <div className="password-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="text-input text-input--password"
                placeholder="••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="eye-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path
                        d="M10.6 6.3A9.6 9.6 0 0 1 12 6.2c4.4 0 8.1 2.6 9.6 6.3a11.6 11.6 0 0 1-3 4.2M6.4 8A11.5 11.5 0 0 0 2.4 12.5C3.9 16.2 7.6 18.8 12 18.8c1.3 0 2.5-.2 3.6-.6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </>
                  ) : (
                    <>
                      <path
                        d="M2.4 12.5C3.9 8.8 7.6 6.2 12 6.2s8.1 2.6 9.6 6.3c-1.5 3.7-5.2 6.3-9.6 6.3s-8.1-2.6-9.6-6.3Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        fill="none"
                      />
                      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            <span>{submitting ? 'Signing in…' : 'Sign In'}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="arrow-icon">
              <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        </form>

        <button type="button" className="secondary-button" onClick={() => setShowDemo((value) => !value)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="lock-icon">
            <rect x="5" y="10.5" width="14" height="10" rx="2.4" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
          </svg>
          <span>Demo Accounts &amp; Credentials</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="arrow-icon arrow-icon--small">
            <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>

        {showDemo ? (
          <div className="demo-panel">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="demo-row"
                onClick={() => useDemoAccount(account)}
              >
                <span className="demo-role">{account.role}</span>
                <span className="demo-creds">
                  {account.email} · {account.password}
                </span>
              </button>
            ))}
            <p className="demo-note">Click a row to fill the form.</p>
          </div>
        ) : null}

        <div className="auth-footer">
          <p className="auth-footer__line">OWNED BY TRANSCEND GROUP OF INSTITUTIONS</p>
          <p className="auth-footer__line">
            DEVELOPED BY <span className="auth-footer__link">START SMART, SE</span>
          </p>
        </div>
      </section>
    </main>
  );
}
