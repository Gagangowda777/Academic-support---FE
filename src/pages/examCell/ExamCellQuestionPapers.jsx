import { useCallback, useEffect, useMemo, useState } from 'react';
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

const COGNITIVE_LABELS = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyze',
  evaluate: 'Evaluate',
  create: 'Create',
};

function formatDate(iso) {
  return iso ? dateFormat.format(new Date(iso)) : '—';
}

function ScoreCard({ paper, criteria }) {
  return (
    <div className="qp-score">
      <ul className="qp-criteria">
        {criteria.map((criterion) => {
          const row = paper.evaluation?.breakdown?.find((item) => item.key === criterion.key);
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

      {paper.evaluation?.summary ? (
        <p className="qp-score__summary">{paper.evaluation.summary}</p>
      ) : null}
    </div>
  );
}

function setLabel(paper, index) {
  const match = /Set\s+([A-Z])\b/i.exec(paper?.title || '');
  return match ? `Set ${match[1].toUpperCase()}` : `Set ${String.fromCharCode(65 + index)}`;
}

function scoreOf(paper) {
  return paper?.submissionType === 'document' &&
    paper?.evaluation?.status !== 'completed'
    ? null
    : Math.round(paper?.evaluation?.total || 0);
}

function criterionScore(paper, key) {
  if (
    paper?.submissionType === 'document' &&
    paper?.evaluation?.status !== 'completed'
  ) {
    return null;
  }
  const row = paper?.evaluation?.breakdown?.find((item) => item.key === key);
  return row ? Math.round(row.score) : 0;
}

function evaluationLabel(paper) {
  if (paper.evaluation?.status === 'failed') {
    return paper.evaluation.error || 'AI evaluation failed';
  }
  if (paper.evaluation?.status === 'processing') return 'AI evaluation in progress';
  if (paper.evaluation?.status === 'queued') return 'AI evaluation queued';
  return 'Awaiting AI evaluation';
}

function reviewStatus(paper) {
  if (paper.status === 'approved') return 'Approved';
  if (paper.status === 'rejected') return 'Returned';
  return 'In review';
}

function buildVerdict(exam, criteria) {
  const papers = exam?.papers || [];
  const labelById = new Map(papers.map((paper, index) => [paper.id, setLabel(paper, index)]));

  if (!papers.length) {
    return {
      papers,
      labelById,
      recommended: null,
      recommendedLabel: '',
      recommendedScore: null,
      gaps: [],
      decisive: [],
      exposed: [],
      narrative: 'No paper sets have been submitted for this examination.',
    };
  }

  const recommended = papers.find((paper) => paper.id === exam.recommendedPaperId) || null;
  const others = recommended
    ? papers.filter((paper) => paper.id !== recommended.id)
    : [];
  const recommendedScore = recommended ? scoreOf(recommended) : null;

  const gaps = others.map((paper) => {
    const otherScore = scoreOf(paper);
    const rows = criteria.map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      weight: criterion.weight,
      recommended: recommended ? criterionScore(recommended, criterion.key) : null,
      other: criterionScore(paper, criterion.key),
    }));

    return {
      paper,
      label: labelById.get(paper.id),
      score: otherScore,
      gap:
        recommendedScore !== null && otherScore !== null
          ? recommendedScore - otherScore
          : null,
      wins: rows
        .filter((row) => row.recommended !== null && row.other !== null && row.recommended > row.other)
        .sort((first, second) => second.recommended - second.other - (first.recommended - first.other))
        .slice(0, 2),
      losses: rows
        .filter((row) => row.recommended !== null && row.other !== null && row.recommended < row.other)
        .sort((first, second) => first.recommended - first.other - (second.recommended - second.other))
        .slice(0, 2),
    };
  });

  const edgeRows = criteria.map((criterion) => {
    const recommendedValue = recommended ? criterionScore(recommended, criterion.key) : null;
    const otherValues = others
      .map((paper) => criterionScore(paper, criterion.key))
      .filter((value) => value !== null);

    return {
      key: criterion.key,
      label: criterion.label,
      weight: criterion.weight,
      recommended: recommendedValue,
      bestOther: otherValues.length ? Math.max(...otherValues) : null,
      diff:
        recommendedValue !== null && otherValues.length
          ? recommendedValue - Math.max(...otherValues)
          : null,
    };
  });

  const decisive = edgeRows
    .filter((row) => row.diff !== null && row.diff > 0)
    .sort((first, second) => second.diff - first.diff)
    .slice(0, 2);
  const exposed = edgeRows
    .filter((row) => row.diff !== null && row.diff < 0)
    .sort((first, second) => first.diff - second.diff)
    .slice(0, 2);

  if (!recommended) {
    return {
      papers,
      labelById,
      recommended: null,
      recommendedLabel: '',
      recommendedScore: null,
      gaps,
      decisive,
      exposed,
      narrative:
        'No AI recommendation is available yet because no paper set has a completed evaluation.',
    };
  }

  const gapText = gaps.length
    ? gaps
        .map((gap) =>
          gap.gap === null
            ? `${gap.label} has no completed AI score`
            : `${Math.abs(gap.gap)} point${Math.abs(gap.gap) === 1 ? '' : 's'} ${gap.gap >= 0 ? 'ahead of' : 'behind'} ${gap.label}`
        )
        .join(', ')
    : 'no other set has a comparable score';
  const decisiveText = decisive.length
    ? decisive
        .map((row) => `${row.label} (+${row.diff})`)
        .join(' and ')
    : 'the overall total';
  const decisiveWeight = decisive.reduce((sum, row) => sum + (row.weight || 0), 0);
  const exposureText = exposed.length
    ? ` ${exposed
        .map((row) => `${row.label} (${Math.abs(row.diff)} points)`)
        .join(' and ')} ${exposed.length === 1 ? 'is the only area' : 'are the only areas'} where another set is stronger.`
    : ' No other set beats it on any rubric criterion.';
  const strengthText = recommended.evaluation?.strengths?.[0]
    ? ` ${recommended.evaluation.strengths[0]}`
    : '';

  return {
    papers,
    labelById,
    recommended,
    recommendedLabel: labelById.get(recommended.id),
    recommendedScore,
    gaps,
    decisive,
    exposed,
    narrative: `${labelById.get(recommended.id)} is the AI recommendation with ${recommendedScore}/100. It is ${gapText}. It leads on ${decisiveText}, covering ${decisiveWeight}% of the rubric.${exposureText}${strengthText}`,
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadComparisonReport(exam, criteria) {
  const verdict = buildVerdict(exam, criteria);
  const ranked = [...verdict.papers].sort(
    (left, right) => (scoreOf(right) ?? -1) - (scoreOf(left) ?? -1)
  );
  const rankById = new Map(ranked.map((paper, index) => [paper.id, index + 1]));
  const rows = [
    ['AI-17 Question Paper Comparison Report'],
    ['Examination', `${exam.subject.code} · ${exam.name}`],
    ['Subject', exam.subject.name],
    ['Exam date', formatDate(exam.date)],
    ['Generated at', new Date().toISOString()],
    [
      'Recommended set',
      verdict.recommended
        ? `${verdict.recommendedLabel} · ${verdict.recommended.title}`
        : 'No AI recommendation (manual review)',
    ],
    ['Recommendation rationale', verdict.narrative],
    [],
    [
      'Rank',
      'Set',
      'Title',
      'Faculty',
      'Format',
      'Review status',
      'Overall score (/100)',
      ...criteria.map((criterion) => `${criterion.label} (${criterion.weight}%)`),
      'Strengths',
      'Risks',
    ],
  ];

  verdict.papers.forEach((paper, index) => {
    rows.push([
      rankById.get(paper.id),
      setLabel(paper, index),
      paper.title,
      paper.faculty?.name || '',
      paper.submissionType === 'document' ? 'Document upload' : 'Structured',
      reviewStatus(paper),
      scoreOf(paper) ?? evaluationLabel(paper),
      ...criteria.map(
        (criterion) => criterionScore(paper, criterion.key) ?? evaluationLabel(paper)
      ),
      (paper.evaluation?.strengths || []).join(' | '),
      (paper.evaluation?.risks || []).join(' | '),
    ]);
  });

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = `${exam.subject.code}-${exam.name}`.replace(/[^a-z0-9]+/gi, '-');
  link.href = url;
  link.download = `AI17-Comparison-Report-${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ComparisonSetCard({ paper, index, verdict, criteria }) {
  const label = setLabel(paper, index);
  const recommended = verdict.recommended?.id === paper.id;
  const total = scoreOf(paper);

  return (
    <article className={`qp-setcard${recommended ? ' qp-setcard--recommended' : ''}`}>
      <div className="qp-setcard__head">
        <span className="qp-settag">{label}</span>
        {recommended ? <span className="qp-recommended">AI recommended</span> : null}
        {paper.status === 'approved' ? (
          <span className="qp-chip qp-chip--approved">Approved</span>
        ) : null}
      </div>
      <h3 className="qp-setcard__title">{paper.title}</h3>
      <p className="qp-setcard__meta">
        {paper.faculty?.name || 'Faculty'} · {paper.questions?.length || 0} questions ·{' '}
        {paper.totalMarks} marks
      </p>
      <div className="qp-setcard__score">
        {total === null ? (
          <span className="qp-setcard__manual">{evaluationLabel(paper)}</span>
        ) : (
          <>
            <strong>{total}</strong>
            <span>/100</span>
          </>
        )}
      </div>
      {total !== null ? (
        <ul className="qp-setcard__criteria">
          {criteria.map((criterion) => {
            const score = criterionScore(paper, criterion.key);
            return (
              <li key={criterion.key}>
                <span>{criterion.label}</span>
                <span className="qp-minibar" aria-hidden="true">
                  <i style={{ width: `${score || 0}%` }} />
                </span>
                <strong>{score}</strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="qp-setcard__manualtext">
          {evaluationLabel(paper)}
        </p>
      )}
      <div className="qp-setcard__foot">
        <span>{reviewStatus(paper)}</span>
        <span>{paper.evaluation?.engine || 'Local AI evaluator'}</span>
      </div>
    </article>
  );
}

function ComparisonTable({ exam, criteria, verdict }) {
  const papers = exam.papers || [];
  const rows = [
    {
      key: 'total',
      label: 'Overall score',
      weight: '100%',
      get: (paper) => scoreOf(paper),
      total: true,
    },
    ...criteria.map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      weight: `${criterion.weight}%`,
      get: (paper) => criterionScore(paper, criterion.key),
    })),
  ];

  return (
    <div className="qp-comparetable-wrap">
      <table className="qp-comparetable">
        <thead>
          <tr>
            <th scope="col">Rubric</th>
            {papers.map((paper, index) => (
              <th
                key={paper.id}
                scope="col"
                className={verdict.recommended?.id === paper.id ? 'is-recommended' : undefined}
              >
                <span>{setLabel(paper, index)}</span>
                <small>{paper.faculty?.name || paper.title}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = papers.map((paper) => row.get(paper)).filter((value) => value !== null);
            const best = values.length ? Math.max(...values) : null;

            return (
              <tr key={row.key} className={row.total ? 'qp-comparetable__total' : undefined}>
                <th scope="row">
                  {row.label}
                  <span>{row.weight}</span>
                </th>
                {papers.map((paper) => {
                  const value = row.get(paper);
                  const isBest = value !== null && value === best;

                  return (
                    <td
                      key={paper.id}
                      className={`${isBest ? 'is-best' : ''} ${
                        verdict.recommended?.id === paper.id ? 'is-recommended' : ''
                      }`}
                    >
                      {value === null ? (
                        <span className="qp-comparetable__manual">—</span>
                      ) : (
                        <div className="qp-comparecell">
                          <strong>{value}</strong>
                          <span className="qp-minibar" aria-hidden="true">
                            <i style={{ width: `${value}%` }} />
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ExamCellQuestionPapers() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    const payload = await api.examCellQuestionPapers();
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
    exam.papers.some((paper) =>
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

  const exams = useMemo(() => {
    if (!data) return [];
    return [...data.exams].sort((left, right) => {
      if (left.paperCount !== right.paperCount) return right.paperCount - left.paperCount;
      return left.date < right.date ? -1 : 1;
    });
  }, [data]);

  const comparisonPapers = useMemo(() => {
    if (!selected) return [];
    return selected.papers
      .map((paper, index) => ({ paper, index, label: setLabel(paper, index) }))
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((entry) => entry.paper);
  }, [selected]);

  const comparisonExam = useMemo(
    () => (selected ? { ...selected, papers: comparisonPapers } : null),
    [selected, comparisonPapers]
  );

  const verdict = useMemo(
    () => (comparisonExam ? buildVerdict(comparisonExam, data?.criteria || []) : null),
    [comparisonExam, data]
  );

  async function approve(paper) {
    if (
      !window.confirm(
        `Approve "${paper.title}" by ${paper.faculty.name} as the final paper for ${selected.name}?`
      )
    ) {
      return;
    }

    setBusyId(paper.id);
    setError('');
    setNotice('');

    try {
      const result = await api.examCellApprovePaper(paper.id);
      setNotice(result.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function reject(paper) {
    const note = window.prompt(
      `Return "${paper.title}" to ${paper.faculty.name}. Add an optional review note:`,
      ''
    );
    if (note === null) return;

    setBusyId(paper.id);
    setError('');
    setNotice('');

    try {
      const result = await api.examCellRejectPaper(paper.id, note);
      setNotice(result.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  if (loading) {
    return (
      <div className="sd__state">
        <span className="spinner" aria-label="Loading paper submissions" />
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
              <h2 className="qp-intro__title">AI paper review</h2>
              <p className="qp-intro__text">
                Every valid set is scored against the Examination Board syllabus. Compare the
                ranking, then approve the final paper for the examination.
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
            {exams.map((exam) => {
              const top = exam.papers[0];
              const approved = exam.papers.find((paper) => paper.id === exam.approvedPaperId);

              return (
                <article key={exam.id} className="qp-exam">
                  <div className="qp-exam__head">
                    <span className="sd-session__code">{exam.subject.code}</span>
                    {approved ? (
                      <span className="qp-chip qp-chip--approved">Final paper approved</span>
                    ) : exam.paperCount ? (
                      <span className="qp-chip qp-chip--open">Awaiting your approval</span>
                    ) : (
                      <span className="qp-chip">No sets yet</span>
                    )}
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
                      <dt>Paper sets</dt>
                      <dd>{exam.paperCount}</dd>
                    </div>
                    <div>
                      <dt>{approved ? 'Approved' : 'Top AI score'}</dt>
                      <dd>
                        {approved
                          ? `${approved.faculty.name} · ${Math.round(approved.evaluation?.total || 0)}`
                          : top
                            ? `${Math.round(top.evaluation?.total || 0)}/100`
                            : '—'}
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="ex-btn ex-btn--primary qp-exam__btn"
                    disabled={!exam.paperCount}
                    onClick={() => {
                      setSelectedId(exam.id);
                      setError('');
                      setNotice('');
                    }}
                  >
                    {exam.paperCount ? 'Review submissions' : 'No submissions'}
                  </button>
                </article>
              );
            })}
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
                {selected.subject.name} · {formatDate(selected.date)} · {selected.paperCount} set
                {selected.paperCount === 1 ? '' : 's'} submitted · out of {selected.maxMarks} marks
              </p>
            </div>
            {selected.approvedPaperId ? (
              <span className="qp-chip qp-chip--approved">
                Approved {formatDate(selected.approvedAt)}
              </span>
            ) : (
              <span className="qp-chip qp-chip--open">Review pending</span>
            )}
          </div>

          {selected.papers.length ? (
            <section className="sd-panel qp-comparepanel">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <div>
                    <span className="qp-eyebrow">AI-17 · comparison view</span>
                    <h2 className="sd-panel__title">Compare all submitted sets</h2>
                    <span className="qp-panelhint">
                      {comparisonPapers
                        .map((paper, index) => setLabel(paper, index))
                        .join(' vs ')}{' '}
                      · {comparisonPapers.length} sets scored against the same board syllabus
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="ex-btn ex-btn--primary qp-downloadreport"
                  onClick={() => downloadComparisonReport(comparisonExam, data.criteria)}
                  title="Download the AI-17 comparison report as a CSV file"
                >
                  <span aria-hidden="true">↓</span>
                  Download Comparison Report
                </button>
              </div>

              {verdict?.recommended ? (
                <div className="qp-verdict">
                  <div className="qp-verdict__main">
                    <span className="qp-verdict__kicker">AI recommendation</span>
                    <div className="qp-verdict__headline">
                      <span className="qp-verdict__set">{verdict.recommendedLabel}</span>
                      <h3>{verdict.recommended.title}</h3>
                      <span className="qp-verdict__score">
                        {verdict.recommendedScore}
                        <small>/100</small>
                      </span>
                    </div>
                    <p className="qp-verdict__narrative">{verdict.narrative}</p>
                  </div>

                  <div className="qp-verdict__why">
                    <span className="qp-minilabel">Why it wins</span>
                    {verdict.decisive.length ? (
                      <ul className="qp-decisive">
                        {verdict.decisive.map((row) => (
                          <li key={row.key}>
                            <strong>{row.label}</strong>
                            <span>
                              +{row.diff} lead · {row.weight}% weight
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fd-hint">The total score decides this recommendation.</p>
                    )}
                    {verdict.exposed.length ? (
                      <p className="qp-verdict__exposure">
                        Another set leads on{' '}
                        {verdict.exposed
                          .map((row) => `${row.label} (${Math.abs(row.diff)})`)
                          .join(', ')}
                        , but the overall gap remains.
                      </p>
                    ) : (
                      <p className="qp-verdict__exposure qp-verdict__exposure--clear">
                        No other set beats it on any rubric criterion.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="qp-verdict qp-verdict--manual">
                  <strong>No AI recommendation is available.</strong>
                  <p>{verdict?.narrative}</p>
                </div>
              )}

              {verdict?.gaps?.length ? (
                <div className="qp-gapgrid">
                  {verdict.gaps.map((gap) => (
                    <article key={gap.paper.id} className="qp-gapcard">
                      <div className="qp-gapcard__head">
                        <strong>vs {gap.label}</strong>
                        <span className={gap.gap >= 0 ? 'qp-gapcard__up' : 'qp-gapcard__down'}>
                          {gap.gap === null
                            ? 'No AI score'
                            : `${gap.gap >= 0 ? '+' : ''}${gap.gap} points`}
                        </span>
                      </div>
                      <p>
                        {gap.wins.length
                          ? `${verdict.recommendedLabel} leads on ${gap.wins
                              .map((row) => `${row.label} (+${row.recommended - row.other})`)
                              .join(' and ')}.`
                          : `${verdict.recommendedLabel} has no criterion lead over ${gap.label}.`}
                        {gap.losses.length
                          ? ` ${gap.label} is stronger on ${gap.losses
                              .map((row) => `${row.label} (+${row.other - row.recommended})`)
                              .join(' and ')}, but trails the overall score.`
                          : ` ${gap.label} does not beat it on any criterion.`}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="qp-setgrid">
                {comparisonPapers.map((paper, index) => (
                  <ComparisonSetCard
                    key={paper.id}
                    paper={paper}
                    index={index}
                    verdict={verdict}
                    criteria={data.criteria}
                  />
                ))}
              </div>

              <div className="qp-comparetablehead">
                <div>
                  <span className="qp-minilabel">Consolidated rubric</span>
                  <p className="fd-hint">
                    Higher scores are highlighted. The recommended set is outlined in blue.
                  </p>
                </div>
                <span className="qp-chip">{comparisonPapers.length} sets compared</span>
              </div>
              <ComparisonTable exam={comparisonExam} criteria={data.criteria} verdict={verdict} />
            </section>
          ) : null}

          {selected.boardPlan?.units?.length ? (
            <div className="sd-panel qp-board">
              <div className="sd-panel__head">
                <div className="sd-panel__titlewrap">
                  <h2 className="sd-panel__title">Board syllabus used for scoring</h2>
                </div>
                <span className="sd-panel__hint">{selected.boardPlan.unitCount} units</span>
              </div>
              <div className="qp-board__units">
                {selected.boardPlan.units.map((unit) => (
                  <span key={unit.title} className="qp-board__unit">
                    {unit.title}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="sd-panel">
              <div className="sd-alert">
                No Examination Board syllabus is published for this subject, so coverage cannot be
                scored.
              </div>
            </div>
          )}

          {selected.papers.length ? (
            <details className="qp-fullreviews">
              <summary>
                <span>Full set reviews &amp; approval actions</span>
                <span className="qp-chip">{selected.papers.length} sets</span>
              </summary>
              <div className="qp-fullreviews__body">
                {selected.papers.map((paper, index) => {
            const recommended = selected.recommendedPaperId === paper.id;
            const approved = selected.approvedPaperId === paper.id;

            return (
              <article
                key={paper.id}
                className={`sd-panel qp-paper${approved ? ' qp-paper--approved' : ''}`}
              >
                <div className="qp-paper__head">
                  <div className="qp-paper__identity">
                    <span className="qp-rank">#{index + 1}</span>
                    <div>
                      <h3 className="qp-paper__title">{paper.title}</h3>
                      <p className="qp-paper__faculty">
                        {paper.faculty.name} · submitted {formatDate(paper.submittedAt)} ·{' '}
                        {paper.submissionType === 'document'
                          ? `Document upload · ${paper.totalMarks} marks`
                          : `${paper.questions.length} questions · ${paper.totalMarks} marks`}
                      </p>
                    </div>
                  </div>

                  <div className="qp-paper__chips">
                    {recommended ? <span className="qp-recommended">AI recommended</span> : null}
                    {approved ? <span className="qp-chip qp-chip--approved">Approved</span> : null}
                    {paper.status === 'rejected' ? (
                      <span className="qp-chip">Returned</span>
                    ) : null}
                  </div>
                </div>

                {paper.submissionType === 'document' &&
                paper.evaluation?.status !== 'completed' ? (
                  <div className="qp-paper__scoreband qp-paper__scoreband--manual">
                    <span className="qp-paper__engine">
                      {paper.evaluation?.status === 'failed'
                        ? 'AI evaluation failed'
                        : evaluationLabel(paper)}
                    </span>
                    <span className="qp-paper__faculty">
                      {paper.evaluation?.status === 'failed'
                        ? paper.evaluation.error
                        : 'This review updates automatically when local AI processing finishes.'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="qp-paper__scoreband">
                      <span className="qp-paper__total">
                        {Math.round(paper.evaluation?.total || 0)}
                        <small>/100</small>
                      </span>
                      <span className="qp-paper__engine">
                        {paper.evaluation?.engine || 'Awaiting AI evaluation'}
                      </span>
                    </div>

                    <ScoreCard paper={paper} criteria={data.criteria} />

                    <div className="qp-paper__cols">
                      <div>
                        <span className="qp-minilabel">Strengths</span>
                        {paper.evaluation?.strengths?.length ? (
                          <ul className="qp-strengths">
                            {paper.evaluation.strengths.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="fd-hint">No standout strengths detected.</p>
                        )}
                      </div>
                      <div>
                        <span className="qp-minilabel">Risks</span>
                        {paper.evaluation?.risks?.length ? (
                          <ul className="qp-risks">
                            {paper.evaluation.risks.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="fd-hint">No material risks detected.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {paper.reviewNote ? (
                  <p className="qp-reviewnote">Review note: {paper.reviewNote}</p>
                ) : null}

                {paper.paperDocument || paper.answerKeyDocument ? (
                  <div className="qp-docfiles">
                    {paper.paperDocument ? (
                      <a className="qp-docfile" href={`/api/question-papers/${paper.id}/paper`}>
                        <span className="qp-docfile__ext">{paper.paperDocument.extension}</span>
                        <span className="qp-docfile__body">
                          <strong>Question paper document</strong>
                          <span>{paper.paperDocument.name}</span>
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
                          <strong>Answer key document</strong>
                          <span>{paper.answerKeyDocument.name}</span>
                        </span>
                        <span className="qp-docfile__action">Download</span>
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {paper.submissionType !== 'document' ? (
                  <details className="qp-paper__questions">
                    <summary>View all {paper.questions.length} questions and answer keys</summary>
                    <ol className="qp-questionlist">
                      {paper.questions.map((question, questionIndex) => (
                        <li key={`${paper.id}-${questionIndex}`}>
                          <div className="qp-questionlist__top">
                            <strong>Q{questionIndex + 1}</strong>
                            <span>{question.marks} marks</span>
                            <span>{question.unit}</span>
                            <span>{question.difficulty}</span>
                            <span>{COGNITIVE_LABELS[question.cognitive] || question.cognitive}</span>
                          </div>
                          <p className="qp-questionlist__text">{question.text}</p>
                          <p className="qp-questionlist__key">
                            <strong>Answer key:</strong>{' '}
                            {question.answerKey || 'Not provided'}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}

                <div className="qp-paper__actions">
                  {approved ? (
                    <button
                      type="button"
                      className="qp-danger"
                      disabled={busyId === paper.id}
                      onClick={() => reject(paper)}
                    >
                      {busyId === paper.id ? 'Working…' : 'Revoke approval'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="qp-danger"
                        disabled={busyId === paper.id || paper.status === 'rejected'}
                        onClick={() => reject(paper)}
                      >
                        Return to faculty
                      </button>
                      <button
                        type="button"
                        className="ex-btn ex-btn--primary"
                        disabled={busyId === paper.id || paper.status === 'rejected'}
                        onClick={() => approve(paper)}
                      >
                        {busyId === paper.id ? 'Working…' : 'Approve as final paper'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
                })}
              </div>
            </details>
          ) : null}

          {!selected.papers.length ? (
            <div className="sd-panel">
              <div className="sd-empty">
                <p className="sd-empty__title">No paper sets submitted</p>
                <p className="sd-empty__text">
                  Faculty can submit sets until the examination date. Scores and a recommendation
                  will appear here automatically.
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
