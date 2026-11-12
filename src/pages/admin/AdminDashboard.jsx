import { useCallback, useEffect, useMemo, useState } from 'react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ROLES, ROLE_LABELS } from '../../lib/roles';
import AcademicManager from './AcademicManager';
import SystemSettings from './SystemSettings';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const EXAM_TYPE_LABELS = {
  mid_semester: 'Mid-Semester',
  end_semester: 'End-Semester',
  internal: 'Internal Assessment',
  quiz: 'Quiz',
  practical: 'Practical',
  viva: 'Viva',
};

function initialsFrom(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function timeAgo(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return dateFormat.format(new Date(iso));
}

function auditTargetLabel(entry) {
  if (entry.targetName) return entry.targetName;
  if (entry.action?.startsWith('subject.')) return 'Subject catalogue';
  if (entry.action?.startsWith('system.')) return 'System settings';
  return 'Account';
}

function Icon({ children, size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const OverviewIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.6" />
    <rect x="14" y="3" width="7" height="7" rx="1.6" />
    <rect x="3" y="14" width="7" height="7" rx="1.6" />
    <rect x="14" y="14" width="7" height="7" rx="1.6" />
  </Icon>
);

const UsersIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17.5 20a5.2 5.2 0 0 0-3-4.7" />
  </Icon>
);

const AcademicsIcon = () => (
  <Icon>
    <path d="M3 7.5 12 3l9 4.5-9 4.5z" />
    <path d="M6 10v5.5c0 1.7 2.7 3 6 3s6-1.3 6-3V10M21 7.5v5" />
  </Icon>
);

const ActivityIcon = () => (
  <Icon>
    <path d="M3 12h4l2.5-6 4 12L16 12h5" />
  </Icon>
);

const SettingsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.5-1.7 1.7 1.7 0 0 0-1.4.5l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 14H4.4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.7 1.7 1.7 0 0 0-.5-1.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1.5z" />
  </Icon>
);

const LogoutIcon = () => (
  <Icon>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Icon>
);

const AlertIcon = () => (
  <Icon size={20}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.2v.1" />
  </Icon>
);

