import { useCallback, useEffect, useMemo, useState } from 'react';
import Brand from '../../components/Brand';
import { useAuth } from '../../context/AuthContext';
import { api, apiUrl } from '../../lib/api';

const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
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

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'awaiting', label: 'Awaiting Notes' },
  { key: 'reviewed', label: 'Reviewed' },
];

const LINK_GROUPS = [
  {
    key: 'video',
    label: 'Video lectures',
    hosts: ['youtube.com', 'youtu.be', 'vimeo.com'],
  },
  {
    key: 'reading',
    label: 'Reading & documentation',
    hosts: [
      'wikipedia.org',
      'github.com',
      'rfc-editor.org',
      'arxiv.org',
      'cp-algorithms.com',
      'postgresql.org',
      'wisc.edu',
      'docs.google.com',
      'developer.mozilla.org',
    ],
  },
];

function formatSessionDate(iso) {
  const date = new Date(iso);
  return `${weekdayFormat.format(date)}, ${dateFormat.format(date)}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canPreview(attachment) {
  return (
    attachment.mimeType === 'application/pdf' ||
    attachment.mimeType === 'image/jpeg' ||
    attachment.mimeType === 'image/png'
  );
}

function displayLink(url) {
  const cleaned = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return cleaned.length > 52 ? `${cleaned.slice(0, 52)}…` : cleaned;
}

function timeAgo(iso) {
  if (!iso) return 'recently';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60 * 1000) return 'just now';
  const minutes = Math.round(diff / (60 * 1000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return dateFormat.format(new Date(iso));
}

function groupLinks(links = []) {
  const groups = new Map();

  links.forEach((link) => {
    let host = '';
    try {
      host = new URL(link).hostname.replace(/^www\./, '');
    } catch {
      host = '';
    }

    const group =
      LINK_GROUPS.find((candidate) =>
        candidate.hosts.some((item) => host === item || host.endsWith(`.${item}`))
      ) || { key: 'other', label: 'Other resources' };

    const entry = groups.get(group.key) || { ...group, links: [] };
    entry.links.push(link);
    groups.set(group.key, entry);
  });

  const order = ['video', 'reading', 'other'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function objectivesFrom(text = '') {
  return text
    .split(/\r?\n|•/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
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
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10h18M8 15h4" />
  </Icon>
);

const LogbookIcon = () => (
  <Icon>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 12h6M9 16h4" />
  </Icon>
);

const LogoutIcon = () => (
  <Icon>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </Icon>
);

const DownloadIcon = () => (
  <Icon size={16}>
    <path d="M12 4v10M8 11l4 3 4-3M5 19h14" />
  </Icon>
);

const EyeIcon = () => (
  <Icon size={14}>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
    <circle cx="12" cy="12" r="2.7" />
  </Icon>
);

const LinkIcon = () => (
  <Icon size={14}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </Icon>
);

const AlertIcon = () => (
  <Icon size={20}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.2v.1" />
  </Icon>
);

const CheckIcon = () => (
  <Icon size={26}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.4 2.4 4.6-5" />
  </Icon>
);

const CheckSmall = () => (
  <Icon size={15}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Icon>
);

const BellIcon = () => (
  <Icon size={20}>
    <path d="M18 15V10a6 6 0 1 0-12 0v5l-2 2h16z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
);

const ChevronIcon = () => (
  <Icon size={14}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

const CloseIcon = () => (
  <Icon size={18}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

function initialsFrom(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function AwaitingUpload({ large = false }) {
  return (
    <div className={`sd-awaiting${large ? ' sd-awaiting--lg' : ''}`}>
      <span className="sd-awaiting__icon" aria-hidden="true">
        ⏳
      </span>
      <div>
        <p className="sd-awaiting__title">Awaiting Faculty Upload</p>
        <p className="sd-awaiting__text">
          {large
            ? 'Your faculty has not published notes for this session yet. It will appear here, and in your notifications, as soon as it is uploaded.'
            : 'Notes and files for this session have not been published yet.'}
        </p>
      </div>
    </div>
  );
}

function SessionCard({ session, reviewing, onOpen, onReview }) {
  const material = session.material;
  const fileCount = material?.attachments.length ?? 0;
  const linkCount = material?.links.length ?? 0;

  return (
    <article
      className={`sd-session${session.reviewed ? ' sd-session--reviewed' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${session.topic}`}
      onClick={() => onOpen(session.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(session.id);
        }
      }}
    >
      <div className="sd-session__top">
        <span className="sd-session__code">{session.courseCode}</span>
        <span className="sd-session__topright">
          <span
            className={`sd-session__chip${session.reviewed ? ' sd-session__chip--reviewed' : ''}`}
          >
            {session.reviewed ? 'Reviewed' : 'Absent'}
          </span>
          <ChevronIcon />
        </span>
      </div>

      <h3 className="sd-session__topic">{session.topic}</h3>
      <p className="sd-session__course">{session.courseName}</p>

      <div className="sd-session__meta">
        <span>
          <strong>{formatSessionDate(session.date)}</strong>
        </span>
        <span>
          {session.startTime} – {session.endTime}
        </span>
        <span>
          {session.room} · {session.facultyName}
        </span>
      </div>

      {material ? (
        <div className="sd-material">
          <span className="sd-material__label">Class material</span>
          <p className="sd-material__title">{material.title}</p>
          {material.description ? (
            <p className="sd-material__snippet">{material.description}</p>
          ) : null}
          <p className="sd-material__counts">
            {fileCount} file{fileCount === 1 ? '' : 's'} · {linkCount} link
            {linkCount === 1 ? '' : 's'}
          </p>
        </div>
      ) : (
        <AwaitingUpload />
      )}

      <div className="sd-session__footer">
        {session.reviewed ? (
          <span className="sd-reviewed">
            <CheckSmall />
            Reviewed
          </span>
        ) : (
          <button
            type="button"
            className="sd-review"
            disabled={reviewing === session.id}
            onClick={(event) => {
              event.stopPropagation();
              onReview(session);
            }}
          >
            {reviewing === session.id ? 'Saving…' : 'Mark as reviewed'}
          </button>
        )}
      </div>
    </article>
  );
}

function SessionDrawer({
  session,
  reviewing,
  busyAttachment,
  actionError,
  previewOpen,
  shared,
  onClose,
  onDownload,
  onPreview,
  onReview,
}) {
  const material = session.material;
  const objectives = objectivesFrom(material?.objectives);
  const linkGroups = groupLinks(material?.links);
  const headingId = `session-drawer-${session.id}`;

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && !previewOpen) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, previewOpen]);

  return (
    <div className="sd-drawer">
      <div className="sd-drawer__scrim" onClick={onClose} role="presentation" />

      <aside
        className="sd-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="sd-drawer__head">
          <div>
            <span className="sd-session__code">{session.courseCode}</span>
            <div className="sd-drawer__chips">
              {shared ? (
                <span className="sd-session__chip sd-session__chip--shared">
                  {session.targeted ? 'Shared with you' : 'Shared with all students'}
                </span>
              ) : (
                <span className="sd-session__chip">Absent</span>
              )}
              {!shared && session.reviewed ? (
                <span className="sd-session__chip sd-session__chip--reviewed">Reviewed</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="sd-drawer__close"
            aria-label="Close session details"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="sd-drawer__body">
          <h2 className="sd-drawer__title" id={headingId}>
            {session.topic}
          </h2>
          <p className="sd-drawer__course">{session.courseName}</p>

          <dl className="sd-drawer__meta">
            <div>
              <dt>Date</dt>
              <dd>{formatSessionDate(session.date)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>
                {session.startTime} – {session.endTime}
              </dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{session.room}</dd>
            </div>
            <div>
              <dt>Faculty</dt>
              <dd>{session.facultyName}</dd>
            </div>
          </dl>

          {actionError ? (
            <div className="sd-alert" role="alert">
              <AlertIcon />
              <span>{actionError}</span>
            </div>
          ) : null}

          {material ? (
            <>
              <section className="sd-drawer__section">
                <span className="sd-drawer__label">Session material</span>
                <h3 className="sd-drawer__materialtitle">{material.title}</h3>
                {material.uploadedAt ? (
                  <p className="sd-drawer__published">
                    Published {dateTimeFormat.format(new Date(material.uploadedAt))}
                  </p>
                ) : null}
              </section>

              {material.description ? (
                <section className="sd-drawer__section">
                  <span className="sd-drawer__label">Faculty instructions</span>
                  {material.description
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p className="sd-drawer__text" key={index}>
                        {paragraph}
                      </p>
                    ))}
                </section>
              ) : null}

              {objectives.length ? (
                <section className="sd-drawer__section">
                  <span className="sd-drawer__label">Learning objectives</span>
                  <ul className="sd-objectives">
                    {objectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {linkGroups.length ? (
                <section className="sd-drawer__section">
                  <span className="sd-drawer__label">Reference links</span>
                  {linkGroups.map((group) => (
                    <div className="sd-linkgroup" key={group.key}>
                      <span className="sd-linkgroup__title">{group.label}</span>
                      <ul className="sd-links">
                        {group.links.map((link) => (
                          <li key={link}>
                            <LinkIcon />
                            <a href={link} target="_blank" rel="noreferrer noopener" title={link}>
                              {displayLink(link)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ) : null}

              {material.attachments.length ? (
                <section className="sd-drawer__section">
                  <span className="sd-drawer__label">Files</span>
                  <ul className="sd-files sd-drawer__files">
                    {material.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <span className="sd-files__ext">{attachment.extension}</span>
                        <span className="sd-files__name" title={attachment.name}>
                          {attachment.name}
                        </span>
                        <span className="sd-files__size">{formatBytes(attachment.size)}</span>
                        {canPreview(attachment) ? (
                          <button
                            type="button"
                            className="sd-files__preview"
                            aria-label={`Preview ${attachment.name}`}
                            onClick={() => onPreview(session, attachment)}
                          >
                            <EyeIcon />
                            <span>Preview</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="sd-files__btn"
                          aria-label={`Download ${attachment.name}`}
                          disabled={busyAttachment === attachment.id}
                          onClick={() => onDownload(session, attachment)}
                        >
                          <DownloadIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!material.attachments.length && !material.links.length ? (
                <section className="sd-drawer__section">
                  <p className="sd-material__note">
                    No files or links have been attached to this material yet.
                  </p>
                </section>
              ) : null}
            </>
          ) : (
            <section className="sd-drawer__section">
              <AwaitingUpload large />
            </section>
          )}
        </div>

        <div className="sd-drawer__footer">
          {shared ? (
            <span className="sd-sharednote">
              {session.targeted ? 'Published to you' : 'Published to all enrolled students'}
            </span>
          ) : session.reviewed ? (
            <span className="sd-reviewed">
              <CheckSmall />
              Reviewed
            </span>
          ) : (
            <button
              type="button"
              className="sd-review"
              disabled={reviewing === session.id}
              onClick={() => onReview(session)}
            >
              {reviewing === session.id ? 'Saving…' : 'Mark as reviewed'}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function PreviewDialog({ preview, onClose, onDownload }) {
  const { attachment, session, kind, status, url, error } = preview;
  const titleId = `preview-${attachment.id}`;

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="sd-preview">
      <div className="sd-preview__scrim" onClick={onClose} role="presentation" />

      <div className="sd-preview__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="sd-preview__head">
          <div className="sd-preview__heading">
            <span className="sd-preview__ext">{attachment.extension}</span>
            <div>
              <span className="sd-preview__eyebrow">File preview</span>
              <h2 className="sd-preview__title" id={titleId}>
                {attachment.name}
              </h2>
              <p className="sd-preview__meta">
                {session.courseCode} · {formatBytes(attachment.size)} · {session.topic}
              </p>
            </div>
          </div>
          <div className="sd-preview__actions">
            <button
              type="button"
              className="sd-preview__download"
              onClick={() => onDownload(session, attachment)}
            >
              <DownloadIcon />
              Download
            </button>
            <button
              type="button"
              className="sd-preview__close"
              aria-label="Close file preview"
              onClick={onClose}
              autoFocus
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="sd-preview__body">
          {status === 'loading' ? (
            <div className="sd-preview__state">
              <span className="spinner" aria-label="Loading preview" />
              <p>Loading preview…</p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="sd-preview__state">
              <span className="sd-preview__stateicon">
                <AlertIcon />
              </span>
              <p>{error}</p>
              <button
                type="button"
                className="sd-preview__fallback"
                onClick={() => onDownload(session, attachment)}
              >
                <DownloadIcon />
                Download instead
              </button>
            </div>
          ) : null}

          {status === 'ready' && kind === 'pdf' ? (
            <iframe
              className="sd-preview__frame"
              src={`${url}#toolbar=1&navpanes=0&view=FitH`}
              title={`Preview of ${attachment.name}`}
            />
          ) : null}

          {status === 'ready' && kind === 'image' ? (
            <img
              className="sd-preview__image"
              src={url}
              alt={`Preview of ${attachment.name}`}
            />
          ) : null}
        </div>

        <footer className="sd-preview__foot">
          <span>Preview only · the file stays protected by your attendance access.</span>
          <span>Use Download for an offline copy.</span>
        </footer>
      </div>
    </div>
  );
}

