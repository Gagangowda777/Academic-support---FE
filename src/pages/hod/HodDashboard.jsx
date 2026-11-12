import { useCallback, useEffect, useMemo, useState } from 'react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

const compactDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const EXAM_TYPES = [
  { value: 'internal', label: 'Internal assessment' },
  { value: 'mid_semester', label: 'Mid-semester' },
  { value: 'end_semester', label: 'End-semester' },
  { value: 'practical', label: 'Practical' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'other', label: 'Other' },
];

const EXAM_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function emptyExamForm(subjectId = '') {
  return {
    subjectId,
    name: '',
    type: 'internal',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    room: '',
    maxMarks: '100',
    passMarks: '40',
    status: 'scheduled',
    notes: '',
  };
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${weekdayFormat.format(date)}, ${dateFormat.format(date)}`;
}

function formatCompactDate(iso) {
  if (!iso) return '—';
  return compactDateFormat.format(new Date(iso));
}

function initialsFrom(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function isLow(rate) {
  return typeof rate === 'number' && rate < 75;
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

const ClassesIcon = () => (
  <Icon>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 5.5v15M8 7h8M8 11h5" />
  </Icon>
);

const AttendanceIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" />
  </Icon>
);

const ExaminationsIcon = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v5h5M9 12h6M9 16h4" />
  </Icon>
);

const ReportsIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

const ReminderIcon = () => (
  <Icon size={14}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </Icon>
);

const AlertIcon = () => (
  <Icon size={20}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.2v.1" />
  </Icon>
);

const CheckIcon = () => (
  <Icon size={18}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Icon>
);

const LogoutIcon = () => (
  <Icon>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Icon>
);

function StatCard({ label, value, hint, accent = false }) {
  return (
    <article className={`hod-stat${accent ? ' hod-stat--accent' : ''}`}>
      <span className="hod-stat__label">{label}</span>
      <span className="hod-stat__value">{value}</span>
      {hint ? <span className="hod-stat__hint">{hint}</span> : null}
    </article>
  );
}

function RateBar({ rate, compact = false }) {
  return (
    <div className={`hod-rate${compact ? ' hod-rate--compact' : ''}`}>
      <div className="hod-rate__bar">
        <span
          className={`hod-rate__fill${isLow(rate) ? ' hod-rate__fill--low' : ''}`}
          style={{ width: `${rate ?? 0}%` }}
        />
      </div>
      <span className={`hod-rate__value${isLow(rate) ? ' is-low' : ''}`}>
        {rate === null || rate === undefined ? '—' : `${rate}%`}
      </span>
    </div>
  );
}

function ConflictPanel({ conflict, candidate, onCancel, onForce, busy }) {
  return (
    <section className="hod-conflict" role="alert">
      <div className="hod-conflict__head">
        <AlertIcon />
        <div>
          <h2 className="hod-conflict__title">Timetable clash for {conflict.subject.code}</h2>
          <p className="hod-conflict__text">
            {candidate?.name || 'This faculty member'} is already engaged during{' '}
            {conflict.conflicts.length} session{conflict.conflicts.length === 1 ? '' : 's'} of this
            class. Assigning now would double-book the timetable.
          </p>
        </div>
      </div>

      <ul className="hod-conflict__list">
        {conflict.conflicts.map((item) => (
          <li key={`${item.session.id}-${item.clashWith.session.id}`}>
            <span className="hod-conflict__tag">
              {item.type === 'cohort' ? 'Batch clash' : item.type === 'faculty' ? 'Faculty clash' : 'Faculty + batch clash'}
            </span>
            <span className="hod-conflict__line">
              <strong>
                {item.session.topic} · {formatCompactDate(item.session.date)} ·{' '}
                {item.session.startTime} – {item.session.endTime}
              </strong>
              <span>
                clashes with {item.clashWith.code} · {item.clashWith.name} (
                {item.clashWith.facultyName}) · {formatCompactDate(item.clashWith.session.date)} ·{' '}
                {item.clashWith.session.startTime} – {item.clashWith.session.endTime} ·{' '}
                {item.clashWith.session.room}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="hod-conflict__actions">
        <button type="button" className="ghost-button hod-conflict__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ghost-button hod-conflict__force"
          onClick={onForce}
          disabled={busy}
        >
          {busy ? 'Assigning…' : 'Assign anyway'}
        </button>
      </div>
    </section>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'classes', label: 'Faculty & Classes' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'examinations', label: 'Examinations' },
  { id: 'reports', label: 'Reports & Analytics' },
];

function formatHours(value) {
  if (value === null || value === undefined) return '—';
  if (value < 1) return '< 1 hr';
  if (value < 24) return `${Math.round(value * 10) / 10} hrs`;

  const days = Math.round((value / 24) * 10) / 10;
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export default function HodDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [choices, setChoices] = useState({});
  const [conflict, setConflict] = useState(null);
  const [busySubjectId, setBusySubjectId] = useState('');
  const [attendance, setAttendance] = useState(null);
  const [attendanceSubject, setAttendanceSubject] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [examinations, setExaminations] = useState(null);
  const [examinationsLoading, setExaminationsLoading] = useState(false);
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState('');
  const [examForm, setExamForm] = useState(() => emptyExamForm());
  const [examSaving, setExamSaving] = useState(false);
  const [examDeletingId, setExamDeletingId] = useState('');
  const [examFormError, setExamFormError] = useState('');
  const [reports, setReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [remindingId, setRemindingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDashboard = useCallback(async () => {
    const [overviewPayload, facultyPayload, subjectsPayload] = await Promise.all([
      api.hodOverview(),
      api.hodFaculty(),
      api.hodSubjects(),
    ]);

    setOverview(overviewPayload);
    setFaculty(facultyPayload.faculty);
    setSubjects(subjectsPayload.subjects);
    setChoices(
      Object.fromEntries(
        subjectsPayload.subjects.map((subject) => [subject.id, subject.faculty?.id || ''])
      )
    );
  }, []);

  useEffect(() => {
    document.title = 'HOD Dashboard — Campus Portal';
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await loadDashboard();
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadDashboard]);

  const loadAttendance = useCallback(async (subjectId) => {
    setAttendanceLoading(true);

    try {
      const payload = await api.hodAttendance(subjectId || '');
      setAttendance(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  const loadExaminations = useCallback(async () => {
    setExaminationsLoading(true);

    try {
      const payload = await api.hodExaminations();
      setExaminations(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setExaminationsLoading(false);
    }
  }, []);

  function openNewExam() {
    setEditingExamId('');
    setExamForm(emptyExamForm(subjects[0]?.id || ''));
    setExamFormError('');
    setExamFormOpen(true);
  }

  function openEditExam(exam) {
    setEditingExamId(exam.id);
    setExamForm({
      subjectId: exam.subject?.id || '',
      name: exam.name,
      type: exam.type,
      date: new Date(exam.date).toISOString().slice(0, 10),
      startTime: exam.startTime,
      endTime: exam.endTime,
      room: exam.room || '',
      maxMarks: String(exam.maxMarks),
      passMarks: String(exam.passMarks),
      status: exam.status,
      notes: exam.notes || '',
    });
    setExamFormError('');
    setExamFormOpen(true);
  }

  function closeExamForm() {
    setExamFormOpen(false);
    setEditingExamId('');
    setExamFormError('');
  }

  function setExamField(field, value) {
    setExamForm((current) => ({ ...current, [field]: value }));
  }

  async function handleExamSubmit(event) {
    event.preventDefault();
    setExamFormError('');

    if (!examForm.subjectId) {
      setExamFormError('Select the subject this exam belongs to.');
      return;
    }
    if (!examForm.name.trim()) {
      setExamFormError('Enter an exam name.');
      return;
    }
    if (!examForm.date) {
      setExamFormError('Choose the exam date.');
      return;
    }

    const maxMarks = Number(examForm.maxMarks);
    const passMarks = Number(examForm.passMarks);
    if (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > 1000) {
      setExamFormError('Maximum marks must be a whole number between 1 and 1000.');
      return;
    }
    if (!Number.isInteger(passMarks) || passMarks < 0 || passMarks > maxMarks) {
      setExamFormError('Passing marks must be a whole number between 0 and the maximum marks.');
      return;
    }

    setExamSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        ...examForm,
        name: examForm.name.trim(),
        room: examForm.room.trim(),
        maxMarks,
        passMarks,
        notes: examForm.notes.trim(),
      };
      const result = editingExamId
        ? await api.hodUpdateExam(editingExamId, payload)
        : await api.hodCreateExam(payload);
      setNotice(result.message);
      closeExamForm();
      await loadExaminations();
    } catch (err) {
      setExamFormError(err.message);
    } finally {
      setExamSaving(false);
    }
  }

  async function handleDeleteExam(exam) {
    if (!window.confirm(`Remove ${exam.name} (${exam.subject?.code || 'subject'})? This cannot be undone.`)) {
      return;
    }

    setExamDeletingId(exam.id);
    setError('');
    setNotice('');
    try {
      const result = await api.hodDeleteExam(exam.id);
      setNotice(result.message);
      if (editingExamId === exam.id) closeExamForm();
      await loadExaminations();
    } catch (err) {
      setError(err.message);
    } finally {
      setExamDeletingId('');
    }
  }

  const loadReports = useCallback(async () => {
    setReportsLoading(true);

    try {
      const payload = await api.hodReports();
      setReports(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'attendance') return;
    loadAttendance(attendanceSubject);
  }, [tab, attendanceSubject, loadAttendance]);

  useEffect(() => {
    if (tab !== 'examinations') return;
    loadExaminations();
  }, [tab, loadExaminations]);

  useEffect(() => {
    if (tab !== 'reports') return;
    loadReports();
  }, [tab, loadReports]);

  async function handleReminder(session) {
    const sessionId = session.id || session.sessionId;
    if (!sessionId) return;

    setRemindingId(sessionId);
    setError('');

    try {
      const result = await api.hodSendReminder(sessionId);
      setNotice(result.message);
      const reminderSentAt = result.reminder?.sentAt || new Date().toISOString();

      setOverview((current) =>
        current
          ? {
              ...current,
              recentSessions: (current.recentSessions || []).map((row) =>
                row.id === sessionId ? { ...row, reminderSentAt } : row
              ),
            }
          : current
      );
      setReports((current) =>
        current
          ? {
              ...current,
              overdueNotes: (current.overdueNotes || []).map((row) =>
                row.sessionId === sessionId ? { ...row, reminderSentAt } : row
              ),
            }
          : current
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRemindingId('');
    }
  }

  const stats = overview?.stats;
  const candidateFaculty = useMemo(
    () => faculty.find((member) => member.id === conflict?.facultyId) || null,
    [faculty, conflict]
  );

  function switchTab(nextTab) {
    setTab(nextTab);
    setConflict(null);
    setError('');
    setNotice('');
  }

  async function handleAssign(subject, { force = false } = {}) {
    const facultyId = choices[subject.id];

    if (!facultyId) {
      setError('Select a faculty member before assigning the class.');
      return;
    }

    setBusySubjectId(subject.id);
    setError('');
    if (!force) setConflict(null);

    try {
      const result = await api.hodAssignFaculty(subject.id, facultyId, force);
      setNotice(result.message);
      setConflict(null);
      await loadDashboard();

      if (attendance) await loadAttendance(attendanceSubject);
    } catch (err) {
      if (err.status === 409 && err.data?.conflicts) {
        setConflict({
          subject,
          facultyId,
          message: err.message,
          conflicts: err.data.conflicts,
        });
      } else {
        setError(err.message);
      }
    } finally {
      setBusySubjectId('');
    }
  }

  const title =
    tab === 'overview'
      ? 'Department overview'
      : tab === 'classes'
        ? 'Faculty & classes'
        : tab === 'attendance'
          ? 'Student attendance'
          : tab === 'examinations'
            ? 'Examinations'
            : 'Reports & Analytics';

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
            <p className="sd__meta">{user?.department} · HOD / Dept Admin</p>
          </div>
        </div>

        <nav className="sd__nav" aria-label="HOD sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sd__navitem${tab === item.id ? ' sd__navitem--active' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => switchTab(item.id)}
            >
              {item.id === 'overview' ? <OverviewIcon /> : null}
              {item.id === 'classes' ? <ClassesIcon /> : null}
              {item.id === 'attendance' ? <AttendanceIcon /> : null}
              {item.id === 'examinations' ? <ExaminationsIcon /> : null}
              {item.id === 'reports' ? <ReportsIcon /> : null}
              {item.label}
              {item.id === 'classes' && subjects.length ? (
                <span className="sd__badge">{subjects.length}</span>
              ) : null}
              {item.id === 'attendance' && stats?.students ? (
                <span className="sd__badge">{stats.students}</span>
              ) : null}
              {item.id === 'reports' && reports?.summary?.overdueNotes ? (
                <span className="sd__badge sd__badge--warn">{reports.summary.overdueNotes}</span>
              ) : null}
            </button>
          ))}
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
          <h1 className="sd__title">{title}</h1>
          <p className="sd__subtitle">
            HOD / Dept Admin · Department of {user?.department || overview?.department || '—'}
          </p>
        </header>

        {error ? (
          <div className="sd-panel">
            <div className="sd-alert" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div className="sd-panel">
            <div className="hod-notice" role="status">
              <CheckIcon />
              <span>{notice}</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="sd__state">
            <span className="spinner" aria-label="Loading" />
          </div>
        ) : null}

        {!loading && tab === 'overview' && stats ? (
          <>
            <section className="hod-stats">
              <StatCard
                label="Faculty"
                value={stats.faculty}
                hint={`${stats.subjects} classes across the department`}
              />
              <StatCard
                label="Students"
                value={stats.students}
                hint={`${stats.studentsWithRecords} with attendance records`}
              />
              <StatCard
                label="Sessions"
                value={stats.sessions}
                hint={`${stats.completedSessions} completed`}
              />
              <StatCard
                label="Materials uploaded"
                value={stats.materials}
                hint={`${stats.attachments} files · ${stats.sessionsWithoutMaterial} sessions pending`}
              />
              <StatCard
                label="Attendance rate"
                value={stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
                hint={`${stats.present} present · ${stats.absent} absent of ${stats.marked} marks`}
                accent
              />
              <StatCard
                label="Students at risk"
                value={stats.lowAttendanceStudents}
                hint={`below ${stats.lowAttendanceThreshold}% attendance`}
              />
            </section>

            <div className="hod-grid-2">
              <section className="sd-panel">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <AttendanceIcon />
                    <h2 className="sd-panel__title">Recent sessions</h2>
                  </div>
                  <span className="sd-panel__hint">Latest lectures in your department</span>
                </div>

                <div className="hod-rows">
                  {(overview.recentSessions || []).map((session) => (
                    <article key={session.id} className="hod-row">
                      <span className="fd-code">{session.subjectCode}</span>
                      <div className="hod-row__main">
                        <strong>{session.topic}</strong>
                        <span>
                          {formatCompactDate(session.date)} · {session.startTime} –{' '}
                          {session.endTime} · {session.room} · {session.facultyName}
                        </span>
                      </div>
                      <div className="hod-row__meta">
                        <span className={`fd-pill${isLow(session.attendance.rate) ? ' fd-pill--absent' : ''}`}>
                          {session.attendance.rate === null
                            ? 'Not marked'
                            : `${session.attendance.rate}% present`}
                        </span>
                        {session.material ? (
                          <span className="fd-pill fd-pill--ok">
                            Material · {session.attachmentCount} file
                            {session.attachmentCount === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="hod-reminderwrap">
                            <span className="fd-pill fd-pill--pending">
                              {session.materialDraft ? 'Draft · pending' : 'Material pending'}
                            </span>
                            <button
                              type="button"
                              className="hod-remind"
                              disabled={remindingId === session.id}
                              onClick={() => handleReminder(session)}
                              title={`Remind ${session.facultyName} about ${session.topic}`}
                            >
                              <ReminderIcon />
                              {remindingId === session.id
                                ? 'Sending…'
                                : session.reminderSentAt
                                  ? 'Remind again'
                                  : 'Send reminder'}
                            </button>
                            {session.reminderSentAt ? (
                              <span className="hod-reminderwrap__sent">
                                Sent {formatDateTime(session.reminderSentAt)}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}

                  {!overview.recentSessions?.length ? (
                    <p className="fd-hint">No sessions scheduled yet.</p>
                  ) : null}
                </div>
              </section>

              <section className="sd-panel">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <ClassesIcon />
                    <h2 className="sd-panel__title">Notes &amp; materials uploaded</h2>
                  </div>
                  <span className="sd-panel__hint">{stats.materials} sessions with material</span>
                </div>

                <div className="hod-rows">
                  {(overview.recentMaterials || []).map((material) => (
                    <article key={material.sessionId} className="hod-row hod-row--stack">
                      <div className="hod-row__main">
                        <strong>{material.title}</strong>
                        <span>
                          {material.subjectCode} · {material.topic}
                        </span>
                        <span className="hod-row__sub">
                          {material.uploadedBy ? `Uploaded by ${material.uploadedBy}` : 'Uploaded'} ·{' '}
                          {formatCompactDate(material.uploadedAt)} · {material.attachmentCount} file
                          {material.attachmentCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </article>
                  ))}

                  {!overview.recentMaterials?.length ? (
                    <p className="fd-hint">No study material has been published yet.</p>
                  ) : null}
                </div>
              </section>
            </div>

            <section className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <OverviewIcon />
                  <h2 className="sd-panel__title">Faculty workload</h2>
                </div>
                <span className="sd-panel__hint">
                  {stats.faculty} active faculty · {stats.assignedSubjects} of {stats.subjects} classes
                  assigned
                </span>
              </div>

              <div className="hod-facultygrid">
                {(overview.faculty || []).map((member) => (
                  <article key={member.id} className="hod-facultycard">
                    <div className="hod-facultycard__head">
                      <span className="sd__avatar hod-facultycard__avatar" aria-hidden="true">
                        {initialsFrom(member.name)}
                      </span>
                      <div>
                        <p className="hod-facultycard__name">{member.name}</p>
                        <p className="hod-facultycard__email">{member.email}</p>
                      </div>
                    </div>

                    <div className="hod-chiprow hod-chiprow--static">
                      {member.subjects.length ? (
                        member.subjects.map((subject) => (
                          <span key={subject.id} className="fd-chip">
                            {subject.code} · {subject.name}
                          </span>
                        ))
                      ) : (
                        <span className="fd-chip">No classes assigned</span>
                      )}
                    </div>

                    <p className="hod-facultycard__stats">
                      {member.subjectCount} class{member.subjectCount === 1 ? '' : 'es'} ·{' '}
                      {member.sessionCount} session{member.sessionCount === 1 ? '' : 's'} ·{' '}
                      {member.materialCount} material{member.materialCount === 1 ? '' : 's'}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!loading && tab === 'classes' ? (
          <>
            {conflict ? (
              <ConflictPanel
                conflict={conflict}
                candidate={candidateFaculty}
                busy={busySubjectId === conflict.subject.id}
                onCancel={() => setConflict(null)}
                onForce={() => handleAssign(conflict.subject, { force: true })}
              />
            ) : null}

            <section className="fd-classes">
              {subjects.map((subject) => (
                <article key={subject.id} className="fd-class">
                  <div className="fd-class__head">
                    <span className="fd-code">{subject.code}</span>
                    <span className="fd-chip">Semester {subject.semester}</span>
                  </div>

                  <h2 className="fd-class__name">{subject.name}</h2>

                  <dl className="fd-meta">
                    <div className="fd-meta__row">
                      <dt>Academic year</dt>
                      <dd>{subject.academicYear}</dd>
                    </div>
                    <div className="fd-meta__row">
                      <dt>Batch</dt>
                      <dd>{subject.batch}</dd>
                    </div>
                    <div className="fd-meta__row">
                      <dt>Section</dt>
                      <dd>{subject.section}</dd>
                    </div>
                    <div className="fd-meta__row">
                      <dt>Students</dt>
                      <dd>{subject.studentCount}</dd>
                    </div>
                  </dl>

                  <div className="fd-class__stats">
                    <span>{subject.sessionCount} sessions</span>
                    <span>
                      {subject.materialCount}/{subject.sessionCount} materials
                    </span>
                    <span>{subject.attachmentCount} files</span>
                  </div>

                  <div className="hod-ratewrap">
                    <span className="field-label">Attendance</span>
                    <RateBar rate={subject.attendance.rate} />
                  </div>

                  <div className="hod-assign">
                    <label className="field-label" htmlFor={`faculty-${subject.id}`}>
                      Assigned faculty
                    </label>
                    <div className="hod-assign__row">
                      <select
                        id={`faculty-${subject.id}`}
                        className="hod-select"
                        value={choices[subject.id] ?? ''}
                        onChange={(event) =>
                          setChoices((current) => ({
                            ...current,
                            [subject.id]: event.target.value,
                          }))
                        }
                        disabled={busySubjectId === subject.id}
                      >
                        <option value="">Select faculty</option>
                        {faculty.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="fd-submit hod-assign__btn"
                        onClick={() => handleAssign(subject)}
                        disabled={
                          busySubjectId === subject.id ||
                          !choices[subject.id] ||
                          choices[subject.id] === subject.faculty?.id
                        }
                      >
                        {busySubjectId === subject.id
                          ? 'Saving…'
                          : subject.faculty
                            ? 'Reassign'
                            : 'Assign'}
                      </button>
                    </div>
                    <p className="fd-hint">
                      Clashes are checked against the teacher&rsquo;s timetable and the batch
                      timetable before the class is reassigned.
                    </p>
                  </div>
                </article>
              ))}

              {!subjects.length ? (
                <div className="sd-panel">
                  <div className="sd-empty">
                    <p className="sd-empty__title">No classes in this department</p>
                    <p className="sd-empty__text">
                      Classes created by the academic office will appear here for assignment.
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <ClassesIcon />
                  <h2 className="sd-panel__title">Teaching load</h2>
                </div>
                <span className="sd-panel__hint">Faculty in {user?.department}</span>
              </div>

              <div className="hod-tablewrap">
                <table className="hod-table">
                  <thead>
                    <tr>
                      <th scope="col">Faculty</th>
                      <th scope="col">Classes</th>
                      <th scope="col">Sessions</th>
                      <th scope="col">Students</th>
                      <th scope="col">Materials</th>
                      <th scope="col">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faculty.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.name}</strong>
                          <span className="hod-table__sub">{member.email}</span>
                        </td>
                        <td>{member.subjectCount}</td>
                        <td>{member.sessionCount}</td>
                        <td>{member.studentCount}</td>
                        <td>{member.materialCount}</td>
                        <td>
                          <RateBar rate={member.attendance.rate} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        {!loading && tab === 'attendance' ? (
          <>
            <div className="hod-chiprow" role="group" aria-label="Filter attendance by class">
              <button
                type="button"
                className={`hod-filter${attendanceSubject === '' ? ' is-active' : ''}`}
                aria-pressed={attendanceSubject === ''}
                onClick={() => setAttendanceSubject('')}
              >
                All classes
              </button>
              {(attendance?.subjects || subjects).map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  className={`hod-filter${attendanceSubject === subject.id ? ' is-active' : ''}`}
                  aria-pressed={attendanceSubject === subject.id}
                  onClick={() => setAttendanceSubject(subject.id)}
                >
                  {subject.code}
                  {subject.rate !== undefined && subject.rate !== null ? (
                    <span className="hod-filter__rate">{subject.rate}%</span>
                  ) : null}
                </button>
              ))}
            </div>

            {attendanceLoading ? (
              <div className="sd__state">
                <span className="spinner" aria-label="Loading attendance" />
              </div>
            ) : null}

            {!attendanceLoading && attendance ? (
              <>
                <section className="hod-stats hod-stats--compact">
                  <StatCard label="Students" value={attendance.summary.students} />
                  <StatCard label="Sessions" value={attendance.summary.sessions} />
                  <StatCard label="Present" value={attendance.summary.present} />
                  <StatCard label="Absent" value={attendance.summary.absent} />
                  <StatCard
                    label="Attendance rate"
                    value={`${attendance.summary.rate ?? '—'}%`}
                    accent
                  />
                  <StatCard
                    label={`Below ${attendance.summary.lowAttendanceThreshold}%`}
                    value={attendance.summary.lowAttendance}
                  />
                </section>

                <section className="sd-panel">
                  <div className="sd-panel__head">
                    <div className="sd-panel__titlewrap">
                      <AttendanceIcon />
                      <h2 className="sd-panel__title">Student attendance</h2>
                    </div>
                    <span className="sd-panel__hint">
                      {attendance.scope
                        ? `${attendance.scope.code} · ${attendance.scope.name}`
                        : 'All classes in the department'}
                    </span>
                  </div>

                  <div className="hod-tablewrap">
                    <table className="hod-table hod-table--students">
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          <th scope="col">Enrollment</th>
                          <th scope="col">Marked</th>
                          <th scope="col">Present</th>
                          <th scope="col">Absent</th>
                          <th scope="col">Attendance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.students.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <strong>{student.name}</strong>
                              <span className="hod-table__sub">{student.email}</span>
                            </td>
                            <td>{student.enrollmentId || '—'}</td>
                            <td>{student.marked}</td>
                            <td>{student.present}</td>
                            <td>{student.absent + student.late}</td>
                            <td>
                              {student.rate === null ? (
                                <span className="hod-table__sub">No records</span>
                              ) : (
                                <RateBar rate={student.rate} compact />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!attendance.students.length ? (
                    <p className="fd-hint">No attendance has been marked for this selection yet.</p>
                  ) : null}
                </section>

                {attendance.sessions ? (
                  <section className="sd-panel">
                    <div className="sd-panel__head">
                      <div className="sd-panel__titlewrap">
                        <OverviewIcon />
                        <h2 className="sd-panel__title">Session register</h2>
                      </div>
                      <span className="sd-panel__hint">
                        {attendance.sessions.length} sessions in {attendance.scope.code}
                      </span>
                    </div>

                    <div className="hod-tablewrap">
                      <table className="hod-table">
                        <thead>
                          <tr>
                            <th scope="col">Date &amp; time</th>
                            <th scope="col">Topic</th>
                            <th scope="col">Room</th>
                            <th scope="col">Present</th>
                            <th scope="col">Absent</th>
                            <th scope="col">Attendance</th>
                            <th scope="col">Material</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendance.sessions.map((session) => (
                            <tr key={session.id}>
                              <td>
                                <strong>{formatCompactDate(session.date)}</strong>
                                <span className="hod-table__sub">
                                  {session.startTime} – {session.endTime}
                                </span>
                              </td>
                              <td>{session.topic}</td>
                              <td>{session.room}</td>
                              <td>{session.present}</td>
                              <td>{session.absent + session.late}</td>
                              <td>
                                <RateBar rate={session.rate} compact />
                              </td>
                              <td>
                                <span
                                  className={`fd-pill ${
                                    session.material ? 'fd-pill--ok' : 'fd-pill--pending'
                                  }`}
                                >
                                  {session.material ? 'Uploaded' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {!loading && tab === 'examinations' ? (
          <>
            {examinationsLoading ? (
              <div className="sd__state">
                <span className="spinner" aria-label="Loading examination reports" />
              </div>
            ) : null}

            {!examinationsLoading && examinations ? (
              <>
                <section className="sd-panel hod-exammanager">
                  <div className="sd-panel__head">
                    <div className="sd-panel__titlewrap">
                      <ExaminationsIcon />
                      <div>
                        <h2 className="sd-panel__title">Department exam schedule</h2>
                        <span className="hod-panel__sub">
                          Add, edit or remove exams for subjects in your department.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ex-btn ex-btn--primary"
                      onClick={openNewExam}
                      disabled={!subjects.length}
                    >
                      Add exam
                    </button>
                  </div>

                  {examFormOpen ? (
                    <form className="ex-form" onSubmit={handleExamSubmit}>
                      <div className="ex-form__head">
                        <h3 className="ex-form__title">{editingExamId ? 'Edit exam' : 'Add an exam'}</h3>
                        <button type="button" className="ex-linkbtn" onClick={closeExamForm}>
                          Cancel
                        </button>
                      </div>
                      {examFormError ? (
                        <div className="sd-alert" role="alert">
                          <AlertIcon />
                          <span>{examFormError}</span>
                        </div>
                      ) : null}
                      <div className="ex-grid">
                        <label className="fd-field">
                          <span className="field-label">Subject</span>
                          <select
                            className="ex-select"
                            value={examForm.subjectId}
                            onChange={(event) => setExamField('subjectId', event.target.value)}
                            required
                          >
                            <option value="">Select subject</option>
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.code} · {subject.name} (Sem {subject.semester})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="fd-field ex-field--wide">
                          <span className="field-label">Exam name</span>
                          <input
                            className="text-input"
                            value={examForm.name}
                            maxLength={160}
                            onChange={(event) => setExamField('name', event.target.value)}
                            required
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Type</span>
                          <select
                            className="ex-select"
                            value={examForm.type}
                            onChange={(event) => setExamField('type', event.target.value)}
                          >
                            {EXAM_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Date</span>
                          <input
                            type="date"
                            className="text-input"
                            value={examForm.date}
                            onChange={(event) => setExamField('date', event.target.value)}
                            required
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Start time</span>
                          <input
                            type="time"
                            className="text-input"
                            value={examForm.startTime}
                            onChange={(event) => setExamField('startTime', event.target.value)}
                            required
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">End time</span>
                          <input
                            type="time"
                            className="text-input"
                            value={examForm.endTime}
                            onChange={(event) => setExamField('endTime', event.target.value)}
                            required
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Room / hall (optional)</span>
                          <input
                            className="text-input"
                            value={examForm.room}
                            maxLength={80}
                            onChange={(event) => setExamField('room', event.target.value)}
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Maximum marks</span>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            step="1"
                            className="text-input"
                            value={examForm.maxMarks}
                            onChange={(event) => setExamField('maxMarks', event.target.value)}
                            required
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Passing marks</span>
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            step="1"
                            className="text-input"
                            value={examForm.passMarks}
                            onChange={(event) => setExamField('passMarks', event.target.value)}
                            required
                          />
                        </label>
                        <label className="fd-field">
                          <span className="field-label">Status</span>
                          <select
                            className="ex-select"
                            value={examForm.status}
                            onChange={(event) => setExamField('status', event.target.value)}
                          >
                            {EXAM_STATUSES.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="fd-field ex-field--full">
                          <span className="field-label">Notes (optional)</span>
                          <textarea
                            className="text-input fd-textarea"
                            rows={2}
                            value={examForm.notes}
                            maxLength={1000}
                            onChange={(event) => setExamField('notes', event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="ex-form__actions">
                        <button type="button" className="ex-btn" onClick={closeExamForm}>Cancel</button>
                        <button type="submit" className="ex-btn ex-btn--primary" disabled={examSaving}>
                          {examSaving ? 'Saving…' : editingExamId ? 'Save changes' : 'Create exam'}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="hod-tablewrap">
                    <table className="hod-table ex-table">
                      <thead>
                        <tr>
                          <th scope="col">Exam</th>
                          <th scope="col">Subject</th>
                          <th scope="col">Date &amp; time</th>
                          <th scope="col">Room</th>
                          <th scope="col">Marks</th>
                          <th scope="col">Status</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {examinations.exams.map((exam) => (
                          <tr key={exam.id}>
                            <td>
                              <strong>{exam.name}</strong>
                              <span className="hod-table__sub">
                                {EXAM_TYPES.find((type) => type.value === exam.type)?.label || exam.type}
                              </span>
                            </td>
                            <td>
                              <strong>{exam.subject?.code || '—'}</strong>
                              <span className="hod-table__sub">{exam.subject?.name || 'Subject removed'}</span>
                            </td>
                            <td>
                              <strong>{formatDate(exam.date)}</strong>
                              <span className="hod-table__sub">{exam.startTime} – {exam.endTime}</span>
                            </td>
                            <td>{exam.room || '—'}</td>
                            <td>
                              <strong>{exam.maxMarks}</strong>
                              <span className="hod-table__sub">pass {exam.passMarks}</span>
                            </td>
                            <td><span className={`ex-status ex-status--${exam.status}`}>{exam.status}</span></td>
                            <td>
                              <div className="ex-actions">
                                <button
                                  type="button"
                                  className="ex-iconbtn hod-exam-action"
                                  aria-label={`Edit ${exam.name}`}
                                  title="Edit exam"
                                  onClick={() => openEditExam(exam)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="ex-iconbtn ex-iconbtn--danger hod-exam-action"
                                  aria-label={`Delete ${exam.name}`}
                                  title="Delete exam"
                                  disabled={examDeletingId === exam.id}
                                  onClick={() => handleDeleteExam(exam)}
                                >
                                  {examDeletingId === exam.id ? '…' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!examinations.exams.length ? (
                      <div className="sd-empty">
                        <p className="sd-empty__title">No exams in this department</p>
                        <p className="sd-empty__text">Add an exam to start building the department schedule.</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="hod-stats hod-stats--compact">
                  <StatCard
                    label="Examinations"
                    value={examinations.stats.exams}
                    hint={`${examinations.stats.submissionRate ?? 0}% have submissions`}
                  />
                  <StatCard
                    label="Paper sets"
                    value={examinations.stats.papers}
                    hint={`${examinations.stats.awaitingReview} awaiting review`}
                  />
                  <StatCard
                    label="AI evaluated"
                    value={examinations.stats.evaluated}
                    hint={`${examinations.stats.pendingEvaluation} still processing`}
                  />
                  <StatCard
                    label="Average AI score"
                    value={examinations.stats.averageScore ?? '—'}
                    hint={
                      examinations.stats.highestScore
                        ? `highest ${examinations.stats.highestScore}/100`
                        : 'no structured papers yet'
                    }
                    accent
                  />
                  <StatCard
                    label="Approved papers"
                    value={examinations.stats.approved}
                    hint="one may be approved per exam"
                  />
                </section>

                <section className="sd-panel hod-moduleb">
                  <div className="sd-panel__head">
                    <div className="sd-panel__titlewrap">
                      <ExaminationsIcon />
                      <div>
                        <h2 className="sd-panel__title">AI evaluation status · Module B</h2>
                        <span className="hod-panel__sub">
                          Faculty submissions and the Paper Check report for your department.
                        </span>
                      </div>
                    </div>
                    <span className="sd-panel__hint">Read-only monitoring</span>
                  </div>

                  <div className="hod-scorebands">
                    <div className="hod-scoreband hod-scoreband--excellent">
                      <strong>{examinations.scoreBands.excellent}</strong>
                      <span>85+ · excellent</span>
                    </div>
                    <div className="hod-scoreband hod-scoreband--good">
                      <strong>{examinations.scoreBands.good}</strong>
                      <span>70–84 · good</span>
                    </div>
                    <div className="hod-scoreband hod-scoreband--review">
                      <strong>{examinations.scoreBands.needsReview}</strong>
                      <span>&lt; 70 · needs review</span>
                    </div>
                  </div>
                </section>

                {examinations.exams.map((exam) => (
                  <section key={exam.id} className="sd-panel hod-exampanel">
                    <div className="sd-panel__head">
                      <div className="sd-panel__titlewrap">
                        <span className="fd-code">{exam.subject?.code || '—'}</span>
                        <div>
                          <h2 className="sd-panel__title">{exam.name}</h2>
                          <span className="hod-panel__sub">
                            {exam.subject?.name} · {formatDate(exam.date)} ·{' '}
                            {exam.startTime} – {exam.endTime} · {exam.maxMarks} marks
                          </span>
                        </div>
                      </div>
                      <div className="hod-exam__meta">
                        <span className={`fd-pill ${exam.status === 'completed' ? '' : 'fd-pill--ok'}`}>
                          {exam.status}
                        </span>
                        <span className="hod-exam__count">
                          {exam.paperCount} set{exam.paperCount === 1 ? '' : 's'}
                        </span>
                        {exam.averageScore !== null ? (
                          <span className="hod-exam__avg">avg {exam.averageScore}</span>
                        ) : null}
                      </div>
                    </div>

                    {exam.papers.length ? (
                      <div className="hod-tablewrap">
                        <table className="hod-table hod-table--papers">
                          <thead>
                            <tr>
                              <th scope="col">Set</th>
                              <th scope="col">Faculty</th>
                              <th scope="col">Format</th>
                              <th scope="col">Review status</th>
                              <th scope="col">AI evaluation</th>
                              <th scope="col">Submitted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exam.papers.map((paper) => (
                              <tr key={paper.id}>
                                <td>
                                  <strong>{paper.title}</strong>
                                  <span className="hod-table__sub">
                                    {paper.submissionType === 'document'
                                      ? `Document upload · ${paper.totalMarks} marks`
                                      : `${paper.questionCount} questions · ${paper.totalMarks} marks`}
                                    {paper.recommended ? ' · AI recommended' : ''}
                                  </span>
                                  {paper.summary ? (
                                    <span className="hod-table__sub">{paper.summary}</span>
                                  ) : null}
                                </td>
                                <td>
                                  {paper.faculty?.name || '—'}
                                  {paper.faculty?.email ? (
                                    <span className="hod-table__sub">{paper.faculty.email}</span>
                                  ) : null}
                                </td>
                                <td>
                                  <span className="fd-chip">
                                    {paper.submissionType === 'document' ? 'Document upload' : 'Structured'}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`fd-pill ${
                                      paper.approved
                                        ? 'fd-pill--ok'
                                        : paper.status === 'rejected'
                                          ? 'fd-pill--absent'
                                          : 'fd-pill--pending'
                                    }`}
                                  >
                                    {paper.approved
                                      ? 'Approved'
                                      : paper.status === 'rejected'
                                        ? 'Returned'
                                        : 'In review'}
                                  </span>
                                </td>
                                <td>
                                  {paper.aiStatus === 'evaluated' ? (
                                    <span className="hod-ai-score">{paper.score}<small>/100</small></span>
                                  ) : paper.aiStatus === 'failed' ? (
                                    <span className="hod-ai-status">Evaluation failed</span>
                                  ) : paper.aiStatus === 'processing' ? (
                                    <span className="hod-ai-status">Processing</span>
                                  ) : (
                                    <span className="hod-ai-status">Queued</span>
                                  )}
                                  {paper.aiStatus === 'failed' && paper.evaluationError ? (
                                    <span className="hod-table__sub">{paper.evaluationError}</span>
                                  ) : null}
                                  {paper.aiStatus === 'evaluated' && paper.evaluatedAt ? (
                                    <span className="hod-table__sub">
                                      {formatDateTime(paper.evaluatedAt)}
                                    </span>
                                  ) : null}
                                  {paper.breakdown?.length ? (
                                    <details className="hod-rubric">
                                      <summary>View rubric</summary>
                                      <div className="hod-rubric__list">
                                        {paper.breakdown.map((criterion) => (
                                          <span key={criterion.key}>
                                            {criterion.label}
                                            <strong>{criterion.score}</strong>
                                          </span>
                                        ))}
                                      </div>
                                    </details>
                                  ) : null}
                                </td>
                                <td>{formatCompactDate(paper.submittedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="fd-hint">No faculty paper sets submitted for this exam yet.</p>
                    )}
                  </section>
                ))}

                {!examinations.exams.length ? (
                  <section className="sd-panel">
                    <div className="sd-empty">
                      <p className="sd-empty__title">No examinations in this department</p>
                      <p className="sd-empty__text">
                        Add exams to the department schedule above. Faculty paper submissions will
                        appear here as they are received.
                      </p>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {!loading && tab === 'reports' ? (
          <>
            {reportsLoading ? (
              <div className="sd__state">
                <span className="spinner" aria-label="Loading reports and analytics" />
              </div>
            ) : null}

            {!reportsLoading && reports ? (
              <>
                <section className="hod-stats">
                  <StatCard
                    label="Average upload turnaround"
                    value={formatHours(reports.summary.turnaround.averageHours)}
                    hint={`Median ${formatHours(reports.summary.turnaround.medianHours)} · ${reports.summary.turnaround.samples} published samples`}
                  />
                  <StatCard
                    label={`Within ${reports.slaHours}h SLA`}
                    value={
                      reports.summary.turnaround.withinSlaRate === null
                        ? '—'
                        : `${reports.summary.turnaround.withinSlaRate}%`
                    }
                    hint={`${reports.summary.turnaround.withinSla} on time · ${reports.summary.turnaround.overdue} late`}
                    accent
                  />
                  <StatCard
                    label="Overdue notes"
                    value={reports.summary.overdueNotes}
                    hint={`Sessions waiting longer than ${reports.slaHours} hours`}
                  />
                  <StatCard
                    label="Student access rate"
                    value={
                      reports.summary.access.rate === null
                        ? '—'
                        : `${reports.summary.access.rate}%`
                    }
                    hint={`${reports.summary.access.accessed} opens of ${reports.summary.access.exposures} eligible`}
                  />
                </section>

                <div className="hod-grid-2">
                  <section className="sd-panel">
                    <div className="sd-panel__head">
                      <div className="sd-panel__titlewrap">
                        <ReportsIcon />
                        <h2 className="sd-panel__title">Resource upload turnaround</h2>
                      </div>
                      <span className="sd-panel__hint">Session end → material published</span>
                    </div>

                    <div className="hod-report-kpis">
                      <div>
                        <strong>{formatHours(reports.summary.turnaround.averageHours)}</strong>
                        <span>average</span>
                      </div>
                      <div>
                        <strong>{formatHours(reports.summary.turnaround.fastestHours)}</strong>
                        <span>fastest</span>
                      </div>
                      <div>
                        <strong>{formatHours(reports.summary.turnaround.slowestHours)}</strong>
                        <span>slowest</span>
                      </div>
                    </div>

                    <div className="hod-tablewrap">
                      <table className="hod-table">
                        <thead>
                          <tr>
                            <th scope="col">Subject</th>
                            <th scope="col">Faculty</th>
                            <th scope="col">Published</th>
                            <th scope="col">Avg turnaround</th>
                            <th scope="col">Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.turnaround.bySubject.map((subject) => (
                            <tr key={subject.id}>
                              <td>
                                <strong>{subject.code}</strong>
                                <span className="hod-table__sub">{subject.name}</span>
                              </td>
                              <td>{subject.faculty || '—'}</td>
                              <td>{subject.published}/{subject.sessions}</td>
                              <td>{formatHours(subject.averageTurnaroundHours)}</td>
                              <td>
                                {subject.overdue ? (
                                  <span className="fd-pill fd-pill--absent">{subject.overdue}</span>
                                ) : (
                                  <span className="fd-pill fd-pill--ok">0</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {reports.turnaround.recent.length ? (
                      <div className="hod-recentuploads">
                        {reports.turnaround.recent.slice(0, 4).map((material) => (
                          <div key={material.sessionId} className="hod-recentupload">
                            <span className="fd-code">{material.subjectCode}</span>
                            <div>
                              <strong>{material.topic}</strong>
                              <span>
                                {material.facultyName} · {formatCompactDate(material.uploadedAt)}
                              </span>
                            </div>
                            <span className={material.withinSla ? 'hod-sla-ok' : 'hod-sla-late'}>
                              {formatHours(material.turnaroundHours)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section className="sd-panel">
                    <div className="sd-panel__head">
                      <div className="sd-panel__titlewrap">
                        <AttendanceIcon />
                        <h2 className="sd-panel__title">Notes SLA tracking</h2>
                      </div>
                      <span className="sd-panel__hint">
                        {reports.overdueNotes.length} overdue · {reports.slaHours}h target
                      </span>
                    </div>

                    {reports.overdueNotes.length ? (
                      <div className="hod-sla-list">
                        {reports.overdueNotes.map((note) => (
                          <article key={note.sessionId} className="hod-sla-item">
                            <div className="hod-sla-item__main">
                              <span className="fd-code">{note.subjectCode}</span>
                              <div>
                                <strong>{note.topic}</strong>
                                <span>
                                  {note.faculty.name} · due {formatDateTime(note.dueAt)}
                                </span>
                              </div>
                            </div>
                            <div className="hod-sla-item__actions">
                              <span className="hod-sla-late">
                                {formatHours(note.overdueHours)} overdue
                              </span>
                              <button
                                type="button"
                                className="hod-remind"
                                disabled={remindingId === note.sessionId}
                                onClick={() => handleReminder(note)}
                              >
                                <ReminderIcon />
                                {remindingId === note.sessionId
                                  ? 'Sending…'
                                  : note.reminderSentAt
                                    ? 'Remind again'
                                    : 'Send reminder'}
                              </button>
                              {note.reminderSentAt ? (
                                <span className="hod-sla-item__sent">
                                  Sent {formatDateTime(note.reminderSentAt)}
                                </span>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="fd-hint">
                        No notes are overdue against the {reports.slaHours}-hour publishing target.
                      </p>
                    )}
                  </section>
                </div>

                <section className="sd-panel">
                  <div className="sd-panel__head">
                    <div className="sd-panel__titlewrap">
                      <ReportsIcon />
                      <h2 className="sd-panel__title">Student resource access</h2>
                    </div>
                    <span className="sd-panel__hint">
                      {reports.access.trackedDownloads} downloads · {reports.access.trackedPreviews}{' '}
                      previews tracked
                    </span>
                  </div>

                  <div className="hod-access-overview">
                    <div className="hod-access-rate">
                      <strong>
                        {reports.access.summary.rate === null
                          ? '—'
                          : `${reports.access.summary.rate}%`}
                      </strong>
                      <span>resource access rate</span>
                    </div>
                    <div className="hod-access-facts">
                      <div>
                        <strong>{reports.access.summary.accessingStudents}</strong>
                        <span>of {reports.access.summary.eligibleStudents} eligible students reached</span>
                      </div>
                      <div>
                        <strong>{reports.access.summary.accessed}</strong>
                        <span>of {reports.access.summary.exposures} resource opens tracked</span>
                      </div>
                    </div>
                    <p className="fd-hint">
                      A resource open is counted when a student downloads or previews a file they
                      are eligible to view.
                    </p>
                  </div>

                  <div className="hod-tablewrap">
                    <table className="hod-table">
                      <thead>
                        <tr>
                          <th scope="col">Subject</th>
                          <th scope="col">Eligible students</th>
                          <th scope="col">Reached</th>
                          <th scope="col">Opens</th>
                          <th scope="col">Access rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.access.bySubject.map((subject) => (
                          <tr key={subject.id}>
                            <td>
                              <strong>{subject.code}</strong>
                              <span className="hod-table__sub">{subject.name}</span>
                            </td>
                            <td>{subject.access.eligibleStudents}</td>
                            <td>{subject.access.accessingStudents}</td>
                            <td>
                              {subject.access.accessed}/{subject.access.exposures}
                            </td>
                            <td>
                              <RateBar rate={subject.access.rate} compact />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