const ShieldIcon = () => (
  <Icon size={16}>
    <path d="M12 3l7 3v5.5c0 4.3-2.9 7.5-7 9.5-4.1-2-7-5.2-7-9.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

function Rate({ value }) {
  if (value === null || value === undefined) return <span className="ad-muted">—</span>;
  return (
    <span className={`ad-rate${value < 75 ? ' ad-rate--low' : ''}`}>
      <span className="ad-rate__bar">
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      {value}%
    </span>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const isSuper = user?.role === 'super_admin';
  const [view, setView] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [roles, setRoles] = useState(ROLES);
  const [academics, setAcademics] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    document.title = isSuper ? 'Super Admin — Campus Portal' : 'Academic Admin — Campus Portal';
  }, [isSuper]);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');

      try {
        const [overviewPayload, usersPayload, academicsPayload, activityPayload] =
          await Promise.all([
            api.adminOverview(),
            api.adminUsers(),
            api.adminAcademics(),
            isSuper ? api.adminActivity() : Promise.resolve(null),
          ]);

        setOverview(overviewPayload);
        setAccounts(usersPayload.users);
        setRoles(usersPayload.roles);
        setAcademics(academicsPayload);
        if (activityPayload) setActivity(activityPayload.activity);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [isSuper]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function toggleAccount(account) {
    const next = !account.isActive;
    const verb = next ? 'reactivate' : 'deactivate';
    if (!window.confirm(`${verb === 'reactivate' ? 'Reactivate' : 'Deactivate'} ${account.name}?`)) {
      return;
    }

    setBusyId(account.id);
    setError('');

    try {
      const result = await api.adminSetUserStatus(account.id, next);
      setNotice(result.message);
      await refresh(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(account, role) {
    if (role === account.role) return;
    if (
      !window.confirm(
        `Change ${account.name}'s role from ${account.roleLabel} to ${ROLE_LABELS[role]}?`
      )
    ) {
      return;
    }

    setBusyId(account.id);
    setError('');

    try {
      const result = await api.adminSetUserRole(account.id, role);
      setNotice(result.message);
      await refresh(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return accounts.filter((account) => {
      if (roleFilter !== 'all' && account.role !== roleFilter) return false;
      if (statusFilter === 'active' && !account.isActive) return false;
      if (statusFilter === 'inactive' && account.isActive) return false;
      if (!needle) return true;
      return (
        account.name.toLowerCase().includes(needle) ||
        account.email.toLowerCase().includes(needle) ||
        (account.enrollmentId || '').toLowerCase().includes(needle)
      );
    });
  }, [accounts, search, roleFilter, statusFilter]);

  const stats = overview?.stats;
  const title = isSuper ? 'Institution Control' : 'Academic Administration';
  const subtitle = isSuper
    ? 'Full institution overview, account governance and audit trail'
    : 'Academic overview, account status and subject delivery';

  return (
    <div className="sd">
      <aside className="sd__sidebar">
        <div className="sd__brand">
          <Brand compact />
        </div>

        <div className="sd__profile">
          <div className="sd__avatar" aria-hidden="true">
            {initialsFrom(user?.name)}
          </div>
          <div className="sd__identity">
            <p className="sd__name">{user?.name}</p>
            <p className="sd__meta">
              {user?.department || 'Institution'} · {ROLE_LABELS[user?.role]}
            </p>
          </div>
        </div>

        <nav className="sd__nav" aria-label="Administration sections">
          <button
            type="button"
            className={`sd__navitem${view === 'overview' ? ' sd__navitem--active' : ''}`}
            aria-current={view === 'overview' ? 'page' : undefined}
            onClick={() => setView('overview')}
          >
            <OverviewIcon />
            Overview
          </button>
          <button
            type="button"
            className={`sd__navitem${view === 'accounts' ? ' sd__navitem--active' : ''}`}
            aria-current={view === 'accounts' ? 'page' : undefined}
            onClick={() => setView('accounts')}
          >
            <UsersIcon />
            Accounts
            <span className="sd__badge">{accounts.length}</span>
          </button>
          <button
            type="button"
            className={`sd__navitem${view === 'academics' ? ' sd__navitem--active' : ''}`}
            aria-current={view === 'academics' ? 'page' : undefined}
            onClick={() => setView('academics')}
          >
            <AcademicsIcon />
            Academics
          </button>
          {isSuper ? (
            <>
              <button
                type="button"
                className={`sd__navitem${view === 'system' ? ' sd__navitem--active' : ''}`}
                aria-current={view === 'system' ? 'page' : undefined}
                onClick={() => setView('system')}
              >
                <SettingsIcon />
                System settings
              </button>
              <button
                type="button"
                className={`sd__navitem${view === 'activity' ? ' sd__navitem--active' : ''}`}
                aria-current={view === 'activity' ? 'page' : undefined}
                onClick={() => setView('activity')}
              >
                <ActivityIcon />
                Audit trail
              </button>
            </>
          ) : null}
        </nav>

        <div className="sd__sidebar-foot">
          <button type="button" className="sd__logout" onClick={logout}>
            <LogoutIcon />
            Logout
          </button>
        </div>
      </aside>

      <main className="sd__main">
        <header className="sd__header">
          <div className="sd__headerrow">
            <div>
              <span className="ad-eyebrow">
                <ShieldIcon />
                {isSuper ? 'Super Administrator' : 'Academic Administrator'}
              </span>
              <h1 className="sd__title">{title}</h1>
              <p className="sd__subtitle">{subtitle}</p>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="sd-alert sd-alert--good ad-alert" role="status">
            <ShieldIcon />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className="sd-alert ad-alert" role="alert">
            <AlertIcon />
            <span>{error}</span>
            <button type="button" className="ad-alert__retry" onClick={() => refresh()}>
              Try again
            </button>
          </div>
        ) : null}

        {loading && view !== 'accounts' ? (
          <div className="sd__state">
            <span className="spinner" aria-label="Loading administration data" />
          </div>
        ) : null}

        {!loading && stats && view === 'overview' ? (
          <>
            <section className="sd-summary" aria-label="Institution summary">
              <article className="sd-summary__card">
                <span className="sd-summary__label">Active accounts</span>
                <strong className="sd-summary__value">{stats.activeUsers}</strong>
                <span className="sd-summary__hint">
                  {stats.inactiveUsers} inactive of {stats.users} total
                </span>
              </article>
              <article className="sd-summary__card">
                <span className="sd-summary__label">Students &amp; faculty</span>
                <strong className="sd-summary__value">
                  {stats.students}<span className="ad-slash">/</span>{stats.faculty}
                </strong>
                <span className="sd-summary__hint">active learners and teachers</span>
              </article>
              {isSuper ? (
                <>
                  <article className="sd-summary__card">
                    <span className="sd-summary__label">Inactive accounts</span>
                    <strong className="sd-summary__value">{stats.inactiveUsers}</strong>
                    <span className="sd-summary__hint">
                      {stats.users
                        ? `${Math.round((stats.inactiveUsers / stats.users) * 100)}% of all accounts`
                        : 'no accounts yet'}
                    </span>
                  </article>
                  <article className="sd-summary__card">
                    <span className="sd-summary__label">Administrative accounts</span>
                    <strong className="sd-summary__value">
                      {overview.roles
                        .filter((role) =>
                          ['super_admin', 'academic_admin', 'exam_cell'].includes(role.role)
                        )
                        .reduce((sum, role) => sum + role.count, 0)}
                    </strong>
                    <span className="sd-summary__hint">super, academic and exam cell</span>
                  </article>
                </>
              ) : (
                <>
                  <article className="sd-summary__card">
                    <span className="sd-summary__label">Attendance rate</span>
                    <strong className="sd-summary__value">
                      {stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
                    </strong>
                    <span className="sd-summary__hint">{stats.marked} attendance marks recorded</span>
                  </article>
                  <article className="sd-summary__card">
                    <span className="sd-summary__label">Upcoming exams</span>
                    <strong className="sd-summary__value">{stats.upcomingExams}</strong>
                    <span className="sd-summary__hint">
                      {stats.papers} paper sets · {stats.approvedPapers} approved
                    </span>
                  </article>
                </>
              )}
            </section>

            <div className="ov-grid">
              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <UsersIcon />
                    <h2 className="sd-panel__title">Role distribution</h2>
                  </div>
                  <span className="sd-panel__hint">{stats.users} accounts</span>
                </div>
                <ul className="ad-roles">
                  {overview.roles.map((role) => (
                    <li key={role.role} className="ad-role">
                      <span className="ad-role__label">{role.label}</span>
                      <span className="ad-role__track">
                        <span
                          style={{
                            width: `${stats.users ? Math.round((role.count / stats.users) * 100) : 0}%`,
                          }}
                        />
                      </span>
                      <strong>{role.count}</strong>
                    </li>
                  ))}
                </ul>
              </section>

              {!isSuper ? (
                <>
                  <section className="sd-panel ov-card">
                    <div className="sd-panel__head">
                      <div className="sd-panel__titlewrap">
                        <AcademicsIcon />
                        <h2 className="sd-panel__title">Academic delivery</h2>
                      </div>
                    </div>
                    <dl className="ad-metrics">
                      <div>
                        <dt>Subjects</dt>
                        <dd>{stats.subjects}</dd>
                      </div>
                      <div>
                        <dt>Sessions</dt>
                        <dd>{stats.sessions}</dd>
                      </div>
                      <div>
                        <dt>Materials</dt>
                        <dd>{stats.materials}</dd>
                      </div>
                      <div>
                        <dt>Pending notes</dt>
                        <dd>{stats.pendingMaterials}</dd>
                      </div>
                      <div>
                        <dt>Papers awaiting review</dt>
                        <dd>{stats.pendingPapers}</dd>
                      </div>
                      <div>
                        <dt>Avg. paper score</dt>
                        <dd>{stats.averagePaperScore}</dd>
                      </div>
                    </dl>
                    <p className="ov-note">
                      {stats.materials} of {stats.sessions} sessions have material published.
                    </p>
                  </section>

                  <section className="sd-panel ov-card">
                    <div className="sd-panel__head">
                      <div className="sd-panel__titlewrap">
                        <AcademicsIcon />
                        <h2 className="sd-panel__title">Upcoming examinations</h2>
                      </div>
                    </div>
                    {overview.upcomingExams.length ? (
                      <ul className="ov-list">
                        {overview.upcomingExams.map((exam) => (
                          <li key={exam.id} className="ov-list__row">
                            <div className="ov-date">
                              <strong>{new Date(exam.date).getUTCDate()}</strong>
                              <span>
                                {new Intl.DateTimeFormat('en-GB', {
                                  month: 'short',
                                  timeZone: 'UTC',
                                }).format(new Date(exam.date))}
                              </span>
                            </div>
                            <div className="ov-list__body">
                              <p className="ov-list__title">
                                {exam.subject?.name || exam.name}
                              </p>
                              <p className="ov-list__meta">
                                {exam.subject?.code} · {EXAM_TYPE_LABELS[exam.type] || exam.type} ·{' '}
                                {exam.startTime}–{exam.endTime}
                              </p>
                            </div>
                            <span className="ov-pill">{exam.maxMarks} marks</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="ov-empty">No scheduled examinations.</div>
                    )}
                  </section>
                </>
              ) : null}

              {isSuper ? (
                <section className="sd-panel ov-card">
                  <div className="sd-panel__head">
                    <div className="sd-panel__titlewrap">
                      <ActivityIcon />
                      <h2 className="sd-panel__title">Recent administrative activity</h2>
                    </div>
                    <button type="button" className="ov-link" onClick={() => setView('activity')}>
                      Full audit trail
                    </button>
                  </div>
                  {activity.length ? (
                    <ul className="ov-list">
                      {activity.slice(0, 5).map((entry) => (
                        <li key={entry.id} className="ov-list__row">
                          <div className="ov-list__body">
                            <p className="ov-list__title">{auditTargetLabel(entry)}</p>
                            <p className="ov-list__meta">
                              {entry.detail || entry.action} · by {entry.actorName}
                            </p>
                          </div>
                          <span className="ov-time">{timeAgo(entry.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="ov-empty">No administrative changes recorded yet.</div>
                  )}
                </section>
              ) : (
                <section className="sd-panel ov-card">
                  <div className="sd-panel__head">
                    <div className="sd-panel__titlewrap">
                      <UsersIcon />
                      <h2 className="sd-panel__title">Newest accounts</h2>
                    </div>
                    <button type="button" className="ov-link" onClick={() => setView('accounts')}>
                      Manage accounts
                    </button>
                  </div>
                  <ul className="ov-list">
                    {overview.recentUsers.map((account) => (
                      <li key={account.id} className="ov-list__row">
                        <div className="ov-list__body">
                          <p className="ov-list__title">{account.name}</p>
                          <p className="ov-list__meta">
                            {ROLE_LABELS[account.role]} · {account.department || 'Institution'}
                          </p>
                        </div>
                        <span className={`ad-badge${account.isActive ? '' : ' ad-badge--off'}`}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {!isSuper ? (
              <section className="sd-panel">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <AcademicsIcon />
                    <h2 className="sd-panel__title">Departments</h2>
                  </div>
                  <span className="sd-panel__hint">{overview.departments.length} departments</span>
                </div>
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Students</th>
                        <th>Faculty</th>
                        <th>Subjects</th>
                        <th>Sessions</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.departments.map((row) => (
                        <tr key={row.department}>
                          <td><strong>{row.department}</strong></td>
                          <td>{row.students}</td>
                          <td>{row.faculty}</td>
                          <td>{row.subjects}</td>
                          <td>{row.sessions}</td>
                          <td><Rate value={row.attendanceRate} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {loading && view === 'accounts' ? (
          <div className="sd__state ad-viewstate" role="status">
            <span className="spinner" aria-label="Loading account directory" />
            <p className="ad-viewloading">Loading the account directory…</p>
          </div>
        ) : null}

        {!loading && view === 'accounts' ? (
          <>
            <section className="sd-panel">
              <div className="sd-controls ad-controls">
                <label className="sd-field sd-field--search">
                  <span className="field-label">Search accounts</span>
                  <input
                    className="text-input"
                    type="search"
                    value={search}
                    placeholder="Name, email or enrollment ID…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="sd-field">
                  <span className="field-label">Role</span>
                  <select
                    className="sd-select"
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                  >
                    <option value="all">All roles</option>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <span className="field-label">Status</span>
                  <select
                    className="sd-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                  </select>
                </label>
              </div>

              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <UsersIcon />
                  <h2 className="sd-panel__title">Account directory</h2>
                </div>
                <span className="sd-panel__hint">
                  {filteredAccounts.length} of {accounts.length} accounts
                </span>
              </div>

              <div className="ad-table-wrap">
                <table className="ad-table ad-table--accounts">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Last login</th>
                      <th className="ad-table__actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => {
                      const isSelf = account.id === user?.id;
                      const protectedFromAcademic =
                        !isSuper && ['academic_admin', 'super_admin'].includes(account.role);
                      const locked = isSelf || protectedFromAcademic;

                      return (
                        <tr key={account.id} className={account.isActive ? '' : 'ad-row--off'}>
                          <td>
                            <div className="ad-person">
                              <span className="ad-person__avatar">{initialsFrom(account.name)}</span>
                              <div>
                                <strong>{account.name}</strong>
                                <span>{account.email}</span>
                                {account.enrollmentId ? (
                                  <span>{account.enrollmentId}</span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>
                            {isSuper && !isSelf ? (
                              <select
                                className="ad-role-select"
                                value={account.role}
                                onChange={(event) => changeRole(account, event.target.value)}
                                disabled={busyId === account.id}
                                aria-label={`Role for ${account.name}`}
                              >
                                {roles.map((role) => (
                                  <option key={role.value} value={role.value}>
                                    {role.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="ad-badge">{account.roleLabel}</span>
                            )}
                          </td>
                          <td>{account.department || '—'}</td>
                          <td>
                            <span className={`ad-badge${account.isActive ? ' ad-badge--good' : ' ad-badge--off'}`}>
                              {account.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="ad-muted">{timeAgo(account.lastLoginAt)}</td>
                          <td className="ad-table__actions">
                            {locked ? (
                              <span className="ad-muted">{isSelf ? 'Your account' : 'Admin managed'}</span>
                            ) : (
                              <button
                                type="button"
                                className={`ad-action${account.isActive ? ' ad-action--danger' : ''}`}
                                onClick={() => toggleAccount(account)}
                                disabled={busyId === account.id}
                              >
                                {busyId === account.id
                                  ? 'Saving…'
                                  : account.isActive
                                    ? 'Deactivate'
                                    : 'Reactivate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!filteredAccounts.length ? (
                <div className="sd-empty">
                  <p className="sd-empty__title">No accounts match those filters</p>
                  <p className="sd-empty__text">Try a different role, status or search term.</p>
                </div>
              ) : null}

              <p className="ov-note">
                {isSuper
                  ? 'Super admins can reactivate or deactivate any account except their own, and change roles.'
                  : 'Academic admins can reactivate or deactivate student, faculty, HOD and Exam Cell accounts. Administrator accounts are managed by a super admin.'}
              </p>
            </section>
          </>
        ) : null}

        {!loading && academics && view === 'academics' ? (
          <AcademicManager academics={academics} onRefresh={() => refresh(true)} />
        ) : null}

        {isSuper && view === 'system' ? <SystemSettings /> : null}

        {!loading && isSuper && view === 'activity' ? (
          <section className="sd-panel">
            <div className="sd-panel__head">
              <div className="sd-panel__titlewrap">
                <ActivityIcon />
                <h2 className="sd-panel__title">Administrative audit trail</h2>
              </div>
              <span className="sd-panel__hint">Latest {activity.length} actions</span>
            </div>

            {activity.length ? (
              <ol className="ad-timeline">
                {activity.map((entry) => (
                  <li key={entry.id} className="ad-timeline__item">
                    <span className="ad-timeline__dot" />
                    <div className="ad-timeline__body">
                      <p className="ad-timeline__title">
                        {auditTargetLabel(entry)} · {entry.detail || entry.action}
                      </p>
                      <p className="ad-timeline__meta">
                        {entry.actorName} · {dateTimeFormat.format(new Date(entry.createdAt))}
                      </p>
                    </div>
                    <span className="ad-timeline__action">{entry.action}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="ov-empty">
                No administrative changes yet. Account, subject and integration changes will appear
                here.
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