function NotificationBell({ notifications, userId, onSelectNotification }) {
  const [open, setOpen] = useState(false);
  const storageKey = `campus-portal-read-alerts:${userId || 'student'}`;
  const [readIds, setReadIds] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const unread = notifications.filter((item) => !readIds.includes(item.id)).length;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(readIds));
    } catch {
      // Private browsing or storage quotas can disable localStorage; the bell
      // still works for this session.
    }
  }, [readIds, storageKey]);

  function markAllRead() {
    setReadIds((ids) => [...new Set([...ids, ...notifications.map((item) => item.id)])]);
  }

  function closePanel() {
    setOpen(false);
    markAllRead();
  }

  useEffect(() => {
    if (!open) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        markAllRead();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, notifications]);

  return (
    <div className="sd-bell">
      <button
        type="button"
        className={`sd-bell__btn${open ? ' sd-bell__btn--open' : ''}`}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => (open ? closePanel() : setOpen(true))}
      >
        <BellIcon />
        {unread ? <span className="sd-bell__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <>
          <div className="sd-bell__scrim" onClick={closePanel} role="presentation" />
          <div className="sd-bell__panel">
            <div className="sd-bell__head">
              <strong>Notifications</strong>
              <span>
                {notifications.length
                  ? `${notifications.length} recent alert${notifications.length === 1 ? '' : 's'}`
                  : 'No updates'}
              </span>
            </div>

            {notifications.length ? (
              <ul className="sd-bell__list">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="sd-bell__item"
                      onClick={() => {
                        closePanel();
                        onSelectNotification(item);
                      }}
                    >
                      <span
                        className={`sd-bell__icon sd-bell__icon--${item.kind || 'notes'}`}
                        aria-hidden="true"
                      >
                        {item.kind === 'attendance' ? <CheckSmall /> : <LogbookIcon />}
                      </span>
                      <span className="sd-bell__itemtext">
                        <span className="sd-bell__itemtitle">{item.title}</span>
                        <span className="sd-bell__itemmeta">{item.message}</span>
                        <span className="sd-bell__itemtime">
                          {timeAgo(item.at)}
                          {!readIds.includes(item.id) ? (
                            <span className="sd-bell__unread" aria-label="Unread" />
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sd-bell__empty">
                No recent alerts yet. New notes and attendance updates will appear here.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function AttendanceTable({ records }) {
  if (!records.length) {
    return (
      <div className="sd-empty">
        <span className="sd-empty__icon">
          <CheckIcon />
        </span>
        <p className="sd-empty__title">No attendance marked yet</p>
        <p className="sd-empty__text">Sessions appear here once your faculty mark the register.</p>
      </div>
    );
  }

  return (
    <div className="sd-tablewrap">
      <table className="sd-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Session</th>
            <th>Course</th>
            <th>Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.sessionId}>
              <td>{dateFormat.format(new Date(record.date))}</td>
              <td>
                <strong>{record.topic}</strong>
              </td>
              <td>
                {record.courseCode} · {record.courseName}
              </td>
              <td>
                {record.startTime} – {record.endTime}
              </td>
              <td>
                <span className={`sd-status sd-status--${record.status}`}>{record.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('overview');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [busyAttachment, setBusyAttachment] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [actionError, setActionError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSharedId, setActiveSharedId] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setError('');

    try {
      const payload = await api.studentOverview();
      setData(payload);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = 'Student Portal — Campus Portal';
  }, []);

  async function downloadAttachment(session, attachment) {
    setActionError('');
    setBusyAttachment(attachment.id);

    try {
      const response = await fetch(apiUrl(`/materials/${attachment.id}/download`), {
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'That file could not be downloaded. Please try again.';
        try {
          const payload = await response.json();
          if (payload?.message) message = payload.message;
        } catch {
          // Keep the default message when the body is not JSON.
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
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyAttachment(null);
    }
  }

  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview?.url]);

  async function previewAttachment(session, attachment) {
    const kind = attachment.mimeType === 'application/pdf' ? 'pdf' : 'image';
    setPreview({
      attachment,
      session,
      kind,
      status: 'loading',
      url: '',
      error: '',
    });

    try {
      const response = await fetch(apiUrl(`/materials/${attachment.id}/preview`), {
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'That file could not be previewed. Please try downloading it instead.';
        try {
          const payload = await response.json();
          if (payload?.message) message = payload.message;
        } catch {
          // Keep the default message when the body is not JSON.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreview((current) => {
        if (!current || current.attachment.id !== attachment.id) {
          URL.revokeObjectURL(url);
          return current;
        }

        return { ...current, status: 'ready', url };
      });
    } catch (err) {
      setPreview((current) =>
        current && current.attachment.id === attachment.id
          ? { ...current, status: 'error', error: err.message }
          : current
      );
    }
  }

  async function markReviewed(session) {
    setActionError('');
    setReviewing(session.id);

    try {
      await api.setReviewed(session.id, true);

      setData((previous) => {
        if (!previous) return previous;

        const missedSessions = previous.missedSessions.map((item) =>
          item.id === session.id ? { ...item, reviewed: true } : item
        );

        return {
          ...previous,
          missedSessions,
          stats: {
            ...previous.stats,
            reviewed: missedSessions.filter((item) => item.reviewed).length,
          },
        };
      });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setReviewing(null);
    }
  }

  const stats = data?.stats;
  const missedSessions = data?.missedSessions ?? [];
  const attendance = data?.attendance ?? [];
  const sharedMaterials = data?.sharedMaterials ?? [];
  const upcomingExams = data?.upcomingExams ?? [];
  const isOverviewView = view === 'overview';
  const isMissedView = view === 'missed';
  const isAttendanceView = view === 'attendance';

  const notificationList = useMemo(() => {
    if (Array.isArray(data?.notifications)) return data.notifications;

    return missedSessions
      .filter((session) => session.material)
      .map((session) => ({
        id: `notes:${session.id}:${session.material.uploadedAt || 'unknown'}`,
        kind: 'notes',
        sessionId: session.id,
        title: `New notes uploaded for ${session.courseCode}`,
        message: session.facultyName
          ? `${session.material.title} · ${session.facultyName}`
          : session.material.title,
        at: session.material.uploadedAt,
      }))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [data?.notifications, missedSessions]);

  const subjectOptions = useMemo(() => {
    const map = new Map();
    missedSessions.forEach((session) => {
      map.set(session.courseCode, `${session.courseCode} · ${session.courseName}`);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [missedSessions]);

  const term = search.trim().toLowerCase();

  const scopedSessions = missedSessions.filter((session) => {
    if (subjectFilter !== 'all' && session.courseCode !== subjectFilter) return false;
    if (term && !session.topic.toLowerCase().includes(term)) return false;
    return true;
  });

  const tabCounts = {
    all: scopedSessions.length,
    available: scopedSessions.filter((session) => session.material).length,
    awaiting: scopedSessions.filter((session) => !session.material).length,
    reviewed: scopedSessions.filter((session) => session.reviewed).length,
  };

  const visibleSessions = scopedSessions.filter((session) => {
    if (statusFilter === 'available') return Boolean(session.material);
    if (statusFilter === 'awaiting') return !session.material;
    if (statusFilter === 'reviewed') return session.reviewed;
    return true;
  });

  const availableCount = missedSessions.filter((session) => session.material).length;
  const awaitingCount = missedSessions.length - availableCount;
  const reviewedCount = missedSessions.filter((session) => session.reviewed).length;
  const caughtUpPercent = missedSessions.length
    ? Math.round((reviewedCount / missedSessions.length) * 100)
    : 0;

  const filtersActive = statusFilter !== 'all' || subjectFilter !== 'all' || Boolean(term);

  const activeSession = activeSessionId
    ? missedSessions.find((session) => session.id === activeSessionId)
    : activeSharedId
      ? sharedMaterials.find((session) => session.id === activeSharedId)
      : null;

  function clearFilters() {
    setStatusFilter('all');
    setSubjectFilter('all');
    setSearch('');
  }

  function selectNotification(item) {
    setActionError('');

    if (item.kind === 'notes' && missedSessions.some((session) => session.id === item.sessionId)) {
      setActiveSharedId(null);
      setActiveSessionId(item.sessionId);
      return;
    }

    if (item.kind === 'attendance') {
      setActiveSessionId(null);
      setActiveSharedId(null);
      setView('attendance');
    }
  }

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
              {user?.enrollmentId} · {user?.department}
            </p>
          </div>
        </div>

        <nav className="sd__nav" aria-label="Student sections">
          <button
            type="button"
            className={`sd__navitem${isOverviewView ? ' sd__navitem--active' : ''}`}
            aria-current={isOverviewView ? 'page' : undefined}
            onClick={() => setView('overview')}
          >
            <OverviewIcon />
            Overview
          </button>

          <button
            type="button"
            className={`sd__navitem${isMissedView ? ' sd__navitem--active' : ''}`}
            aria-current={isMissedView ? 'page' : undefined}
            onClick={() => setView('missed')}
          >
            <ClassesIcon />
            Missed Classes
            {stats ? <span className="sd__badge">{stats.missed}</span> : null}
          </button>

          <button
            type="button"
            className={`sd__navitem${isAttendanceView ? ' sd__navitem--active' : ''}`}
            aria-current={isAttendanceView ? 'page' : undefined}
            onClick={() => setView('attendance')}
          >
            <LogbookIcon />
            Attendance &amp; Logs
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
          <div className="sd__headerrow">
            <div>
              <h1 className="sd__title">
                {isOverviewView
                  ? `Welcome back, ${user?.name?.split(' ')[0] || 'student'}`
                  : isMissedView
                    ? 'Missed Classes & Resources'
                    : 'Attendance & Logs'}
              </h1>
              <p className="sd__subtitle">
                Academic Support Portal · {user?.department} · Semester 5
              </p>
            </div>
            <NotificationBell
              notifications={notificationList}
              userId={user?.id}
              onSelectNotification={selectNotification}
            />
          </div>
        </header>

        {state === 'loading' ? (
          <div className="sd__state">
            <span className="spinner" aria-label="Loading your classes" />
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="sd-panel">
            <div className="sd-alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
            <button type="button" className="sd-retry" onClick={load}>
              Try again
            </button>
          </div>
        ) : null}

        {state === 'ready' && isOverviewView ? (
          <>
            <section className="sd-summary" aria-label="Semester snapshot">
              <article className="sd-summary__card">
                <span className="sd-summary__label">Attendance rate</span>
                <strong className="sd-summary__value">{stats.attendanceRate}%</strong>
                <span className="sd-summary__hint">
                  {stats.attended} of {stats.totalSessions} marked sessions
                </span>
              </article>

              <article className="sd-summary__card">
                <span className="sd-summary__label">Missed classes</span>
                <strong className="sd-summary__value">{stats.missed}</strong>
                <span className="sd-summary__hint">with notes and follow-up</span>
              </article>

              <article className="sd-summary__card">
                <span className="sd-summary__label">Notes available</span>
                <strong className="sd-summary__value">{availableCount}</strong>
                <span className="sd-summary__hint">{awaitingCount} still awaiting upload</span>
              </article>

              <article className="sd-summary__card sd-summary__card--progress">
                <span className="sd-summary__label">Catch-up progress</span>
                <strong className="sd-summary__value sd-summary__value--compact">
                  {caughtUpPercent}% reviewed
                </strong>
                <div
                  className="sd-progress"
                  role="progressbar"
                  aria-valuenow={caughtUpPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span className="sd-progress__bar" style={{ width: `${caughtUpPercent}%` }} />
                </div>
                <span className="sd-summary__hint">
                  {reviewedCount} of {missedSessions.length} missed sessions
                </span>
              </article>
            </section>

            <div className="ov-grid">
              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <LogbookIcon />
                    <h2 className="sd-panel__title">Attendance snapshot</h2>
                  </div>
                  <button
                    type="button"
                    className="ov-link"
                    onClick={() => setView('attendance')}
                  >
                    Open register
                  </button>
                </div>

                <div className="ov-attendance">
                  <div
                    className="ov-donut"
                    style={{ '--pct': `${stats.attendanceRate}%` }}
                    role="img"
                    aria-label={`${stats.attendanceRate} percent attendance`}
                  >
                    <div className="ov-donut__inner">
                      <strong>{stats.attendanceRate}%</strong>
                      <span>present</span>
                    </div>
                  </div>
                  <ul className="ov-legend">
                    <li>
                      <span className="ov-dot ov-dot--present" />
                      Attended <strong>{stats.attended}</strong>
                    </li>
                    <li>
                      <span className="ov-dot ov-dot--absent" />
                      Missed <strong>{stats.missed}</strong>
                    </li>
                    <li>
                      <span className="ov-dot ov-dot--reviewed" />
                      Reviewed <strong>{reviewedCount}</strong>
                    </li>
                  </ul>
                </div>

                {awaitingCount ? (
                  <p className="ov-note">
                    {awaitingCount} missed {awaitingCount === 1 ? 'session is' : 'sessions are'}{' '}
                    waiting for faculty notes.
                  </p>
                ) : (
                  <p className="ov-note ov-note--good">
                    Every missed session has notes available.
                  </p>
                )}
              </section>

              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <ClassesIcon />
                    <h2 className="sd-panel__title">Upcoming examinations</h2>
                  </div>
                  <span className="sd-panel__hint">{upcomingExams.length}</span>
                </div>

                {upcomingExams.length ? (
                  <ul className="ov-list">
                    {upcomingExams.map((exam) => (
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
                            {exam.name} · {exam.startTime}–{exam.endTime} · {exam.room}
                          </p>
                        </div>
                        <span className="ov-pill">{exam.maxMarks} marks</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ov-empty">No scheduled examinations for your batch yet.</div>
                )}
              </section>

              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <LinkIcon />
                    <h2 className="sd-panel__title">Latest notes for you</h2>
                  </div>
                  <button
                    type="button"
                    className="ov-link"
                    onClick={() => setView('missed')}
                  >
                    All missed classes
                  </button>
                </div>

                {data.recentNotes?.length ? (
                  <ul className="ov-list">
                    {data.recentNotes.map((note) => (
                      <li key={note.sessionId} className="ov-list__row ov-list__row--click" onClick={() => setActiveSessionId(note.sessionId)}>
                        <div className="ov-list__body">
                          <p className="ov-list__title">{note.title}</p>
                          <p className="ov-list__meta">
                            {note.courseCode} · {note.topic} · {note.attachmentCount} file
                            {note.attachmentCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="ov-time">{timeAgo(note.uploadedAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ov-empty">Notes uploaded for missed classes will appear here.</div>
                )}
              </section>

              <section className="sd-panel ov-card">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <AlertIcon />
                    <h2 className="sd-panel__title">Needs attention</h2>
                  </div>
                </div>

                {missedSessions.filter((session) => !session.material).length ? (
                  <ul className="ov-list">
                    {missedSessions
                      .filter((session) => !session.material)
                      .slice(0, 3)
                      .map((session) => (
                        <li key={session.id} className="ov-list__row ov-list__row--click" onClick={() => setView('missed')}>
                          <div className="ov-list__body">
                            <p className="ov-list__title">{session.topic}</p>
                            <p className="ov-list__meta">
                              {session.courseCode} · {formatSessionDate(session.date)}
                            </p>
                          </div>
                          <span className="ov-pill ov-pill--warn">Awaiting notes</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="ov-empty ov-empty--good">
                    <CheckIcon /> Nothing pending — you are caught up on available material.
                  </div>
                )}
              </section>
            </div>

            {sharedMaterials.length ? (
              <section className="sd-panel">
                <div className="sd-panel__head">
                  <div className="sd-panel__titlewrap">
                    <LogbookIcon />
                    <h2 className="sd-panel__title">Class materials shared with everyone</h2>
                  </div>
                  <span className="sd-panel__hint">{sharedMaterials.length} available</span>
                </div>

                <div className="sd-sharedgrid">
                  {sharedMaterials.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className="sd-sharedcard"
                      onClick={() => setActiveSharedId(session.id)}
                    >
                      <span className="sd-sharedcard__top">
                        <span className="sd-session__code">{session.courseCode}</span>
                        <span className="sd-sharedcard__badge">All students</span>
                      </span>
                      <strong className="sd-sharedcard__title">{session.material.title}</strong>
                      <span className="sd-sharedcard__meta">
                        {session.topic} · {formatSessionDate(session.date)}
                      </span>
                      <span className="sd-sharedcard__foot">
                        {session.material.attachments.length} file
                        {session.material.attachments.length === 1 ? '' : 's'} ·{' '}
                        {session.facultyName}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {state === 'ready' && isMissedView ? (
          <>
            <section className="sd-summary" aria-label="Catch-up summary">
              <article className="sd-summary__card">
                <span className="sd-summary__label">Total Missed</span>
                <strong className="sd-summary__value">{missedSessions.length}</strong>
                <span className="sd-summary__hint">
                  of {stats.totalSessions} marked sessions
                </span>
              </article>

              <article className="sd-summary__card">
                <span className="sd-summary__label">Notes Available</span>
                <strong className="sd-summary__value">{availableCount}</strong>
                <span className="sd-summary__hint">ready to open or download</span>
              </article>

              <article className="sd-summary__card">
                <span className="sd-summary__label">Awaiting Notes</span>
                <strong className="sd-summary__value">{awaitingCount}</strong>
                <span className="sd-summary__hint">faculty upload pending</span>
              </article>

              <article className="sd-summary__card sd-summary__card--progress">
                <span className="sd-summary__label">Catch-up progress</span>
                <strong className="sd-summary__value sd-summary__value--compact">
                  {caughtUpPercent}% Caught Up
                </strong>
                <div
                  className="sd-progress"
                  role="progressbar"
                  aria-valuenow={caughtUpPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Reviewed missed sessions"
                >
                  <span
                    className="sd-progress__bar"
                    style={{ width: `${caughtUpPercent}%` }}
                  />
                </div>
                <span className="sd-summary__hint">
                  {reviewedCount} of {missedSessions.length} reviewed
                </span>
              </article>
            </section>

            <div className="sd-controls">
              <div className="sd-tabs" role="tablist" aria-label="Filter missed classes by status">
                {STATUS_TABS.map((tab) => {
                  const selected = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`sd-tab${selected ? ' sd-tab--active' : ''}`}
                      onClick={() => setStatusFilter(tab.key)}
                    >
                      {tab.label}
                      <span className="sd-tab__count">{tabCounts[tab.key]}</span>
                    </button>
                  );
                })}
              </div>

              <div className="sd-filters">
                <label className="sd-field">
                  <span className="field-label">Subject</span>
                  <select
                    className="sd-select"
                    value={subjectFilter}
                    onChange={(event) => setSubjectFilter(event.target.value)}
                  >
                    <option value="all">All subjects</option>
                    {subjectOptions.map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sd-field sd-field--search">
                  <span className="field-label">Topic search</span>
                  <input
                    className="text-input"
                    type="search"
                    value={search}
                    placeholder="Search missed topics…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>

                {filtersActive ? (
                  <button type="button" className="sd-clear" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>

            <section className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <ClassesIcon />
                  <h2 className="sd-panel__title">Sessions you were marked absent in</h2>
                </div>
                <span className="sd-panel__hint">
                  {visibleSessions.length} of {missedSessions.length} sessions
                </span>
              </div>

              {actionError ? (
                <div className="sd-alert" role="alert">
                  <AlertIcon />
                  <span>{actionError}</span>
                </div>
              ) : null}

              {visibleSessions.length ? (
                <div className="sd-grid">
                  {visibleSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      reviewing={reviewing}
                      onOpen={setActiveSessionId}
                      onReview={markReviewed}
                    />
                  ))}
                </div>
              ) : missedSessions.length ? (
                <div className="sd-empty">
                  <span className="sd-empty__icon">
                    <ClassesIcon />
                  </span>
                  <p className="sd-empty__title">No sessions match these filters</p>
                  <p className="sd-empty__text">
                    Try another subject or status, or clear the filters to see every missed class.
                  </p>
                  <button type="button" className="sd-retry" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="sd-empty">
                  <span className="sd-empty__icon">
                    <CheckIcon />
                  </span>
                  <p className="sd-empty__title">No missed classes</p>
                  <p className="sd-empty__text">
                    You have attended every marked session. Any future absence will show up here
                    with its material.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : null}

        {state === 'ready' && isAttendanceView ? (
          <section className="sd-panel">
            <div className="sd-panel__head">
              <div className="sd-panel__titlewrap">
                <LogbookIcon />
                <h2 className="sd-panel__title">Attendance register</h2>
              </div>
              <span className="sd-panel__hint">
                {stats.attendanceRate}% attendance · {stats.attended} of {stats.totalSessions}{' '}
                sessions
              </span>
            </div>

            <AttendanceTable records={attendance} />
          </section>
        ) : null}
      </main>

      {activeSession ? (
        <SessionDrawer
          session={activeSession}
          reviewing={reviewing}
          busyAttachment={busyAttachment}
          actionError={actionError}
          previewOpen={Boolean(preview)}
          shared={Boolean(activeSharedId)}
          onClose={() => {
            setActiveSessionId(null);
            setActiveSharedId(null);
          }}
          onDownload={downloadAttachment}
          onPreview={previewAttachment}
          onReview={markReviewed}
        />
      ) : null}

      {preview ? (
        <PreviewDialog
          preview={preview}
          onClose={() => setPreview(null)}
          onDownload={downloadAttachment}
        />
      ) : null}
    </div>
  );
}
