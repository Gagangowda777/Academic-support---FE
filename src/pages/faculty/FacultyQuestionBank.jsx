import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import QuestionBankPanel from './QuestionBankPanel';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function FacultyQuestionBank() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api
      .facultyQuestionPapers()
      .then((result) => {
        if (!active) return;
        setExams(result.exams || []);
        setSelectedExamId(result.exams?.[0]?.id || '');
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedExam = exams.find((exam) => exam.id === selectedExamId);

  return (
    <section className="fd-qbank-dashboard" aria-label="AI question bank and past-paper analysis">
      <div className="fd-qbank-intro">
        <div>
          <span className="fd-qbank-eyebrow">Teaching tools</span>
          <h2>AI question bank &amp; past-paper analysis</h2>
          <p>
            Choose an examination to generate a syllabus-aligned question bank from class notes,
            then analyse the latest five years of past papers separately for recurring topics and
            trends.
          </p>
        </div>
        <span className="fd-qbank-ai">AI powered</span>
      </div>

      {error ? <div className="sd-alert" role="alert">{error}</div> : null}
      {loading ? (
        <div className="sd__state">
          <span className="spinner" aria-label="Loading examinations" />
        </div>
      ) : null}

      {!loading && !error && !exams.length ? (
        <div className="sd-panel fd-qbank-empty">
          <h3>No examinations available</h3>
          <p>Examinations assigned to your subjects will appear here.</p>
        </div>
      ) : null}

      {!loading && exams.length ? (
        <>
          <div className="fd-qbank-exams" aria-label="Choose an examination">
            {exams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                className={`fd-qbank-exam${selectedExamId === exam.id ? ' fd-qbank-exam--active' : ''}`}
                aria-pressed={selectedExamId === exam.id}
                onClick={() => setSelectedExamId(exam.id)}
              >
                <span className="fd-qbank-exam__top">
                  <span className="fd-code">{exam.subject.code}</span>
                  <span>{exam.boardPlan?.unitCount ? `${exam.boardPlan.unitCount} syllabus units` : 'Syllabus pending'}</span>
                </span>
                <strong>{exam.name}</strong>
                <span className="fd-qbank-exam__subject">{exam.subject.name}</span>
                <span className="fd-qbank-exam__bottom">
                  {dateFormat.format(new Date(exam.date))}
                  <span>{exam.myPapers.length} paper sets</span>
                </span>
              </button>
            ))}
          </div>
          {selectedExam ? <QuestionBankPanel key={selectedExam.id} exam={selectedExam} /> : null}
        </>
      ) : null}
    </section>
  );
}
