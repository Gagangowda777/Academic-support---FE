import { useCallback, useEffect, useState } from 'react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api, apiUrl } from '../../lib/api';
import FacultyQuestionPapers from './FacultyQuestionPapers';
import FacultyQuestionBank from './FacultyQuestionBank';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

const EXAM_TYPE_LABELS = {
  mid_semester: 'Mid-Semester',
  end_semester: 'End-Semester',
  internal: 'Internal Assessment',
  quiz: 'Quiz',
  practical: 'Practical',
  viva: 'Viva',
};

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip', 'mp4'];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 6;

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
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10h18M8 15h4" />
  </Icon>
);

const LogoutIcon = () => (
  <Icon>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Icon>
);

const PapersIcon = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

const QuestionBankIcon = () => (
  <Icon>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 5.5v15M8 7h8M8 11h7M8 15h5" />
  </Icon>
);

const UploadIcon = () => (
  <Icon size={17}>
    <path d="M12 20V8M8 11l4-3 4 3M5 4h14" />
  </Icon>
);

const DownloadIcon = () => (
  <Icon size={15}>
    <path d="M12 4v10M8 11l4 3 4-3M5 19h14" />
  </Icon>
);

const AlertIcon = () => (
  <Icon size={20}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.2v.1" />
  </Icon>
);

const LinkIcon = () => (
  <Icon size={15}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </Icon>
);

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
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

function validateFiles(list) {
  if (list.length > MAX_FILES) return `Up to ${MAX_FILES} files can be attached at once.`;

  for (const file of list) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return `${file.name}: unsupported type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`;
    }

    if (extension === 'zip' && file.size > MAX_ZIP_BYTES) {
      return `${file.name}: zip archives must be 10 MB or smaller.`;
    }

    if (file.size > MAX_FILE_BYTES) {
      return `${file.name}: files must be 20 MB or smaller.`;
    }
  }

  return '';
}

