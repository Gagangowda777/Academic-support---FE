import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const TYPE_LABELS = {
  internal: 'Internal assessment',
  mid_semester: 'Mid-semester',
  end_semester: 'End-semester',
  practical: 'Practical',
  quiz: 'Quiz',
  other: 'Other',
};

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const COGNITIVE_LABELS = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyze',
  evaluate: 'Evaluate',
  create: 'Create',
};

const STATUS_LABELS = { submitted: 'In AI review', approved: 'Approved', rejected: 'Returned' };
const PAPER_EXTENSIONS = ['.pdf', '.docx'];
const MAX_PAPER_BYTES = 20 * 1024 * 1024;

function formatDate(iso) {
  return dateFormat.format(new Date(iso));
}

function evaluationState(paper) {
  const status = paper.evaluation?.status;
  if (status === 'completed') return 'AI evaluation complete';
  if (status === 'failed') return paper.evaluation?.error || 'AI evaluation failed';
  if (status === 'processing') return 'AI evaluation in progress';
  return 'AI evaluation queued';
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function paperFileError(file, label) {
  if (!file) return `${label} is required.`;
  const extension = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!PAPER_EXTENSIONS.includes(extension)) {
    return `${label} must be a PDF or DOCX file.`;
  }
  if (file.size > MAX_PAPER_BYTES) {
    return `${label} must be 20 MB or smaller.`;
  }
  return '';
}

