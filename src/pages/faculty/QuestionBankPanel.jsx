import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';

const PAPER_EXTENSIONS = new Set(['pdf', 'docx']);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_NOTES = 8;
const MAX_PAST_PAPERS = 5;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACTIVE_JOB_STATUSES = new Set(['queued', 'processing']);

function JobStatus({ label, job }) {
  if (!job) return null;

  const active = ACTIVE_JOB_STATUSES.has(job.status);
  const statusLabel = {
    queued: 'queued on the server',
    processing: 'running in the background',
    completed: 'completed',
    failed: 'failed',
  }[job.status] || job.status;
  const detail =
    job.status === 'failed'
      ? job.error
      : active
        ? 'You can change subject, leave this section, or sign out. The analysis will keep running.'
        : job.message;

  return (
    <div
      className={`qbank-job qbank-job--${job.status}`}
      role={job.status === 'failed' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span className="qbank-job__dot" aria-hidden="true" />
      <span>
        <strong>
          {label}: {statusLabel}
        </strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </div>
  );
}

function fileError(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!PAPER_EXTENSIONS.has(extension)) return `${file.name} must be a PDF or DOCX file.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} must be 20 MB or smaller.`;
  return '';
}

function AnalysisBlocks({ analysis }) {
  return (
    <>
      {analysis.recurringTopics.length ? (
        <div className="qbank-analysis">
          <h4>Recurring topics in past papers</h4>
          <ul>
            {analysis.recurringTopics.map((topic) => (
              <li key={`${topic.unit}-${topic.topic}`}>
                <strong>{topic.topic}</strong> · {topic.unit} — {topic.frequency} paper
                {topic.frequency === 1 ? '' : 's'} ({topic.years.join(', ')})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {[
        ['Observed patterns', analysis.patterns],
        ['Recommendations', analysis.recommendations],
        ['Coverage gaps', analysis.coverageGaps],
      ].map(([label, items]) =>
        items.length ? (
          <div className="qbank-analysis" key={label}>
            <h4>{label}</h4>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}
    </>
  );
}

function BankCard({ bank }) {
  return (
    <details className="qbank-result">
      <summary>
        <span>
          <strong>{bank.title}</strong>
          <small>{new Date(bank.createdAt).toLocaleString()}</small>
        </span>
        <span className="qbank-result__actions">
          <a
            className="qbank-pdf"
            href={`/api/faculty/question-banks/${bank.id}/pdf`}
            download
            onClick={(event) => event.stopPropagation()}
          >
            Download PDF
          </a>
          <span className="qbank-result__count">{bank.questions.length} questions</span>
        </span>
      </summary>
      <p className="qbank-summary">{bank.analysis.summary}</p>
      <p className="qbank-source-note">
        Generated from class notes: {bank.sources.notes.map((note) => note.name).join(', ')}
      </p>
      <AnalysisBlocks analysis={bank.analysis} />

      <ol className="qbank-questions">
        {bank.questions.map((question, index) => (
          <li key={`${question.unit}-${index}`}>
            <div className="qbank-question__head">
              <strong>{question.unit}</strong>
              <span>
                {question.marks} marks · {question.difficulty} · {question.cognitive}
              </span>
            </div>
            <p>{question.text}</p>
            {question.answerKey ? (
              <details className="qbank-answer">
                <summary>View answer guide</summary>
                <p>{question.answerKey}</p>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function PastPaperAnalysisCard({ saved }) {
  return (
    <article className="qbank-pastanalysis-card">
      <header className="qbank-pastanalysis-card__head">
        <div>
          <h4>Five-year past-paper analysis</h4>
          <p>
            Papers: {saved.papers.map((paper) => paper.year).join(', ')} · Updated{' '}
            {new Date(saved.updatedAt || saved.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="qbank-pastanalysis-card__actions">
          <span>Separate from notes bank</span>
          <a
            className="qbank-pdf"
            href={`/api/faculty/question-banks/past-papers/analysis/${saved.id}/pdf`}
            download
          >
            Download PDF
          </a>
        </div>
      </header>
      <p className="qbank-summary">{saved.analysis.summary}</p>
      <AnalysisBlocks analysis={saved.analysis} />
    </article>
  );
}

export default function QuestionBankPanel({ exam }) {
  const [context, setContext] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [years, setYears] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [deletingId, setDeletingId] = useState('');
  const [preview, setPreview] = useState(null);
  const lastJobStatus = useRef({});

  async function loadContext(active = () => true) {
    const result = await api.facultyQuestionBankContext(exam.id);
    if (active()) setContext(result);
    return result;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setContext(null);

    (async () => {
      try {
        const result = await loadContext(() => active);
        if (!active || !result) return;
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [exam.id]);

  const notesJob = context?.jobs?.notesBank || null;
  const pastPapersJob = context?.jobs?.pastPapers || null;
  const notesJobActive = ACTIVE_JOB_STATUSES.has(notesJob?.status);
  const pastPapersJobActive = ACTIVE_JOB_STATUSES.has(pastPapersJob?.status);
  const hasActiveJob = notesJobActive || pastPapersJobActive;

  useEffect(() => {
    const previous = lastJobStatus.current;
    const next = {
      notesBank: notesJob?.status,
      pastPapers: pastPapersJob?.status,
    };
    const finished = [
      ['notesBank', notesJob],
      ['pastPapers', pastPapersJob],
    ].find(
      ([key, job]) =>
        job?.status === 'completed' &&
        previous[key] &&
        previous[key] !== 'completed'
    );
    lastJobStatus.current = next;
    if (finished) setNotice(finished[1].message);
  }, [notesJob?.status, pastPapersJob?.status]);

  useEffect(() => {
    if (!hasActiveJob) return undefined;

    let active = true;
    const timer = setInterval(async () => {
      try {
        const result = await api.facultyQuestionBankContext(exam.id);
        if (active) setContext(result);
      } catch (err) {
        if (active) setError(err.message);
      }
    }, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [exam.id, hasActiveJob]);

  useEffect(() => {
    const url = preview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [preview?.url]);

  useEffect(() => {
    if (!preview) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') setPreview(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [preview]);

  const notesToUse = useMemo(
    () => (context?.notes || []).slice(0, MAX_NOTES),
    [context]
  );

  const missingYears = useMemo(() => {
    if (!context) return [];
    const occupied = new Set(context.pastPapers.map((paper) => paper.year));
    const yearsToUpload = [];
    for (let year = context.yearRange.first; year <= context.yearRange.last; year += 1) {
      if (!occupied.has(year)) yearsToUpload.push(year);
    }
    return yearsToUpload;
  }, [context]);

  function chooseFiles(fileList) {
    const files = Array.from(fileList || []);
    setError('');
    setNotice('');
    if (files.length > missingYears.length) {
      setSelectedFiles([]);
      setError(
        `Only ${missingYears.length} past-paper year${missingYears.length === 1 ? '' : 's'} remain available.`
      );
      return;
    }
    const invalid = files.map(fileError).find(Boolean);
    if (invalid) {
      setSelectedFiles([]);
      setError(invalid);
      return;
    }
    setSelectedFiles(files);
    setYears(missingYears.slice(0, files.length).join(', '));
  }

  async function generateQuestionBank(notes = notesToUse) {
    const attachmentIds = notes.slice(0, MAX_NOTES).map((note) => note.id);
    if (!attachmentIds.length) {
      setError('No PDF or DOCX class notes are available for this subject.');
      return;
    }

    setGenerating(true);
    setError('');
    setNotice('Starting the notes analysis on the server…');
    try {
      const result = await api.facultyGenerateQuestionBank({
        examId: exam.id,
        attachmentIds,
      });
      setNotice(result.message);
      await loadContext();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    setError('');
    setNotice('');
    await generateQuestionBank();
  }

  async function runPastPaperAnalysis(papers = context?.pastPapers || []) {
    if (papers.length < MAX_PAST_PAPERS) {
      setError(`Upload all five past-paper years before running the past-paper analysis.`);
      return;
    }
    if (!exam.boardPlan?.units?.length) {
      setError('The Examination Board must publish a syllabus before past papers can be analysed.');
      return;
    }

    setAnalysing(true);
    setError('');
    setNotice('Starting the past-paper analysis on the server…');
    try {
      const result = await api.facultyAnalyzePastPapers({ examId: exam.id });
      setNotice(result.message);
      await loadContext();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalysing(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!selectedFiles.length) {
      setError('Choose at least one past question paper to upload.');
      return;
    }
    const yearList = years
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    const available = new Set(missingYears);
    if (
      yearList.length !== selectedFiles.length ||
      yearList.some((year) => !Number.isInteger(year) || !available.has(year)) ||
      new Set(yearList).size !== yearList.length
    ) {
      setError(`Enter one unique, available year per file (${missingYears.join(', ')}).`);
      return;
    }

    const body = new FormData();
    body.append('examId', exam.id);
    body.append('years', JSON.stringify(yearList));
    selectedFiles.forEach((file) => body.append('files', file));
    setUploading(true);
    try {
      const result = await api.facultyUploadPastQuestionPapers(body);
      setNotice(result.message);
      setSelectedFiles([]);
      setYears('');
      setFileInputKey((key) => key + 1);
      const updatedContext = await loadContext();
      if (updatedContext.pastPapers.length === MAX_PAST_PAPERS) {
        if (!exam.boardPlan?.units?.length) {
          setNotice(
            `${result.message} All five papers are uploaded; publish a board syllabus before running the past-paper analysis.`
          );
        } else {
          setNotice(
            `${result.message} All five papers are ready. Press “Analyse past papers now” to start the separate analysis.`
          );
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function openPreview(paper) {
    const kind = paper.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text';
    setPreview({ paper, kind, status: 'loading', url: '', text: '', error: '' });

    try {
      if (kind === 'pdf') {
        const blob = await api.facultyPastPaperPreview(paper.id);
        const url = URL.createObjectURL(blob);
        setPreview((current) => {
          if (!current || current.paper.id !== paper.id) {
            URL.revokeObjectURL(url);
            return current;
          }
          return { ...current, status: 'ready', url };
        });
      } else {
        const result = await api.facultyPastPaperText(paper.id);
        setPreview((current) =>
          current && current.paper.id === paper.id
            ? { ...current, status: 'ready', text: result.text }
            : current
        );
      }
    } catch (err) {
      setPreview((current) =>
        current && current.paper.id === paper.id
          ? { ...current, status: 'error', error: err.message }
          : current
      );
    }
  }

  async function deletePastPaper(paper) {
    if (
      !window.confirm(
        `Delete the ${paper.year} past question paper "${paper.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(paper.id);
    setError('');
    setNotice('');
    try {
      const result = await api.facultyDeletePastQuestionPaper(paper.id);
      setPreview((current) => (current?.paper.id === paper.id ? null : current));
      setNotice(`${result.message} The saved past-paper analysis for this subject was cleared.`);
      await loadContext();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  }

  return (
    <section className="sd-panel qbank-panel" aria-labelledby="qbank-title">
      <div className="sd-panel__head">
        <div className="sd-panel__titlewrap">
          <h2 className="sd-panel__title" id="qbank-title">
            AI question bank &amp; past-paper analysis
          </h2>
        </div>
      </div>
      <p className="qp-docform__lead">
        Press an analysis button to start it. The server keeps working if you change section or
        sign out. The latest five years of past papers are analysed separately from the class-notes
        question bank, so the two are never mixed.
      </p>

      {loading ? <p className="fd-hint">Loading subject notes and past papers…</p> : null}
      {error ? (
        <div className="sd-alert" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="hod-notice" role="status">
          {notice}
        </div>
      ) : null}

      {!loading && context ? (
        <>
          <div className="qbank-source-grid">
            <div className="qbank-source">
              <div className="qbank-subhead">
                <h3>Question bank from class notes</h3>
                <span>{notesToUse.length} notes used</span>
              </div>
              <p className="qbank-help">
                The latest readable PDF/DOCX notes uploaded for this subject are used when you
                start the analysis.
                {context.notes.length > MAX_NOTES
                  ? ` The latest ${MAX_NOTES} notes are used.`
                  : ''}
              </p>
              {notesToUse.length ? (
                <ul className="qbank-note-list">
                  {notesToUse.map((note) => (
                    <li key={note.id} className="qbank-note-item">
                      <span>
                        <strong>{note.name}</strong>
                        <small>
                          {note.sessionTopic || 'Class notes'} · {formatBytes(note.size)}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fd-hint">
                  No PDF or DOCX notes are uploaded for this subject yet. Upload notes from your
                  class-session materials first.
                </p>
              )}
              <button
                type="button"
                className="ex-btn ex-btn--primary qbank-generate"
                disabled={
                  generating ||
                  notesJobActive ||
                  !notesToUse.length ||
                  !exam.boardPlan?.units?.length
                }
                onClick={handleGenerate}
              >
                {generating
                  ? 'Starting analysis…'
                  : notesJobActive
                    ? 'Analysis running…'
                    : context.banks.length
                      ? 'Analyse notes again'
                      : 'Analyse notes now'}
              </button>
              <JobStatus label="Notes question bank" job={notesJob} />
              {!exam.boardPlan?.units?.length ? (
                <p className="qbank-help">
                  A board syllabus must be published before a question bank can be generated.
                </p>
              ) : null}
            </div>

            <div className="qbank-source">
              <div className="qbank-subhead">
                <h3>Five-year past-paper analysis</h3>
                <span>
                  {context.pastPapers.length}/{MAX_PAST_PAPERS} uploaded
                </span>
              </div>
              <p className="qbank-help">
                Upload one PDF or DOCX for each year from {context.yearRange.first} to{' '}
                {context.yearRange.last}. Once all five are uploaded, press “Analyse past papers
                now” to start the separate analysis.
              </p>
              <form className="qbank-upload" onSubmit={handleUpload}>
                <label className="field-label" htmlFor={`qbank-files-${exam.id}`}>
                  Past-paper files
                </label>
                <input
                  key={fileInputKey}
                  id={`qbank-files-${exam.id}`}
                  type="file"
                  accept=".pdf,.docx"
                  multiple
                  disabled={!missingYears.length || uploading || pastPapersJobActive}
                  onChange={(event) => chooseFiles(event.target.files)}
                />
                <label className="field-label" htmlFor={`qbank-years-${exam.id}`}>
                  Years, in file order
                </label>
                <input
                  id={`qbank-years-${exam.id}`}
                  className="text-input"
                  value={years}
                  placeholder="e.g. 2022, 2023"
                  disabled={!selectedFiles.length || uploading || pastPapersJobActive}
                  onChange={(event) => setYears(event.target.value)}
                />
                <button
                  type="submit"
                  className="ex-btn ex-btn--secondary"
                  disabled={uploading || pastPapersJobActive || !selectedFiles.length}
                >
                  {uploading
                    ? 'Uploading…'
                    : `Upload past paper${selectedFiles.length === 1 ? '' : 's'}`}
                </button>
              </form>
              {context.pastPapers.length ? (
                <ul className="qbank-past-list">
                  {context.pastPapers.map((paper) => (
                    <li key={paper.id} className="qbank-past-item">
                      <button
                        type="button"
                        className="qbank-past-file"
                        onClick={() => openPreview(paper)}
                        aria-label={`Preview ${paper.year} ${paper.name}`}
                      >
                        <strong>{paper.year}</strong>
                        <span>{paper.name}</span>
                      </button>
                      <div className="qbank-past-actions">
                        <button
                          type="button"
                          className="qbank-past-action"
                          onClick={() => openPreview(paper)}
                        >
                          Preview
                        </button>
                        <a
                          className="qbank-past-action"
                          href={`/api/faculty/question-banks/past-papers/${paper.id}/download`}
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          className="qbank-past-action qbank-past-action--danger"
                          disabled={
                            deletingId === paper.id || uploading || pastPapersJobActive
                          }
                          onClick={() => deletePastPaper(paper)}
                        >
                          {deletingId === paper.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fd-hint">No past papers uploaded for this subject.</p>
              )}
              <button
                type="button"
                className="ex-btn ex-btn--secondary qbank-analyze"
                disabled={
                  analysing ||
                  pastPapersJobActive ||
                  uploading ||
                  context.pastPapers.length < MAX_PAST_PAPERS ||
                  !exam.boardPlan?.units?.length
                }
                onClick={() => runPastPaperAnalysis()}
              >
                {analysing
                  ? 'Starting analysis…'
                  : pastPapersJobActive
                    ? 'Analysis running…'
                  : context.pastPaperAnalysis
                    ? 'Analyse past papers again'
                    : 'Analyse past papers now'}
              </button>
              <JobStatus label="Past-paper analysis" job={pastPapersJob} />
            </div>
          </div>

          <div className="qbank-saved">
            <h3>Past-paper analysis</h3>
            {context.pastPaperAnalysis ? (
              <PastPaperAnalysisCard saved={context.pastPaperAnalysis} />
            ) : (
              <div className="qbank-empty">
                <strong>No separate past-paper analysis yet.</strong>
                <p>
                  Upload all five years, then press “Analyse past papers now”. The result appears
                  here independently of the class-notes question bank.
                </p>
              </div>
            )}
          </div>

          <div className="qbank-saved">
            <h3>Question banks from class notes</h3>
            {context.banks.length ? (
              context.banks.map((bank) => <BankCard key={bank.id} bank={bank} />)
            ) : (
              <div className="qbank-empty">
                <strong>No notes question bank yet.</strong>
                <p>
                  Press “Analyse notes now” to generate a bank from the uploaded class notes.
                </p>
              </div>
            )}
          </div>
        </>
      ) : null}

      {preview ? (
        <div className="sd-preview">
          <div
            className="sd-preview__scrim"
            onClick={() => setPreview(null)}
            role="presentation"
          />
          <div
            className="sd-preview__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`qbank-preview-${preview.paper.id}`}
          >
            <header className="sd-preview__head">
              <div className="sd-preview__heading">
                <span className="sd-preview__ext">
                  {preview.paper.name.split('.').pop().toUpperCase()}
                </span>
                <div>
                  <span className="sd-preview__eyebrow">Past question paper</span>
                  <h3 className="sd-preview__title" id={`qbank-preview-${preview.paper.id}`}>
                    {preview.paper.name}
                  </h3>
                  <p className="sd-preview__meta">
                    {preview.paper.year} · {formatBytes(preview.paper.size)}
                    {preview.kind === 'text' ? ' · extracted text preview' : ''}
                  </p>
                </div>
              </div>
              <div className="sd-preview__actions">
                <a
                  className="sd-preview__download"
                  href={`/api/faculty/question-banks/past-papers/${preview.paper.id}/download`}
                >
                  Download
                </a>
                <button
                  type="button"
                  className="sd-preview__close"
                  aria-label="Close past-paper preview"
                  onClick={() => setPreview(null)}
                  autoFocus
                >
                  ×
                </button>
              </div>
            </header>

            <div className="sd-preview__body">
              {preview.status === 'loading' ? (
                <div className="sd-preview__state">
                  <span className="spinner" aria-label="Loading past-paper preview" />
                  <p>Loading preview…</p>
                </div>
              ) : null}

              {preview.status === 'error' ? (
                <div className="sd-preview__state">
                  <p>{preview.error}</p>
                  <a
                    className="sd-preview__fallback"
                    href={`/api/faculty/question-banks/past-papers/${preview.paper.id}/download`}
                  >
                    Download instead
                  </a>
                </div>
              ) : null}

              {preview.status === 'ready' && preview.kind === 'pdf' ? (
                <iframe
                  className="sd-preview__frame"
                  src={`${preview.url}#toolbar=1&navpanes=0&view=FitH`}
                  title={`Preview of ${preview.paper.name}`}
                />
              ) : null}

              {preview.status === 'ready' && preview.kind === 'text' ? (
                <pre className="qbank-preview__text">{preview.text}</pre>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