async function downloadFile(attachment) {
  const response = await fetch(apiUrl(`/materials/${attachment.id}/download`), {
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'That file could not be downloaded.';
    try {
      const payload = await response.json();
      if (payload?.message) message = payload.message;
    } catch {
      // ignore non-JSON bodies
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function MetaList({ items }) {
  return (
    <dl className="fd-meta">
      {items.map(([label, value]) => (
        <div key={label} className="fd-meta__row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function UploadForm({ session, subjectId, onUploaded }) {
  const [title, setTitle] = useState(session.material?.title || '');
  const [description, setDescription] = useState(session.material?.description || '');
  const [objectives, setObjectives] = useState(session.material?.objectives || '');
  const [links, setLinks] = useState((session.material?.links || []).join('\n'));
  const [visibility, setVisibility] = useState(
    session.material?.visibility || 'absent'
  );
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState(
    session.material?.targetedStudents || []
  );
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visibility !== 'selected') return undefined;

    let active = true;
    setStudentsLoading(true);
    setStudentsError('');

    api
      .facultySubjectStudents(subjectId)
      .then((payload) => {
        if (active) setStudents(payload.students || []);
      })
      .catch((err) => {
        if (active) setStudentsError(err.message);
      })
      .finally(() => {
        if (active) setStudentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [subjectId, visibility]);

  function handleFiles(event) {
    const list = Array.from(event.target.files || []);
    const message = validateFiles(list);
    setError(message);
    setFiles(message ? [] : list);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!title.trim()) {
      setError('A topic/title is required.');
      return;
    }

    const fileError = validateFiles(files);
    if (fileError) {
      setError(fileError);
      return;
    }

    if (visibility === 'selected' && !selectedStudentIds.length) {
      setError('Choose at least one student to publish this material to.');
      return;
    }

    if (visibility === 'selected' && studentsError) {
      setError(studentsError);
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('objectives', objectives.trim());
    formData.append('links', links);
    formData.append('visibility', visibility);
    if (visibility === 'selected') {
      formData.append('studentIds', JSON.stringify(selectedStudentIds));
    }
    files.forEach((file) => formData.append('files', file));

    setSaving(true);

    try {
      const result = await api.uploadMaterial(session.id, formData);
      setNotice(result.message);
      setFiles([]);
      event.target.reset();
      await onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMaterial() {
    if (!window.confirm('Delete this material and all of its uploaded files?')) return;

    setError('');
    setNotice('');
    setDeleting(true);
    try {
      const result = await api.deleteSessionMaterial(session.id);
      setTitle('');
      setDescription('');
      setObjectives('');
      setLinks('');
      setVisibility('absent');
      setSelectedStudentIds([]);
      setNotice(result.message);
      await onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className="fd-form" onSubmit={handleSubmit}>
      <h3 className="fd-form__title">
        <UploadIcon />
        {session.material ? 'Update material' : 'Upload material'}
      </h3>

      {error ? (
        <div className="sd-alert" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? <p className="fd-notice">{notice}</p> : null}

      <label className="fd-field">
        <span className="field-label">Topic / title</span>
        <input
          className="text-input"
          value={title}
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Agile Estimation & Velocity - Slides"
          required
        />
      </label>

      <label className="fd-field">
        <span className="field-label">Description (optional)</span>
        <textarea
          className="text-input fd-textarea"
          value={description}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this session covered and what students should read first."
        />
      </label>

      <label className="fd-field">
        <span className="field-label">Learning objectives (optional)</span>
        <textarea
          className="text-input fd-textarea"
          value={objectives}
          rows={3}
          onChange={(event) => setObjectives(event.target.value)}
          placeholder="One objective per line, e.g. Estimate a backlog item with planning poker."
        />
      </label>

      <label className="fd-field">
        <span className="field-label">Reference links (optional)</span>
        <textarea
          className="text-input fd-textarea"
          value={links}
          rows={2}
          onChange={(event) => setLinks(event.target.value)}
          placeholder="One https:// link per line"
        />
      </label>

      <div className="fd-field">
        <span className="field-label">Attachments</span>
        <label className="fd-file">
          <input
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
            onChange={handleFiles}
          />
          <span>Choose files</span>
        </label>
        <p className="fd-hint">
          PDF, PPT/PPTX, DOC/DOCX, JPG, PNG, ZIP or MP4 video · up to {MAX_FILES} files, 20 MB each (zip 10 MB).
        </p>

        {files.length ? (
          <ul className="fd-filelist">
            {files.map((file) => (
              <li key={file.name}>
                <span>{file.name}</span>
                <span>{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <fieldset className="fd-visibility">
        <legend className="field-label">Publishing visibility</legend>
        <p className="fd-visibility__hint">
          Choose who can open this material as soon as you save it.
        </p>

        {[
          {
            value: 'draft',
            label: 'Save as Draft',
            detail: 'Students cannot see it yet and will not be notified.',
          },
          {
            value: 'absent',
            label: 'Publish only to Absent Students',
            detail: 'Visible to students marked absent for this session.',
          },
          {
            value: 'all',
            label: 'Publish to All Enrolled Students',
            detail: 'Visible to every student in this subject’s batch.',
          },
          {
            value: 'selected',
            label: 'Publish to Particular Student(s)',
            detail: 'Choose which students in this subject can view the material.',
          },
        ].map((option) => (
          <label
            key={option.value}
            className={`fd-radio${visibility === option.value ? ' fd-radio--selected' : ''}`}
          >
            <input
              type="radio"
              name={`visibility-${session.id}`}
              value={option.value}
              checked={visibility === option.value}
              onChange={(event) => setVisibility(event.target.value)}
            />
            <span className="fd-radio__body">
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </span>
          </label>
        ))}

        {visibility === 'selected' ? (
          <div className="fd-student-picker">
            {studentsLoading ? (
              <p className="fd-hint">Loading students…</p>
            ) : studentsError ? (
              <p className="fd-student-picker__error" role="alert">{studentsError}</p>
            ) : students.length ? (
              <>
                <p className="fd-student-picker__count">
                  {selectedStudentIds.length} of {students.length} selected
                </p>
                <div className="fd-student-picker__list">
                  {students.map((student) => (
                    <label className="fd-student-picker__row" key={student.id}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={(event) => {
                          setSelectedStudentIds((current) =>
                            event.target.checked
                              ? [...current, student.id]
                              : current.filter((id) => id !== student.id)
                          );
                        }}
                      />
                      <span>
                        <strong>{student.name}</strong>
                        <small>{student.enrollmentId}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="fd-hint">No students are available for this subject.</p>
            )}
          </div>
        ) : null}
      </fieldset>

      <button
        type="submit"
        className="fd-submit"
        disabled={saving || deleting || (visibility === 'selected' && studentsLoading)}
      >
        {saving
          ? 'Saving…'
          : visibility === 'draft'
            ? 'Save draft'
            : session.material
              ? 'Update published material'
              : 'Publish material'}
      </button>
      {session.material ? (
        <button
          type="button"
          className="fd-delete-material"
          onClick={handleDeleteMaterial}
          disabled={saving || deleting}
        >
          {deleting ? 'Deleting material…' : 'Delete material and all files'}
        </button>
      ) : null}
    </form>
  );
}

export default function FacultyDashboard() {
  const { user, logout } = useAuth();
  const [route, setRoute] = useState({ level: 'overview' });
  const [classes, setClasses] = useState([]);
  const [overview, setOverview] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [subjectView, setSubjectView] = useState(null);
  const [sessionView, setSessionView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [attachmentActionId, setAttachmentActionId] = useState('');

  const loadClasses = useCallback(async () => {
    const payload = await api.facultyClasses();
    setClasses(payload.subjects);
    return payload.subjects;
  }, []);

  const loadOverview = useCallback(async () => {
    const payload = await api.facultyOverview();
    setOverview(payload);
    return payload;
  }, []);

  const loadNotifications = useCallback(async () => {
    const payload = await api.facultyNotifications();
    setNotifications(payload.notifications || []);
    return payload;
  }, []);

  useEffect(() => {
    document.title = 'Faculty Portal — Campus Portal';
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await Promise.all([loadClasses(), loadOverview(), loadNotifications()]);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadClasses, loadOverview, loadNotifications]);

  async function openSubject(subjectId) {
    setLoading(true);
    setError('');
    setDownloadError('');

    try {
      const payload = await api.facultySubjectSessions(subjectId);
      setSubjectView(payload);
      setRoute({ level: 'subject', subjectId });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openSession(sessionId) {
    setLoading(true);
    setError('');
    setDownloadError('');

    try {
      const payload = await api.facultySession(sessionId);
      setSessionView(payload);
      setRoute({ level: 'session', subjectId: payload.subject.id, sessionId });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAfterUpload() {
    if (route.level !== 'session') return;

    const [detail, subjectPayload, classList, overviewPayload] = await Promise.all([
      api.facultySession(route.sessionId),
      api.facultySubjectSessions(route.subjectId),
      api.facultyClasses(),
      api.facultyOverview(),
    ]);

    setSessionView(detail);
    setSubjectView(subjectPayload);
    setClasses(classList.subjects);
    setOverview(overviewPayload);
  }

  async function handleDownload(attachment) {
    setDownloadError('');

    try {
      await downloadFile(attachment);
    } catch (err) {
      setDownloadError(err.message);
    }
  }

  async function handleReplaceAttachment(attachment, file) {
    setDownloadError('');
    const formData = new FormData();
    formData.append('file', file);
    setAttachmentActionId(attachment.id);

    try {
      const result = await api.replaceMaterialAttachment(attachment.id, formData);
      if (result.warning) setDownloadError(result.warning);
      await refreshAfterUpload();
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setAttachmentActionId('');
    }
  }

  async function handleDeleteAttachment(attachment) {
    if (!window.confirm(`Delete "${attachment.name}"?`)) return;

    setDownloadError('');
    setAttachmentActionId(attachment.id);
    try {
      await api.deleteMaterialAttachment(attachment.id);
      await refreshAfterUpload();
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setAttachmentActionId('');
    }
  }

  function goToOverview() {
    setRoute({ level: 'overview' });
    setSessionView(null);
    setSubjectView(null);
    setError('');
    setDownloadError('');
    setLoading(false);
    setOverviewLoading(true);
    Promise.all([loadOverview(), loadNotifications()])
      .catch((err) => setError(err.message))
      .finally(() => setOverviewLoading(false));
  }

  async function markNotificationsRead() {
    try {
      await api.facultyMarkNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    } catch (err) {
      setError(err.message);
    }
  }

  function goToClasses() {
    setRoute({ level: 'classes' });
    setSessionView(null);
    setSubjectView(null);
    setError('');
    setDownloadError('');
    setLoading(false);
    loadClasses().catch((err) => setError(err.message));
  }

  function goToPapers() {
    setRoute({ level: 'papers' });
    setSessionView(null);
    setSubjectView(null);
    setError('');
    setDownloadError('');
    setLoading(false);
  }

  function goToQuestionBank() {
    setRoute({ level: 'question-bank' });
    setSessionView(null);
    setSubjectView(null);
    setError('');
    setDownloadError('');
    setLoading(false);
  }

  function backToSubject() {
    const subjectId = subjectView?.subject.id || route.subjectId;
    setSessionView(null);
    openSubject(subjectId);
  }

  const subject = sessionView?.subject || subjectView?.subject || null;
  const title =
    route.level === 'overview'
      ? 'Faculty Overview'
      : route.level === 'papers'
        ? 'Question papers'
        : route.level === 'question-bank'
          ? 'AI question bank & past-paper analysis'
        : route.level === 'session'
          ? sessionView?.session.topic || 'Session'
          : route.level === 'subject'
            ? subject?.name || 'Subject'
            : 'My Classes';
  const classesActive = ['classes', 'subject', 'session'].includes(route.level);

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
            <p className="sd__meta">{user?.department} · Faculty</p>
          </div>
        </div>

        <nav className="sd__nav" aria-label="Faculty sections">
          <button
            type="button"
            className={`sd__navitem${route.level === 'overview' ? ' sd__navitem--active' : ''}`}
            aria-current={route.level === 'overview' ? 'page' : undefined}
            onClick={goToOverview}
          >
            <OverviewIcon />
            Overview
            {notifications.some((item) => !item.read) ? (
              <span className="sd__badge">
                {notifications.filter((item) => !item.read).length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`sd__navitem${classesActive ? ' sd__navitem--active' : ''}`}
            aria-current={classesActive ? 'page' : undefined}
            onClick={goToClasses}
          >
            <ClassesIcon />
            My Classes
            <span className="sd__badge">{classes.length}</span>
          </button>
          <button
            type="button"
            className={`sd__navitem${route.level === 'papers' ? ' sd__navitem--active' : ''}`}
            aria-current={route.level === 'papers' ? 'page' : undefined}
            onClick={goToPapers}
          >
            <PapersIcon />
            Question papers
          </button>
          <button
            type="button"
            className={`sd__navitem sd__navitem--wrap${route.level === 'question-bank' ? ' sd__navitem--active' : ''}`}
            aria-current={route.level === 'question-bank' ? 'page' : undefined}
            onClick={goToQuestionBank}
          >
            <QuestionBankIcon />
            AI question bank &amp; past-paper analysis
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
          <nav className="fd-crumbs" aria-label="Breadcrumb">
            <button type="button" onClick={goToOverview}>
              Overview
            </button>
            {route.level === 'classes' ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="fd-crumbs__current">My Classes</span>
              </>
            ) : null}
            {route.level === 'papers' ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="fd-crumbs__current">Question papers</span>
              </>
            ) : null}
            {route.level === 'question-bank' ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="fd-crumbs__current">AI question bank &amp; past-paper analysis</span>
              </>
            ) : null}
            {route.level !== 'classes' && route.level !== 'papers' && route.level !== 'question-bank' && subject ? (
              <>
                <span aria-hidden="true">/</span>
                <button type="button" onClick={backToSubject} disabled={route.level === 'subject'}>
                  {subject.code} · {subject.name}
                </button>
              </>
            ) : null}
            {route.level === 'session' && sessionView ? (
              <>
                <span aria-hidden="true">/</span>
                <span className="fd-crumbs__current">{sessionView.session.topic}</span>
              </>
            ) : null}
          </nav>

          <h1 className="sd__title">{title}</h1>
          <p className="sd__subtitle">
            Faculty Portal · {user?.department}
            {subject
              ? ` · ${subject.academicYear} · Semester ${subject.semester} · Batch ${subject.batch} · Section ${subject.section}`
              : ''}
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

        {loading ? (
          <div className="sd__state">
            <span className="spinner" aria-label="Loading" />
          </div>
        ) : null}

        {route.level === 'overview' && overview ? (
          <>
            {notifications.some((item) => !item.read) ? (
              <section className="sd-panel faculty-reminders" aria-label="Department reminders">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <PapersIcon />
                    <h2 className="sd-panel__title">Department reminders</h2>
                  </div>
                  <button type="button" className="ov-link" onClick={markNotificationsRead}>
                    Mark all read
                  </button>
                </div>

                <ul className="faculty-reminders__list">
                  {notifications
                    .filter((item) => !item.read)
                    .slice(0, 3)
                    .map((item) => (
                      <li key={item.id} className="faculty-reminders__item">
                        <span className="faculty-reminders__dot" aria-hidden="true" />
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.message}</p>
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            <section className="sd-summary" aria-label="Teaching snapshot">
              <article className="sd-summary__card">
                <span className="sd-summary__label">Assigned subjects</span>
                <strong className="sd-summary__value">{overview.stats.subjects}</strong>
                <span className="sd-summary__hint">
                  {overview.stats.sessions} sessions · {overview.stats.students} students
                </span>
              </article>

              <article className="sd-summary__card">
                <span className="sd-summary__label">Materials published</span>
                <strong className="sd-summary__value">{overview.stats.materials}</strong>
                <span className="sd-summary__hint">
                  {overview.stats.pendingMaterials} sessions still need notes
                </span>
              </article>

              <article className="sd-summary__card">
                <span className="sd-summary__label">Question paper average</span>
                <strong className="sd-summary__value">{overview.paperStats.averageScore}</strong>
                <span className="sd-summary__hint">
                  {overview.paperStats.approved} approved · {overview.paperStats.submitted} in review
                </span>
              </article>
            </section>

            {overviewLoading ? (
              <div className="sd__state">
                <span className="spinner" aria-label="Refreshing overview" />
              </div>
            ) : null}

            <div className="ov-grid">
              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <LinkIcon />
                    <h2 className="sd-panel__title">Material coverage</h2>
                  </div>
                  <span className="sd-panel__hint">
                    {overview.stats.materials}/{overview.stats.sessions}
                  </span>
                </div>
                <div className="sd-progress ov-progress" role="progressbar" aria-valuenow={overview.stats.materials} aria-valuemin={0} aria-valuemax={overview.stats.sessions || 1}>
                  <span
                    className="sd-progress__bar"
                    style={{
                      width: `${
                        overview.stats.sessions
                          ? Math.round((overview.stats.materials / overview.stats.sessions) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="ov-note">
                  {overview.stats.attachments} files uploaded across your classes.
                </p>

                {overview.pendingSessions.length ? (
                  <ul className="ov-list ov-list--compact">
                    {overview.pendingSessions.slice(0, 3).map((session) => (
                      <li key={session.id} className="ov-list__row ov-list__row--click" onClick={() => openSession(session.id)}>
                        <div className="ov-list__body">
                          <p className="ov-list__title">{session.topic}</p>
                          <p className="ov-list__meta">
                            {session.courseCode} · {formatDate(session.date)}
                          </p>
                        </div>
                        <span className="ov-pill ov-pill--warn">Add notes</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ov-note ov-note--good">Every session has material published.</p>
                )}
              </section>

              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <PapersIcon />
                    <h2 className="sd-panel__title">Upcoming exams &amp; papers</h2>
                  </div>
                  <button type="button" className="ov-link" onClick={goToPapers}>
                    Manage papers
                  </button>
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
                          <p className="ov-list__title">{exam.subject?.name || exam.name}</p>
                          <p className="ov-list__meta">
                            {`${EXAM_TYPE_LABELS[exam.type] || exam.type} · ${exam.paperCount} set${
                              exam.paperCount === 1 ? '' : 's'
                            } · `}
                            {exam.myPaperCount
                              ? `your best ${exam.myBestScore}`
                              : 'not submitted'}
                          </p>
                        </div>
                        <span className={`ov-pill${exam.approved ? ' ov-pill--good' : ''}`}>
                          {exam.approved ? 'Approved' : exam.myPaperCount ? 'In review' : 'Open'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ov-empty">No upcoming examinations for your subjects.</div>
                )}
              </section>

              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <PapersIcon />
                    <h2 className="sd-panel__title">Recent submissions</h2>
                  </div>
                  <span className="sd-panel__hint">AI rubric score</span>
                </div>

                {overview.recentPapers.length ? (
                  <ul className="ov-list">
                    {overview.recentPapers.map((paper) => (
                      <li key={paper.id} className="ov-list__row">
                        <div className="ov-list__body">
                          <p className="ov-list__title">{paper.title}</p>
                          <p className="ov-list__meta">
                            {paper.status === 'approved'
                              ? 'Approved by Exam Cell'
                              : paper.status === 'rejected'
                                ? 'Returned for revision'
                                : 'Awaiting review'}
                          </p>
                        </div>
                        <span className="ov-score">{paper.score}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ov-empty">
                    Submit a question paper to see its rubric score here.
                  </div>
                )}
              </section>
            </div>

            <section className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <ClassesIcon />
                  <h2 className="sd-panel__title">Subject workload</h2>
                </div>
                <span className="sd-panel__hint">{overview.subjects.length} subjects</span>
              </div>

              <div className="ov-subjects">
                {overview.subjects.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ov-subject"
                    onClick={() => openSubject(item.id)}
                  >
                    <div>
                      <span className="fd-code">{item.code}</span>
                      <p className="ov-subject__name">{item.name}</p>
                      <p className="ov-list__meta">
                        Semester {item.semester} · Batch {item.batch} · Section {item.section}
                      </p>
                    </div>
                    <div className="ov-subject__stats">
                      <span>{item.studentCount} students</span>
                      <span>{item.sessionCount} sessions</span>
                      <span>{item.materialCount} materials</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!loading && !error && route.level === 'classes' ? (
          <section className="fd-classes">
            {classes.map((item) => (
              <article key={item.id} className="fd-class">
                <div className="fd-class__head">
                  <span className="fd-code">{item.code}</span>
                  <span className="fd-chip">{item.sessionCount} sessions</span>
                </div>
                <h2 className="fd-class__name">{item.name}</h2>

                <MetaList
                  items={[
                    ['Academic year', item.academicYear],
                    ['Semester', `Semester ${item.semester}`],
                    ['Department', item.department],
                    ['Batch', item.batch],
                    ['Section', item.section],
                  ]}
                />

                <div className="fd-class__stats">
                  <span>{item.studentCount} students</span>
                  <span>{item.presentCount} present marks</span>
                  <span>{item.absentCount} absent marks</span>
                  <span>
                    {item.materialCount}/{item.sessionCount} materials
                  </span>
                </div>

                <button type="button" className="sd-download" onClick={() => openSubject(item.id)}>
                  Open subject
                </button>
              </article>
            ))}

            {!classes.length ? (
              <div className="sd-panel">
                <div className="sd-empty">
                  <p className="sd-empty__title">No subjects assigned</p>
                  <p className="sd-empty__text">
                    Ask the academic office to assign subjects to your faculty account.
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {route.level === 'papers' ? <FacultyQuestionPapers /> : null}
        {route.level === 'question-bank' ? <FacultyQuestionBank /> : null}

        {!loading && !error && route.level === 'subject' && subjectView ? (
          <section className="sd-panel">
            <div className="sd-panel__head">
              <div className="sd-panel__titlewrap">
                <ClassesIcon />
                <h2 className="sd-panel__title">Class sessions</h2>
              </div>
              <span className="sd-panel__hint">
                {subjectView.sessions.length} sessions · select a completed lecture to manage its
                material
              </span>
            </div>

            <div className="fd-list">
              {subjectView.sessions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fd-row"
                  onClick={() => openSession(item.id)}
                >
                  <span className="fd-row__date">
                    <strong>{formatDate(item.date)}</strong>
                    <span>
                      {item.startTime} – {item.endTime}
                    </span>
                  </span>

                  <span className="fd-row__main">
                    <strong>{item.topic}</strong>
                    <span>
                      {item.room} · {item.status}
                    </span>
                  </span>

                  <span className="fd-row__pills">
                    <span className="fd-pill fd-pill--present">{item.attendance.present} present</span>
                    <span className="fd-pill fd-pill--absent">{item.attendance.absent} absent</span>
                    {item.attendance.marked ? (
                      <span className="fd-pill">Attendance marked</span>
                    ) : (
                      <span className="fd-pill fd-pill--pending">Not marked</span>
                    )}
                  </span>

                  <span className="fd-row__pills">
                    {item.material ? (
                      <span className="fd-pill fd-pill--ok">
                        Material · {item.material.attachmentCount} file
                        {item.material.attachmentCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="fd-pill fd-pill--pending">Material pending</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && !error && route.level === 'session' && sessionView ? (
          <section className="fd-session-grid">
            <div className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <ClassesIcon />
                  <h2 className="sd-panel__title">Session details</h2>
                </div>
                <span className="fd-chip">{sessionView.session.courseCode}</span>
              </div>

              <MetaList
                items={[
                  ['Subject', `${subject?.code} · ${subject?.name}`],
                  ['Topic', sessionView.session.topic],
                  ['Date & time', `${formatDate(sessionView.session.date)} · ${sessionView.session.startTime} – ${sessionView.session.endTime}`],
                  ['Room', sessionView.session.room],
                  ['Department', subject?.department],
                  ['Semester', `Semester ${subject?.semester} · Batch ${subject?.batch} · Section ${subject?.section}`],
                  ['Academic year', subject?.academicYear],
                ]}
              />

              <div className="fd-attendance">
                <div className="fd-tile">
                  <span className="fd-tile__value">{sessionView.session.attendance.present}</span>
                  <span className="fd-tile__label">Present</span>
                </div>
                <div className="fd-tile">
                  <span className="fd-tile__value">{sessionView.session.attendance.absent}</span>
                  <span className="fd-tile__label">Absent</span>
                </div>
                <div className="fd-tile">
                  <span className="fd-tile__value">{sessionView.session.attendance.late}</span>
                  <span className="fd-tile__label">Late</span>
                </div>
                <div className="fd-tile">
                  <span className="fd-tile__value">{sessionView.session.attendance.marked}</span>
                  <span className="fd-tile__label">Marks recorded</span>
                </div>
              </div>

              <div className="fd-material">
                <h3 className="fd-form__title">Published material</h3>

                {sessionView.session.material ? (
                  <>
                    <p className="fd-material__title">{sessionView.session.material.title}</p>
                    <span
                      className={`fd-visibilitybadge fd-visibilitybadge--${sessionView.session.material.visibility || 'absent'}`}
                    >
                      {(sessionView.session.material.visibility || 'absent') === 'draft'
                        ? 'Draft · not visible to students'
                        : (sessionView.session.material.visibility || 'absent') === 'all'
                          ? 'Published to all enrolled students'
                          : (sessionView.session.material.visibility || 'absent') === 'selected'
                            ? `Published to ${sessionView.session.material.targetedStudents.length} selected student${sessionView.session.material.targetedStudents.length === 1 ? '' : 's'}`
                            : 'Published to absent students'}
                    </span>
                    {sessionView.session.material.description ? (
                      <p className="fd-material__text">{sessionView.session.material.description}</p>
                    ) : null}

                    {sessionView.session.material.objectives ? (
                      <div className="fd-material__block">
                        <span className="field-label">Learning objectives</span>
                        <p className="fd-material__text">{sessionView.session.material.objectives}</p>
                      </div>
                    ) : null}

                    {sessionView.session.material.links.length ? (
                      <div className="fd-material__block">
                        <span className="field-label">Reference links</span>
                        <ul className="fd-links">
                          {sessionView.session.material.links.map((link) => (
                            <li key={link}>
                              <LinkIcon />
                              <a href={link} target="_blank" rel="noreferrer noopener">
                                {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="fd-material__block">
                      <span className="field-label">Attachments</span>
                      {sessionView.session.material.attachments.length ? (
                        <ul className="fd-files">
                          {sessionView.session.material.attachments.map((attachment) => (
                            <li key={attachment.id}>
                              <span className="fd-files__ext">{attachment.extension}</span>
                              <span className="fd-files__name">{attachment.name}</span>
                              <span className="fd-files__size">{formatBytes(attachment.size)}</span>
                              <button
                                type="button"
                                className="fd-files__btn"
                                onClick={() => handleDownload(attachment)}
                                disabled={Boolean(attachmentActionId)}
                              >
                                <DownloadIcon />
                                Download
                              </button>
                              <label className="fd-files__btn">
                                Replace
                                <input
                                  type="file"
                                  accept={ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
                                  disabled={Boolean(attachmentActionId)}
                                  aria-label={`Replace ${attachment.name}`}
                                  onChange={(event) => {
                                    const [file] = Array.from(event.target.files || []);
                                    if (file) handleReplaceAttachment(attachment, file);
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className="fd-files__btn fd-files__btn--danger"
                                onClick={() => handleDeleteAttachment(attachment)}
                                disabled={Boolean(attachmentActionId)}
                              >
                                {attachmentActionId === attachment.id ? 'Saving…' : 'Delete'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="fd-hint">No files attached yet.</p>
                      )}
                    </div>

                    {downloadError ? (
                      <div className="sd-alert" role="alert">
                        <AlertIcon />
                        <span>{downloadError}</span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="fd-hint">
                    No material published for this session yet. Students marked absent will see it
                    here as soon as you publish.
                  </p>
                )}
              </div>
            </div>

            <UploadForm
              key={sessionView.session.id}
              session={sessionView.session}
              subjectId={sessionView.subject.id}
              onUploaded={refreshAfterUpload}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
