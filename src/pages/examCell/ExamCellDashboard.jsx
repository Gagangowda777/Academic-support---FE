import { useCallback, useEffect, useMemo, useState } from 'react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import ExamCellQuestionPapers from './ExamCellQuestionPapers';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

const updatedFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const EXAM_TYPES = [
  { value: 'internal', label: 'Internal assessment' },
  { value: 'mid_semester', label: 'Mid-semester' },
  { value: 'end_semester', label: 'End-semester' },
  { value: 'practical', label: 'Practical' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'other', label: 'Other' },
];

const TYPE_LABELS = Object.fromEntries(EXAM_TYPES.map((type) => [type.value, type.label]));

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_LABELS = Object.fromEntries(STATUSES.map((status) => [status.value, status.label]));

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${weekdayFormat.format(date)}, ${dateFormat.format(date)}`;
}

function initialsFrom(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
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

const ExamsIcon = () => (
  <Icon>
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v5h5M10 12h5M10 16h5" />
  </Icon>
);

const SyllabusIcon = () => (
  <Icon>
    <path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2z" />
    <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
  </Icon>
);

const PapersIcon = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

const PlusIcon = () => (
  <Icon size={16}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

const EditIcon = () => (
  <Icon size={15}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
);

const TrashIcon = () => (
  <Icon size={15}>
    <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
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

function emptyForm(subjectId) {
  return {
    subjectId: subjectId || '',
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

export default function ExamCellDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('exams');
  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({ subjectId: '', status: '', q: '' });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => emptyForm(''));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const [planSubjectId, setPlanSubjectId] = useState('');
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planDirty, setPlanDirty] = useState(false);

  const refresh = useCallback(async () => {
    const [overviewPayload, examPayload] = await Promise.all([
      api.examCellOverview(),
      api.examCellExams(),
    ]);

    setOverview(overviewPayload);
    setExams(examPayload.exams);
    setSubjects(examPayload.subjects);
  }, []);

  useEffect(() => {
    document.title = 'Examination Cell — Campus Portal';
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [refresh]);

  const stats = overview?.stats;
  const planSubjects = overview?.subjects || [];

  useEffect(() => {
    if (tab !== 'syllabus' || planSubjectId) return;
    const first = planSubjects[0];
    if (first) setPlanSubjectId(first.id);
  }, [tab, planSubjectId, planSubjects]);

  useEffect(() => {
    if (tab !== 'syllabus' || !planSubjectId) return undefined;

    let active = true;
    setPlanLoading(true);
    setPlanError('');

    (async () => {
      try {
        const payload = await api.examCellPlan(planSubjectId);
        if (!active) return;
        setPlan(payload.plan);
        setPlanDirty(false);
      } catch (err) {
        if (active) setPlanError(err.message);
      } finally {
        if (active) setPlanLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [tab, planSubjectId]);

  const visibleExams = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();

    return exams.filter((exam) => {
      if (filters.subjectId && exam.subject?.id !== filters.subjectId) return false;
      if (filters.status && exam.status !== filters.status) return false;
      if (!needle) return true;

      return (
        exam.name.toLowerCase().includes(needle) ||
        (exam.subject?.code || '').toLowerCase().includes(needle) ||
        (exam.subject?.name || '').toLowerCase().includes(needle)
      );
    });
  }, [exams, filters]);

  const selectedPlanSubject = planSubjects.find((subject) => subject.id === planSubjectId) || null;

  function switchTab(nextTab) {
    setTab(nextTab);
    setError('');
    setNotice('');
  }

  function openNewExam() {
    setEditingId(null);
    setForm(emptyForm(subjects[0]?.id));
    setFormError('');
    setNotice('');
    setFormOpen(true);
  }

  function openEditExam(exam) {
    setEditingId(exam.id);
    setForm({
      subjectId: exam.subject?.id || '',
      name: exam.name,
      type: exam.type,
      date: exam.date.slice(0, 10),
      startTime: exam.startTime,
      endTime: exam.endTime,
      room: exam.room || '',
      maxMarks: String(exam.maxMarks),
      passMarks: String(exam.passMarks),
      status: exam.status,
      notes: exam.notes || '',
    });
    setFormError('');
    setNotice('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormError('');
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleExamSubmit(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!form.subjectId) {
      setFormError('Select the subject this exam belongs to.');
      return;
    }

    if (!form.name.trim()) {
      setFormError('Enter an exam name.');
      return;
    }

    if (!form.date) {
      setFormError('Choose the exam date.');
      return;
    }

    const max = Number(form.maxMarks);
    const pass = Number(form.passMarks);

    if (!Number.isInteger(max) || max < 1) {
      setFormError('Maximum marks must be a whole number of at least 1.');
      return;
    }

    if (!Number.isInteger(pass) || pass < 0) {
      setFormError('Passing marks must be a whole number.');
      return;
    }

    if (pass > max) {
      setFormError('Passing marks cannot be greater than the maximum marks.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        room: form.room.trim(),
        maxMarks: max,
        passMarks: pass,
        notes: form.notes.trim(),
      };

      const result = editingId
        ? await api.examCellUpdateExam(editingId, payload)
        : await api.examCellCreateExam(payload);

      setNotice(result.message);
      closeForm();
      await refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exam) {
    const label = `${exam.name} (${exam.subject?.code || 'subject'})`;
    if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;

    setDeletingId(exam.id);
    setError('');
    setNotice('');

    try {
      const result = await api.examCellDeleteExam(exam.id);
      setNotice(result.message);
      if (editingId === exam.id) closeForm();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  }

  function choosePlanSubject(subjectId) {
    if (subjectId === planSubjectId) return;
    if (planDirty && !window.confirm('Discard the unsaved changes to this plan?')) return;
    setPlanSubjectId(subjectId);
  }

  function mutatePlan(mutator) {
    setPlan((current) => mutator(current));
    setPlanDirty(true);
    setPlanError('');
  }

  function updateUnit(index, field, value) {
    mutatePlan((current) => ({
      ...current,
      syllabus: current.syllabus.map((unit, unitIndex) =>
        unitIndex === index ? { ...unit, [field]: value } : unit
      ),
    }));
  }

  function addUnit() {
    mutatePlan((current) => ({
      ...current,
      syllabus: [...current.syllabus, { title: '', topics: '' }],
    }));
  }

  function removeUnit(index) {
    mutatePlan((current) => ({
      ...current,
      syllabus: current.syllabus.filter((_, unitIndex) => unitIndex !== index),
    }));
  }

  function updateComponent(index, field, value) {
    mutatePlan((current) => ({
      ...current,
      components: current.components.map((component, componentIndex) =>
        componentIndex === index ? { ...component, [field]: value } : component
      ),
    }));
  }

  function addComponent() {
    mutatePlan((current) => ({
      ...current,
      components: [...current.components, { name: '', maxMarks: 10 }],
    }));
  }

  function removeComponent(index) {
    mutatePlan((current) => ({
      ...current,
      components: current.components.filter((_, componentIndex) => componentIndex !== index),
    }));
  }

  const planTotal = (plan?.components || []).reduce(
    (total, component) => total + (Number(component.maxMarks) || 0),
    0
  );

  async function handlePlanSave() {
    if (!planSubjectId || !plan) return;

    setPlanSaving(true);
    setPlanError('');
    setNotice('');

    try {
      const result = await api.examCellSavePlan(planSubjectId, {
        syllabus: plan.syllabus.map((unit) => ({
          title: unit.title,
          topics: unit.topics || '',
        })),
        components: plan.components.map((component) => ({
          name: component.name,
          maxMarks: Number(component.maxMarks),
        })),
        notes: plan.notes || '',
      });

      setPlan(result.plan);
      setPlanDirty(false);
      setNotice(result.message);
      await refresh();
    } catch (err) {
      setPlanError(err.message);
    } finally {
      setPlanSaving(false);
    }
  }

  const title =
    tab === 'exams' ? 'Examinations' : tab === 'papers' ? 'Question papers' : 'Syllabus & marks';

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
            <p className="sd__meta">{user?.department} · Institution-wide</p>
          </div>
        </div>

        <nav className="sd__nav" aria-label="Examination Cell sections">
          <button
            type="button"
            className={`sd__navitem${tab === 'exams' ? ' sd__navitem--active' : ''}`}
            aria-current={tab === 'exams' ? 'page' : undefined}
            onClick={() => switchTab('exams')}
          >
            <ExamsIcon />
            Exams
            {stats?.exams ? <span className="sd__badge">{stats.exams}</span> : null}
          </button>
          <button
            type="button"
            className={`sd__navitem${tab === 'syllabus' ? ' sd__navitem--active' : ''}`}
            aria-current={tab === 'syllabus' ? 'page' : undefined}
            onClick={() => switchTab('syllabus')}
          >
            <SyllabusIcon />
            Syllabus &amp; marks
            {stats?.subjects ? <span className="sd__badge">{stats.subjects}</span> : null}
          </button>
          <button
            type="button"
            className={`sd__navitem${tab === 'papers' ? ' sd__navitem--active' : ''}`}
            aria-current={tab === 'papers' ? 'page' : undefined}
            onClick={() => switchTab('papers')}
          >
            <PapersIcon />
            Question papers
          </button>
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
            {tab === 'papers'
              ? 'Examination Cell · AI paper review and final approval'
              : 'Examination Cell · Institution-wide exam scheduling and syllabus planning'}
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

        {!loading && tab === 'exams' && stats ? (
          <>
            <section className="hod-stats">
              <StatCard
                label="Exams scheduled"
                value={stats.exams}
                hint={`${stats.upcoming} upcoming · ${stats.completed} completed`}
              />
              <StatCard
                label="Upcoming"
                value={stats.upcoming}
                hint="scheduled from today onwards"
                accent
              />
              <StatCard
                label="Subjects"
                value={stats.subjects}
                hint={`${stats.subjectsWithPlan} with syllabus defined`}
              />
              <StatCard
                label="Syllabus pending"
                value={stats.subjectsWithoutPlan}
                hint="subjects without units or marks"
              />
            </section>

            <div className="ex-toolbar">
              <button type="button" className="ex-btn ex-btn--primary" onClick={openNewExam}>
                <PlusIcon />
                Add exam
              </button>

              <label className="ex-filter">
                <span className="field-label">Subject</span>
                <select
                  className="ex-select"
                  value={filters.subjectId}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, subjectId: event.target.value }))
                  }
                >
                  <option value="">All subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} · {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ex-filter">
                <span className="field-label">Status</span>
                <select
                  className="ex-select"
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  <option value="">Any status</option>
                  {STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ex-filter ex-filter--search">
                <span className="field-label">Search</span>
                <input
                  className="text-input"
                  value={filters.q}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, q: event.target.value }))
                  }
                  placeholder="Exam, subject code or name"
                />
              </label>
            </div>

            {formOpen ? (
              <form className="ex-form" onSubmit={handleExamSubmit}>
                <div className="ex-form__head">
                  <h2 className="ex-form__title">
                    {editingId ? 'Edit exam' : 'Add an exam'}
                  </h2>
                  <button type="button" className="ex-linkbtn" onClick={closeForm}>
                    Cancel
                  </button>
                </div>

                {formError ? (
                  <div className="sd-alert" role="alert">
                    <AlertIcon />
                    <span>{formError}</span>
                  </div>
                ) : null}

                <div className="ex-grid">
                  <label className="fd-field">
                    <span className="field-label">Subject</span>
                    <select
                      className="ex-select"
                      value={form.subjectId}
                      onChange={(event) => setField('subjectId', event.target.value)}
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
                      value={form.name}
                      maxLength={160}
                      onChange={(event) => setField('name', event.target.value)}
                      placeholder="e.g. Mid-Semester Examination"
                      required
                    />
                  </label>

                  <label className="fd-field">
                    <span className="field-label">Type</span>
                    <select
                      className="ex-select"
                      value={form.type}
                      onChange={(event) => setField('type', event.target.value)}
                    >
                      {EXAM_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="fd-field">
                    <span className="field-label">Date</span>
                    <input
                      type="date"
                      className="text-input"
                      value={form.date}
                      onChange={(event) => setField('date', event.target.value)}
                      required
                    />
                  </label>

                  <label className="fd-field">
                    <span className="field-label">Start time</span>
                    <input
                      type="time"
                      className="text-input"
                      value={form.startTime}
                      onChange={(event) => setField('startTime', event.target.value)}
                      required
                    />
                  </label>

                  <label className="fd-field">
                    <span className="field-label">End time</span>
                    <input
                      type="time"
                      className="text-input"
                      value={form.endTime}
                      onChange={(event) => setField('endTime', event.target.value)}
                      required
                    />
                  </label>

                  <label className="fd-field">
                    <span className="field-label">Room / hall (optional)</span>
                    <input
                      className="text-input"
                      value={form.room}
                      maxLength={80}
                      onChange={(event) => setField('room', event.target.value)}
                      placeholder="e.g. CS-204 or Exam Hall 1"
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
                      value={form.maxMarks}
                      onChange={(event) => setField('maxMarks', event.target.value)}
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
                      value={form.passMarks}
                      onChange={(event) => setField('passMarks', event.target.value)}
                      required
                    />
                  </label>

                  <label className="fd-field">
                    <span className="field-label">Status</span>
                    <select
                      className="ex-select"
                      value={form.status}
                      onChange={(event) => setField('status', event.target.value)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="fd-field ex-field--full">
                    <span className="field-label">Notes (optional)</span>
                    <textarea
                      className="text-input fd-textarea"
                      rows={2}
                      value={form.notes}
                      onChange={(event) => setField('notes', event.target.value)}
                      placeholder="Syllabus coverage, hall ticket instructions, invigilation notes…"
                    />
                  </label>
                </div>

                <div className="ex-form__actions">
                  <button type="button" className="ex-btn" onClick={closeForm}>
                    Cancel
                  </button>
                  <button type="submit" className="ex-btn ex-btn--primary" disabled={saving}>
                    {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create exam'}
                  </button>
                </div>
              </form>
            ) : null}

            <section className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <ExamsIcon />
                  <h2 className="sd-panel__title">Exam schedule</h2>
                </div>
                <span className="sd-panel__hint">
                  {visibleExams.length} of {exams.length} exams
                </span>
              </div>

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
                    {visibleExams.map((exam) => (
                      <tr key={exam.id}>
                        <td>
                          <strong>{exam.name}</strong>
                          <span className="hod-table__sub">{TYPE_LABELS[exam.type]}</span>
                        </td>
                        <td>
                          <strong>{exam.subject?.code || '—'}</strong>
                          <span className="hod-table__sub">
                            {exam.subject ? `${exam.subject.name} · Sem ${exam.subject.semester}` : 'Subject removed'}
                          </span>
                        </td>
                        <td>
                          <strong>{formatDate(exam.date)}</strong>
                          <span className="hod-table__sub">
                            {exam.startTime} – {exam.endTime}
                          </span>
                        </td>
                        <td>{exam.room || '—'}</td>
                        <td>
                          <strong>{exam.maxMarks}</strong>
                          <span className="hod-table__sub">pass {exam.passMarks}</span>
                        </td>
                        <td>
                          <span className={`ex-status ex-status--${exam.status}`}>
                            {STATUS_LABELS[exam.status]}
                          </span>
                        </td>
                        <td>
                          <div className="ex-actions">
                            <button
                              type="button"
                              className="ex-iconbtn"
                              aria-label={`Edit ${exam.name}`}
                              title="Edit exam"
                              onClick={() => openEditExam(exam)}
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="ex-iconbtn ex-iconbtn--danger"
                              aria-label={`Delete ${exam.name}`}
                              title="Delete exam"
                              onClick={() => handleDelete(exam)}
                              disabled={deletingId === exam.id}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!visibleExams.length ? (
                <div className="sd-empty">
                  <p className="sd-empty__title">No exams match these filters</p>
                  <p className="sd-empty__text">
                    {exams.length
                      ? 'Clear the filters to see the full schedule.'
                      : 'Add the first exam to build the schedule.'}
                  </p>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {!loading && tab === 'papers' ? <ExamCellQuestionPapers /> : null}

        {!loading && tab === 'syllabus' ? (
          <>
            <div className="ex-toolbar">
              <label className="ex-filter ex-filter--subject">
                <span className="field-label">Class / subject</span>
                <select
                  className="ex-select"
                  value={planSubjectId}
                  onChange={(event) => choosePlanSubject(event.target.value)}
                >
                  <option value="">Select subject</option>
                  {planSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} · {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPlanSubject ? (
                <p className="ex-planhint">
                  {selectedPlanSubject.department} · Semester {selectedPlanSubject.semester} · Batch{' '}
                  {selectedPlanSubject.batch} · Section {selectedPlanSubject.section}
                </p>
              ) : null}
            </div>

            {planLoading ? (
              <div className="sd__state">
                <span className="spinner" aria-label="Loading syllabus" />
              </div>
            ) : null}

            {!planLoading && planError ? (
              <div className="sd-panel">
                <div className="sd-alert" role="alert">
                  <AlertIcon />
                  <span>{planError}</span>
                </div>
              </div>
            ) : null}

            {!planLoading && plan ? (
              <div className="ex-plan">
                <section className="ex-card">
                  <div className="ex-card__head">
                    <h2 className="ex-card__title">Examination Board syllabus</h2>
                    <span className="fd-chip">{plan.syllabus.length} units</span>
                  </div>

                  <p className="ex-card__hint">
                    Define the units and topics this examination covers, in the order they are
                    taught.
                  </p>

                  {plan.syllabus.map((unit, index) => (
                    <div className="ex-unit" key={`unit-${index}`}>
                      <div className="ex-unit__head">
                        <span className="ex-unit__index">Unit {index + 1}</span>
                        <button
                          type="button"
                          className="ex-iconbtn ex-iconbtn--danger"
                          aria-label={`Remove unit ${index + 1}`}
                          title="Remove unit"
                          onClick={() => removeUnit(index)}
                        >
                          <TrashIcon />
                        </button>
                      </div>

                      <input
                        className="text-input"
                        value={unit.title}
                        maxLength={160}
                        placeholder="Unit title, e.g. Normalisation"
                        onChange={(event) => updateUnit(index, 'title', event.target.value)}
                      />

                      <textarea
                        className="text-input fd-textarea"
                        rows={2}
                        value={unit.topics}
                        placeholder="Topics covered in this unit"
                        onChange={(event) => updateUnit(index, 'topics', event.target.value)}
                      />
                    </div>
                  ))}

                  {!plan.syllabus.length ? (
                    <p className="fd-hint">No units yet. Add the first unit below.</p>
                  ) : null}

                  <button type="button" className="ex-btn ex-addbtn" onClick={addUnit}>
                    <PlusIcon />
                    Add unit
                  </button>
                </section>

                <section className="ex-card">
                  <div className="ex-card__head">
                    <h2 className="ex-card__title">Marks scheme</h2>
                    <span className="fd-chip">{plan.components.length} components</span>
                  </div>

                  <p className="ex-card__hint">
                    Components make up the total marks, for example internal assessments plus the
                    end-semester paper.
                  </p>

                  {plan.components.map((component, index) => (
                    <div className="ex-component" key={`component-${index}`}>
                      <input
                        className="text-input"
                        value={component.name}
                        maxLength={80}
                        placeholder="Component name"
                        aria-label={`Component ${index + 1} name`}
                        onChange={(event) => updateComponent(index, 'name', event.target.value)}
                      />

                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        className="text-input ex-marksinput"
                        value={component.maxMarks}
                        aria-label={`Component ${index + 1} maximum marks`}
                        onChange={(event) =>
                          updateComponent(index, 'maxMarks', event.target.value)
                        }
                      />

                      <button
                        type="button"
                        className="ex-iconbtn ex-iconbtn--danger"
                        aria-label={`Remove component ${index + 1}`}
                        title="Remove component"
                        onClick={() => removeComponent(index)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}

                  {!plan.components.length ? (
                    <p className="fd-hint">No components yet. Add the first component below.</p>
                  ) : null}

                  <button type="button" className="ex-btn ex-addbtn" onClick={addComponent}>
                    <PlusIcon />
                    Add component
                  </button>

                  <div className="ex-total">
                    <span>Total marks</span>
                    <strong>{planTotal}</strong>
                  </div>

                  <label className="fd-field ex-notes">
                    <span className="field-label">Notes (optional)</span>
                    <textarea
                      className="text-input fd-textarea"
                      rows={2}
                      value={plan.notes || ''}
                      maxLength={1000}
                      placeholder="Exam pattern, practical weighting, instructions…"
                      onChange={(event) =>
                        mutatePlan((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </label>

                  <div className="ex-form__actions">
                    <button
                      type="button"
                      className="ex-btn ex-btn--primary"
                      onClick={handlePlanSave}
                      disabled={planSaving || !planDirty}
                    >
                      {planSaving ? 'Saving…' : 'Save syllabus & marks'}
                    </button>
                  </div>

                  <p className="ex-updated">
                    {plan.updatedAt
                      ? `Last updated ${updatedFormat.format(new Date(plan.updatedAt))}${
                          plan.updatedBy ? ` by ${plan.updatedBy}` : ''
                        }`
                      : 'Not saved yet.'}
                    {planDirty ? ' · Unsaved changes' : ''}
                  </p>
                </section>
              </div>
            ) : null}

            {!planLoading && !plan && !planError ? (
              <div className="sd-panel">
                <div className="sd-empty">
                  <p className="sd-empty__title">Select a subject</p>
                  <p className="sd-empty__text">
                    Choose a class above to define its syllabus and marks scheme.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
