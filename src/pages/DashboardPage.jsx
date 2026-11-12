import Brand from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/roles';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] || user.role;

  return (
    <div className="portal">
      <header className="portal__bar">
        <Brand compact />

        <div className="portal__identity">
          <div className="portal__meta">
            <span className="portal__name">{user.name}</span>
            <span className="portal__email">{user.email}</span>
          </div>
          <span className="role-badge">{roleLabel}</span>
          <button type="button" className="ghost-button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="portal__canvas">
        <div className="portal__placeholder">
          <span className="portal__eyebrow">SIGNED IN AS</span>
          <h1 className="portal__role">{roleLabel}</h1>
          <p className="portal__hint">
            This is the {roleLabel} account area. It&apos;s blank for now — modules will appear here.
          </p>
        </div>
      </main>
    </div>
  );
}