function PaperDropzone({ id, label, required, file, hint, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function choose(fileList) {
    const selectedFile = fileList?.[0] || null;
    if (selectedFile) onFile(selectedFile);
  }

  return (
    <div className="qp-field">
      <span className="field-label">
        {label}
        {required ? <span className="qp-required">Required</span> : <span className="qp-optional">Optional</span>}
      </span>

      <div
        className={`qp-dropzone${dragging ? ' qp-dropzone--dragging' : ''}${file ? ' qp-dropzone--filled' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`${label}. Drag and drop a file or browse.`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          id={id}
          className="qp-dropzone__input"
          type="file"
          accept={PAPER_EXTENSIONS.join(',')}
          onChange={(event) => {
            choose(event.target.files);
            event.target.value = '';
          }}
        />

        {file ? (
          <div className="qp-dropzone__file">
            <span className="qp-dropzone__ext">
              {(file.name.split('.').pop() || '').toUpperCase()}
            </span>
            <div className="qp-dropzone__filedetail">
              <strong>{file.name}</strong>
              <span>{formatBytes(file.size)}</span>
            </div>
            <button
              type="button"
              className="qp-dropzone__remove"
              aria-label={`Remove ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onFile(null);
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="qp-dropzone__empty">
            <span className="qp-dropzone__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V5M8 9l4-4 4 4M5 20h14" />
              </svg>
            </span>
            <strong>Drag and drop your file here</strong>
            <span>
              or <u>browse files</u> · {hint}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PaperDocuments({ paper }) {
  if (!paper.paperDocument && !paper.answerKeyDocument) return null;

  return (
    <div className="qp-docfiles">
      {paper.paperDocument ? (
        <a
          className="qp-docfile"
          href={`/api/question-papers/${paper.id}/paper`}
        >
          <span className="qp-docfile__ext">{paper.paperDocument.extension}</span>
          <span className="qp-docfile__body">
            <strong>Question paper</strong>
            <span>{paper.paperDocument.name} · {formatBytes(paper.paperDocument.size)}</span>
          </span>
          <span className="qp-docfile__action">Download</span>
        </a>
      ) : null}

      {paper.answerKeyDocument ? (
        <a
          className="qp-docfile"
          href={`/api/question-papers/${paper.id}/answer-key`}
        >
          <span className="qp-docfile__ext">{paper.answerKeyDocument.extension}</span>
          <span className="qp-docfile__body">
            <strong>Answer key</strong>
            <span>{paper.answerKeyDocument.name} · {formatBytes(paper.answerKeyDocument.size)}</span>
          </span>
          <span className="qp-docfile__action">Download</span>
        </a>
      ) : null}
    </div>
  );
}

function emptyQuestion() {
  return {
    text: '',
    unit: '',
    marks: '10',
    difficulty: 'medium',
    cognitive: 'understand',
    answerKey: '',
  };
}

function blankQuestions() {
  return [emptyQuestion(), emptyQuestion(), emptyQuestion()];
}

function totalOf(questions) {
  return questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
}

function ScoreRows({ evaluation, criteria }) {
  if (!evaluation) return null;

  return (
    <div className="qp-score">
      <div className="qp-score__head">
        <span className="qp-score__total">{Math.round(evaluation.total)}</span>
        <span className="qp-score__outof">/ 100 AI score</span>
        <span className="qp-score__engine">{evaluation.engine}</span>
      </div>

      <ul className="qp-criteria">
        {criteria.map((criterion) => {
          const row = evaluation.breakdown?.find((item) => item.key === criterion.key);
          const score = row?.score ?? 0;

          return (
            <li key={criterion.key} className="qp-criteria__row">
              <span className="qp-criteria__label">
                {criterion.label}
                <span className="qp-criteria__weight">{criterion.weight}%</span>
              </span>
              <span className="qp-criteria__bar" aria-hidden="true">
                <span style={{ width: `${score}%` }} />
              </span>
              <span className="qp-criteria__value">{Math.round(score)}</span>
            </li>
          );
        })}
      </ul>

      {evaluation.summary ? <p className="qp-score__summary">{evaluation.summary}</p> : null}
      {evaluation.risks?.length ? (
        <ul className="qp-score__notes">
          {evaluation.risks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function FacultyQuestionPapers() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ title: '', questions: blankQuestions() });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [docForm, setDocForm] = useState({ title: '', paperFile: null, answerKeyFile: null });
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState('');
  const [fileResetKey, setFileResetKey] = useState(0);
  const [busyPaperId, setBusyPaperId] = useState('');

  const load = useCallback(async () => {
    const payload = await api.facultyQuestionPapers();
    setData(payload);
    return payload;
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await load();
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [load]);

  const hasPendingEvaluation = data?.exams.some((exam) =>
    exam.myPapers.some((paper) =>
      ['queued', 'processing'].includes(paper.evaluation?.status)
    )
  );

  useEffect(() => {
    if (!hasPendingEvaluation) return undefined;

    const timer = setInterval(() => {
      load().catch((err) => setError(err.message));
    }, 5000);
    return () => clearInterval(timer);
  }, [hasPendingEvaluation, load]);

  const selected = useMemo(
    () => data?.exams.find((exam) => exam.id === selectedId) || null,
    [data, selectedId]
  );

  const expectedMarks = selected?.maxMarks || 0;
  const enteredMarks = totalOf(form.questions);
  const marksOk = expectedMarks > 0 && enteredMarks === expectedMarks;

  function openExam(exam) {
    setSelectedId(exam.id);
    setForm({ title: '', questions: blankQuestions() });
    setDocForm({ title: '', paperFile: null, answerKeyFile: null });
    setFormError('');
    setDocError('');
    setNotice('');
  }

  function selectPaperFile(file) {
    setDocError('');
    setDocForm((current) => ({ ...current, paperFile: file }));
  }

  function selectAnswerKeyFile(file) {
    setDocError('');
    setDocForm((current) => ({ ...current, answerKeyFile: file }));
  }

  async function handleDocumentSubmit(event) {
    event.preventDefault();
    setDocError('');
    setNotice('');

    if (!selected) return;
    if (!docForm.title.trim()) {
      setDocError('Give this paper set a title, for example “Set A”.');
      return;
    }

    const paperError = paperFileError(docForm.paperFile, 'Question paper');
    if (paperError) {
      setDocError(paperError);
      return;
    }

    if (docForm.answerKeyFile) {
      const answerKeyError = paperFileError(
        docForm.answerKeyFile,
        'Answer key document'
      );
      if (answerKeyError) {
        setDocError(answerKeyError);
        return;
      }
    }

    const body = new FormData();
    body.append('examId', selected.id);
    body.append('title', docForm.title.trim());
    body.append('paperFile', docForm.paperFile);
    if (docForm.answerKeyFile) body.append('answerKeyFile', docForm.answerKeyFile);

    setDocSaving(true);

    try {
      const result = await api.facultyCreatePaperDocument(body);
      setNotice(result.message);
      setDocForm({ title: '', paperFile: null, answerKeyFile: null });
      setFileResetKey((key) => key + 1);
      await load();
    } catch (err) {
      setDocError(err.message);
    } finally {
      setDocSaving(false);
    }
  }

  function updateQuestion(index, field, value) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [field]: value } : question
      ),
    }));
  }

  function addQuestion() {
    setForm((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }));
  }

  function removeQuestion(index) {
    setForm((current) => ({
      ...current,
      questions: current.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setNotice('');

    if (!selected) return;
    if (!form.title.trim()) {
      setFormError('Give this paper set a title.');
      return;
    }
    if (form.questions.length < 3) {
      setFormError('A paper needs at least 3 questions.');
      return;
    }
    if (form.questions.some((question) => !question.text.trim())) {
      setFormError('Every question needs text.');
      return;
    }
    if (form.questions.some((question) => !question.unit)) {
      setFormError('Map every question to a board syllabus unit.');
      return;
    }
    if (!marksOk) {
      setFormError(
        `The paper totals ${enteredMarks} marks but ${selected.subject.code} is out of ${expectedMarks}.`
      );
      return;
    }

    setSaving(true);

    try {
      const result = await api.facultyCreatePaper({
        examId: selected.id,
        title: form.title.trim(),
        questions: form.questions.map((question) => ({
          text: question.text.trim(),
          unit: question.unit,
          marks: Number(question.marks),
          difficulty: question.difficulty,
          cognitive: question.cognitive,
          answerKey: question.answerKey.trim(),
        })),
      });

      setNotice(
        `${result.message} AI score: ${Math.round(result.paper.evaluation?.total || 0)}/100.`
      );
      setForm({ title: '', questions: blankQuestions() });
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(paper) {
    if (!window.confirm(`Withdraw "${paper.title}"? This removes it from AI review.`)) return;

    setBusyPaperId(paper.id);
    setError('');
    setNotice('');

    try {
      const result = await api.facultyDeletePaper(paper.id);
      setNotice(result.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyPaperId('');
    }
  }

  if (loading) {
    return (
      <div className="sd__state">
        <span className="spinner" aria-label="Loading question papers" />
      </div>
    );
  }

  return (
    <section className="qp">
      {error ? (
        <div className="sd-panel">
          <div className="sd-alert" role="alert">
            {error}
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="sd-panel">
          <div className="hod-notice" role="status">
            {notice}
          </div>
        </div>
      ) : null}

      {!selected ? (
        <>
          <div className="qp-intro">
            <div>
              <h2 className="qp-intro__title">Submit a paper set</h2>
              <p className="qp-intro__text">
                Upload a finished paper document before the examination. The Examination Cell
                reviews and approves one final paper. You can also build a set question-by-question
                inside the exam to receive the AI rubric score.
              </p>
            </div>
            <div className="qp-weights" aria-label="AI scoring weights">
              {(data?.criteria || []).map((criterion) => (
                <span key={criterion.key} className="qp-weight">
                  {criterion.label}
                  <strong>{criterion.weight}%</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="qp-exams">
            {(data?.exams || []).map((exam) => (
              <article key={exam.id} className={`qp-exam${exam.isOpen ? '' : ' qp-exam--closed'}`}>
                <div className="qp-exam__head">
                  <span className="sd-session__code">{exam.subject.code}</span>
                  <span className={`qp-chip${exam.isOpen ? ' qp-chip--open' : ''}`}>
                    {exam.isOpen ? 'Open for sets' : 'Closed'}
                  </span>
                </div>
                <h3 className="qp-exam__name">{exam.name}</h3>
                <p className="qp-exam__subject">
                  {exam.subject.name} · {TYPE_LABELS[exam.type] || exam.type}
                </p>

                <dl className="qp-exam__meta">
                  <div>
                    <dt>Exam date</dt>
                    <dd>{formatDate(exam.date)}</dd>
                  </div>
                  <div>
                    <dt>Maximum marks</dt>
                    <dd>{exam.maxMarks}</dd>
                  </div>
                  <div>
                    <dt>Board syllabus</dt>
                    <dd>{exam.boardPlan?.unitCount ? `${exam.boardPlan.unitCount} units` : 'Not published'}</dd>
                  </div>
                  <div>
                    <dt>Sets submitted</dt>
                    <dd>
                      {exam.paperCount} total · {exam.myPapers.length} by you
                    </dd>
                  </div>
                  {!exam.isOpen ? (
                    <div>
                      <dt>Original deadline</dt>
                      <dd>{formatDate(exam.date)}, {exam.startTime}</dd>
                    </div>
                  ) : null}
                </dl>

                <button
                  type="button"
                  className="ex-btn ex-btn--primary qp-exam__btn"
                  onClick={() => openExam(exam)}
                >
                  {exam.isOpen ? 'Open paper set' : 'View details'}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <button type="button" className="qp-back" onClick={() => setSelectedId('')}>
            ← All examinations
          </button>

          <div className="qp-detailhead">
            <div>
              <span className="sd-session__code">{selected.subject.code}</span>
              <h2 className="qp-detailhead__name">{selected.name}</h2>
              <p className="qp-intro__text">
                {selected.subject.name} · {formatDate(selected.date)} · out of {selected.maxMarks}{' '}
                marks
              </p>
            </div>
            <div className="qp-statusblock">
              <span className={`qp-chip${selected.isOpen ? ' qp-chip--open' : ''}`}>
                {selected.isOpen ? 'Submissions open' : 'Submissions closed'}
              </span>
              {!selected.isOpen ? (
                <span className="qp-deadline">
                  Original deadline: {formatDate(selected.date)}, {selected.startTime}
                </span>
              ) : null}
            </div>
          </div>

          <div className="qp-detailgrid">
            <div className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <h2 className="sd-panel__title">Examination Board syllabus</h2>
                </div>
                <span className="sd-panel__hint">
                  {selected.boardPlan?.updatedAt
                    ? `Updated ${formatDate(selected.boardPlan.updatedAt)}`
                    : 'Set by the Examination Cell'}
                </span>
              </div>

              {selected.boardPlan?.units?.length ? (
                <ol className="qp-units">
                  {selected.boardPlan.units.map((unit) => (
                    <li key={unit.title}>
                      <strong>{unit.title}</strong>
                      {unit.topics ? <span>{unit.topics}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="fd-hint">
                  The Examination Board has not published a syllabus for this subject. Paper sets
                  cannot be scored until it is defined.
                </p>
              )}
            </div>

            <div className="sd-panel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <h2 className="sd-panel__title">Your submitted sets</h2>
                </div>
                <span className="sd-panel__hint">{selected.myPapers.length} submitted</span>
              </div>

              {selected.myPapers.length ? (
                <div className="qp-mypapers">
                  {selected.myPapers.map((paper) => (
                    <details key={paper.id} className="qp-mypaper" open>
                      <summary className="qp-mypaper__summary">
                        <span className="qp-mypaper__title">{paper.title}</span>
                        <span className={`qp-status qp-status--${paper.status}`}>
                          {paper.submissionType === 'document' && paper.status === 'submitted'
                            ? 'Awaiting review'
                            : STATUS_LABELS[paper.status]}
                        </span>
                        {selected.recommendedPaperId === paper.id ? (
                          <span className="qp-recommended">AI recommended</span>
                        ) : null}
                        {paper.submissionType === 'document' ? (
                          paper.evaluation?.status === 'completed' ? (
                            <span className="qp-mypaper__score">
                              {Math.round(paper.evaluation.total || 0)}
                              <small>/100</small>
                            </span>
                          ) : (
                            <span className="qp-mypaper__manual">
                              {paper.evaluation?.status === 'failed'
                                ? 'AI failed'
                                : 'AI processing'}
                            </span>
                          )
                        ) : (
                          <span className="qp-mypaper__score">
                            {Math.round(paper.evaluation?.total || 0)}
                            <small>/100</small>
                          </span>
                        )}
                      </summary>

                      {paper.submissionType === 'document' ? (
                        <div className="qp-docreview">
                          {paper.evaluation?.status === 'completed' ? (
                            <ScoreRows evaluation={paper.evaluation} criteria={data.criteria} />
                          ) : (
                            <p>
                              {evaluationState(paper)}
                              {paper.evaluation?.status === 'failed'
                                ? ' Withdraw this set and upload it again after resolving the issue.'
                                : '. This page updates automatically when processing finishes.'}
                            </p>
                          )}
                          <PaperDocuments paper={paper} />
                        </div>
                      ) : (
                        <ScoreRows evaluation={paper.evaluation} criteria={data.criteria} />
                      )}

                      <div className="qp-mypaper__foot">
                        <span>
                          {paper.submissionType === 'document'
                            ? `Document upload · ${paper.totalMarks} marks`
                            : `${paper.questions.length} questions · ${paper.totalMarks} marks`}
                        </span>
                        {paper.status !== 'approved' ? (
                          <button
                            type="button"
                            className="qp-danger"
                            disabled={busyPaperId === paper.id}
                            onClick={() => withdraw(paper)}
                          >
                            {busyPaperId === paper.id ? 'Withdrawing…' : 'Withdraw'}
                          </button>
                        ) : null}
                      </div>

                      {paper.reviewNote ? (
                        <p className="qp-reviewnote">Review note: {paper.reviewNote}</p>
                      ) : null}
                    </details>
                  ))}
                </div>
              ) : (
                <p className="fd-hint">You have not submitted a set for this exam yet.</p>
              )}
            </div>
          </div>

          {selected.isOpen ? (
            <form className="sd-panel qp-form qp-docform" onSubmit={handleDocumentSubmit}>
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <h2 className="sd-panel__title">New paper set</h2>
                </div>
                <span className="qp-chip">{selected.maxMarks} marks</span>
              </div>

              <p className="qp-docform__lead">
                Upload the finished question paper for this examination. The Examination Cell can
                download your document and optional answer key directly from the submitted set.
              </p>

              <label className="field-label" htmlFor="qp-doc-title">
                Set title
              </label>
              <input
                id="qp-doc-title"
                className="text-input"
                value={docForm.title}
                maxLength={120}
                placeholder="e.g. Set A"
                onChange={(event) =>
                  setDocForm((current) => ({ ...current, title: event.target.value }))
                }
              />

              <div className="qp-dropgrid">
                <PaperDropzone
                  key={`paper-${fileResetKey}`}
                  id="qp-paper-file"
                  label="Question paper"
                  required
                  file={docForm.paperFile}
                  hint="PDF or DOCX · up to 20 MB"
                  onFile={selectPaperFile}
                />

                <PaperDropzone
                  key={`answer-key-${fileResetKey}`}
                  id="qp-answer-key-file"
                  label="Answer key document"
                  file={docForm.answerKeyFile}
                  hint="PDF or DOCX · up to 20 MB"
                  onFile={selectAnswerKeyFile}
                />
              </div>

              <div className="qp-form__actions qp-docform__actions">
                <span className="qp-docform__policy">
                  Files stay private. Only you and the Examination Cell can download them.
                </span>
                <button type="submit" className="ex-btn ex-btn--primary" disabled={docSaving}>
                  {docSaving ? 'Uploading paper set…' : 'Submit paper set'}
                </button>
              </div>

              {docError ? (
                <div className="sd-alert" role="alert">
                  {docError}
                </div>
              ) : null}
            </form>
          ) : null}

          {selected.isOpen && selected.boardPlan?.units?.length ? (
            <details className="sd-panel qp-advanced">
              <summary className="qp-advanced__summary">
                <span>Advanced: build the set question-by-question</span>
                <small>
                  Use this when you want the seven-criterion AI score and automatic comparison.
                </small>
              </summary>

            <form className="qp-form" onSubmit={handleSubmit}>
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <h2 className="sd-panel__title">Structured paper set</h2>
                </div>
                <span className={`qp-total${marksOk ? ' qp-total--ok' : ''}`}>
                  {enteredMarks} / {selected.maxMarks} marks
                </span>
              </div>

              <label className="field-label" htmlFor="qp-title">
                Set title
              </label>
              <input
                id="qp-title"
                className="text-input"
                value={form.title}
                maxLength={120}
                placeholder="e.g. Set A — Board blueprint"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />

              <div className="qp-questions">
                {form.questions.map((question, index) => (
                  <fieldset key={index} className="qp-question">
                    <legend>
                      Question {index + 1}
                      {form.questions.length > 1 ? (
                        <button
                          type="button"
                          className="qp-question__remove"
                          onClick={() => removeQuestion(index)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </legend>

                    <textarea
                      className="qp-question__text"
                      rows={2}
                      maxLength={1000}
                      value={question.text}
                      placeholder="Write the question as it should appear on the paper"
                      onChange={(event) => updateQuestion(index, 'text', event.target.value)}
                    />

                    <div className="qp-question__grid">
                      <label>
                        <span className="field-label">Board unit</span>
                        <select
                          className="sd-select"
                          value={question.unit}
                          onChange={(event) => updateQuestion(index, 'unit', event.target.value)}
                        >
                          <option value="">Select unit</option>
                          {selected.boardPlan.units.map((unit) => (
                            <option key={unit.title} value={unit.title}>
                              {unit.title}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="field-label">Marks</span>
                        <input
                          className="text-input"
                          type="number"
                          min="1"
                          max="100"
                          value={question.marks}
                          onChange={(event) => updateQuestion(index, 'marks', event.target.value)}
                        />
                      </label>

                      <label>
                        <span className="field-label">Difficulty</span>
                        <select
                          className="sd-select"
                          value={question.difficulty}
                          onChange={(event) => updateQuestion(index, 'difficulty', event.target.value)}
                        >
                          {(data.difficulties || []).map((value) => (
                            <option key={value} value={value}>
                              {DIFFICULTY_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span className="field-label">Cognitive level</span>
                        <select
                          className="sd-select"
                          value={question.cognitive}
                          onChange={(event) => updateQuestion(index, 'cognitive', event.target.value)}
                        >
                          {(data.cognitiveLevels || []).map((value) => (
                            <option key={value} value={value}>
                              {COGNITIVE_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label>
                      <span className="field-label">Answer key / marking scheme</span>
                      <textarea
                        className="qp-question__key"
                        rows={2}
                        maxLength={2000}
                        value={question.answerKey}
                        placeholder="Expected answer points. A complete key improves the answer-key score."
                        onChange={(event) => updateQuestion(index, 'answerKey', event.target.value)}
                      />
                    </label>
                  </fieldset>
                ))}
              </div>

              <div className="qp-form__actions">
                <button type="button" className="sd-clear" onClick={addQuestion}>
                  + Add question
                </button>
                <button type="submit" className="ex-btn ex-btn--primary" disabled={saving}>
                  {saving ? 'Submitting for AI evaluation…' : 'Submit set for AI evaluation'}
                </button>
              </div>

              {formError ? (
                <div className="sd-alert" role="alert">
                  {formError}
                </div>
              ) : null}
            </form>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
