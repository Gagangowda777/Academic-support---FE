
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

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

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div
      className="ad-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`ad-modal__card${wide ? ' ad-modal__card--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="ad-modal__head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="ad-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function blankSubject(defaults = {}) {
  return {
    code: '',
    name: '',
    department: defaults.department || 'Computer Science',
    semester: 5,
    academicYear: '2026-27',
    batch: '2024-2028',
    section: 'A',
    facultyId: '',
  };
}

function subjectPayload(values) {
  return {
    ...values,
    semester: Number(values.semester),
    facultyId: values.facultyId || null,
  };
}

export default function AcademicManager({ academics, onRefresh }) {
  const [notice, setNotice] = useState('');
  const [subjectEditor, setSubjectEditor] = useState(null);
  const [facultyEditor, setFacultyEditor] = useState(null);
  const [requirementsEditor, setRequirementsEditor] = useState(null);

  const subjects = academics?.subjects || [];
  const faculty = academics?.faculty || [];
  const summary = academics?.summary || {};
  const departments = useMemo(() => {
    const values = new Set([...(academics?.departments || []), ...subjects.map((item) => item.department)]);
    return [...values].filter(Boolean).sort();
  }, [academics?.departments, subjects]);

  function openCreate() {
    setSubjectEditor({
      mode: 'create',
      values: blankSubject({ department: departments[0] }),
      saving: false,
      error: '',
    });
  }

  function openEdit(subject) {
    setSubjectEditor({
      mode: 'edit',
      id: subject.id,
      values: {
        code: subject.code,
        name: subject.name,
        department: subject.department || departments[0] || '',
        semester: subject.semester,
        academicYear: subject.academicYear,
        batch: subject.batch,
        section: subject.section,
        facultyId: subject.faculty?.id || '',
      },
      saving: false,
      error: '',
    });
  }

  function openFaculty(subject) {
    setFacultyEditor({
      subject,
      facultyId: subject.faculty?.id || '',
      saving: false,
      error: '',
    });
  }

  function openRequirements(subject) {
    const plan = subject.plan || {};
    setRequirementsEditor({
      subject,
      syllabus: (plan.syllabus || []).map((unit) => ({
        title: unit.title || '',
        topics: unit.topics || '',
      })),
      components: (plan.components || []).map((component) => ({
        name: component.name || '',
        maxMarks: component.maxMarks ?? '',
      })),
      notes: plan.notes || '',
      saving: false,
      error: '',
    });
  }

  async function saveSubject(event) {
    event.preventDefault();
    if (!subjectEditor) return;

    setSubjectEditor((current) => ({ ...current, saving: true, error: '' }));
    try {
      const payload = subjectPayload(subjectEditor.values);
      const response =
        subjectEditor.mode === 'create'
          ? await api.adminCreateSubject(payload)
          : await api.adminUpdateSubject(subjectEditor.id, payload);
      setSubjectEditor(null);
      setNotice(response.message);
      await onRefresh();
    } catch (error) {
      setSubjectEditor((current) =>
        current ? { ...current, saving: false, error: error.message } : current
      );
    }
  }

  async function saveFaculty(event) {
    event.preventDefault();
    if (!facultyEditor) return;

    setFacultyEditor((current) => ({ ...current, saving: true, error: '' }));
    try {
      const response = await api.adminAssignSubjectFaculty(
        facultyEditor.subject.id,
        facultyEditor.facultyId
      );
      setFacultyEditor(null);
      setNotice(response.message);
      await onRefresh();
    } catch (error) {
      setFacultyEditor((current) =>
        current ? { ...current, saving: false, error: error.message } : current
      );
    }
  }

  function updateRequirements(updater) {
    setRequirementsEditor((current) => (current ? updater(current) : current));
  }

  async function saveRequirements(event) {
    event.preventDefault();
    if (!requirementsEditor) return;

    setRequirementsEditor((current) => ({ ...current, saving: true, error: '' }));
    try {
      const response = await api.adminSaveSubjectRequirements(requirementsEditor.subject.id, {
        syllabus: requirementsEditor.syllabus,
        components: requirementsEditor.components.map((component) => ({
          ...component,
          maxMarks: Number(component.maxMarks),
        })),
        notes: requirementsEditor.notes,
      });
      setRequirementsEditor(null);
      setNotice(response.message);
      await onRefresh();
    } catch (error) {
      setRequirementsEditor((current) =>
        current ? { ...current, saving: false, error: error.message } : current
      );
    }
  }

  const candidateFaculty = facultyEditor
    ? faculty.filter((member) => member.department === facultyEditor.subject.department)
    : [];
  const requirementTotal = requirementsEditor
    ? requirementsEditor.components.reduce(
        (sum, component) => sum + (Number(component.maxMarks) || 0),
        0
      )
    : 0;

  return (
    <>
      {notice ? (
        <div className="sd-alert sd-alert--good ad-alert" role="status">
          <span>{notice}</span>
          <button type="button" className="ad-alert__retry" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="sd-summary" aria-label="Academic summary">
        <article className="sd-summary__card">
          <span className="sd-summary__label">Subjects</span>
          <strong className="sd-summary__value">{summary.subjects ?? subjects.length}</strong>
          <span className="sd-summary__hint">{summary.assigned ?? 0} assigned to faculty</span>
        </article>
        <article className="sd-summary__card">
          <span className="sd-summary__label">Unassigned</span>
          <strong className="sd-summary__value">{summary.unassigned ?? 0}</strong>
          <span className="sd-summary__hint">need a faculty owner</span>
        </article>
        <article className="sd-summary__card">
          <span className="sd-summary__label">Requirements configured</span>
          <strong className="sd-summary__value">
            {summary.withExamRequirements ?? summary.withBoardSyllabus ?? 0}
          </strong>
          <span className="sd-summary__hint">syllabus or marks scheme saved</span>
        </article>
        <article className="sd-summary__card">
          <span className="sd-summary__label">Examinations</span>
          <strong className="sd-summary__value">{summary.exams ?? 0}</strong>
          <span className="sd-summary__hint">{summary.upcomingExams ?? 0} scheduled</span>
        </article>
      </section>

      <section className="sd-panel">
        <div className="sd-panel__head ad-manage-head">
          <div className="sd-panel__titlewrap">
            <h2 className="sd-panel__title">Subject catalogue</h2>
          </div>
          <div className="ad-manage-head__actions">
            <span className="sd-panel__hint">{subjects.length} subjects</span>
            <button type="button" className="ad-primary" onClick={openCreate}>
              + Add subject
            </button>
          </div>
        </div>
        <p className="ov-note ad-manage-intro">
          Create subjects, assign an active faculty owner, and save the examination requirements
          used by the Exam Cell when reviewing papers.
        </p>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Batch</th>
                <th>Examination requirements</th>
                <th>Delivery</th>
                <th className="ad-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const plan = subject.plan || {};
                const units = plan.syllabus?.length || 0;
                const components = plan.components?.length || 0;
                const configured = units > 0 || components > 0;

                return (
                  <tr key={subject.id}>
                    <td>
                      <strong>{subject.code}</strong>
                      <span className="ad-sub">{subject.name}</span>
                      <span className="ad-sub">
                        {subject.department} · Semester {subject.semester}
                      </span>
                    </td>
                    <td>
                      {subject.faculty?.name || <span className="ad-muted">Unassigned</span>}
                      {subject.faculty?.email ? (
                        <span className="ad-sub">{subject.faculty.email}</span>
                      ) : null}
                    </td>
                    <td>
                      {subject.batch}
                      <span className="ad-sub">
                        {subject.academicYear} · Section {subject.section}
                      </span>
                    </td>
                    <td>
                      {configured ? (
                        <>
                          <span className="ad-badge ad-badge--good">Configured</span>
                          <span className="ad-sub">
                            {units} units · {components} components · {plan.totalMarks || 0} marks
                          </span>
                          {plan.updatedAt ? (
                            <span className="ad-sub">
                              Updated {dateFormat.format(new Date(plan.updatedAt))}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="ad-muted">Not configured</span>
                      )}
                    </td>
                    <td>
                      {subject.sessionCount} sessions
                      <span className="ad-sub">
                        {subject.materialCount} materials · {subject.studentCount} students
                      </span>
                      <span className="ad-sub">
                        Attendance <Rate value={subject.attendance?.rate} />
                      </span>
                    </td>
                    <td className="ad-table__actions">
                      <div className="ad-row-actions">
                        <button
                          type="button"
                          className="ad-action"
                          onClick={() => openEdit(subject)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ad-action"
                          onClick={() => openFaculty(subject)}
                        >
                          Allocate faculty
                        </button>
                        <button
                          type="button"
                          className="ad-action"
                          onClick={() => openRequirements(subject)}
                        >
                          Requirements
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!subjects.length ? (
          <div className="sd-empty">
            <p className="sd-empty__title">No subjects in the catalogue</p>
            <p className="sd-empty__text">Add the first subject to begin allocating faculty.</p>
          </div>
        ) : null}
      </section>

      <section className="sd-panel">
        <div className="sd-panel__head">
          <div className="sd-panel__titlewrap">
            <h2 className="sd-panel__title">Examination schedule</h2>
          </div>
        </div>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Examination</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Paper sets</th>
              </tr>
            </thead>
            <tbody>
              {(academics?.exams || []).map((exam) => (
                <tr key={exam.id}>
                  <td>
                    <strong>{exam.name}</strong>
                    <span className="ad-sub">{exam.type}</span>
                  </td>
                  <td>{exam.subject ? `${exam.subject.code} · ${exam.subject.name}` : '—'}</td>
                  <td>{dateFormat.format(new Date(exam.date))}</td>
                  <td>
                    {exam.startTime}–{exam.endTime}
                  </td>
                  <td>
                    <span className="ad-badge">{exam.status}</span>
                  </td>
                  <td>{exam.paperCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {subjectEditor ? (
        <Modal
          title={subjectEditor.mode === 'create' ? 'Add subject' : 'Edit subject'}
          subtitle="Subject identity and delivery cohort. Faculty can be allocated now or later."
          onClose={() => setSubjectEditor(null)}
          wide
        >
          <form className="ad-form" onSubmit={saveSubject}>
            <div className="ad-form__grid">
              <label className="sd-field">
                <span className="field-label">Subject code</span>
                <input
                  className="text-input"
                  value={subjectEditor.values.code}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: {
                              ...current.values,
                              code: event.target.value.toUpperCase(),
                            },
                          }
                        : current
                    )
                  }
                  placeholder="CS504"
                  maxLength={16}
                  autoFocus
                  required
                />
              </label>
              <label className="sd-field">
                <span className="field-label">Semester</span>
                <input
                  className="text-input"
                  type="number"
                  min="1"
                  max="12"
                  value={subjectEditor.values.semester}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: { ...current.values, semester: event.target.value },
                          }
                        : current
                    )
                  }
                  required
                />
              </label>
              <label className="sd-field ad-form__wide">
                <span className="field-label">Subject name</span>
                <input
                  className="text-input"
                  value={subjectEditor.values.name}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: { ...current.values, name: event.target.value },
                          }
                        : current
                    )
                  }
                  placeholder="Database Systems"
                  maxLength={160}
                  required
                />
              </label>
              <label className="sd-field ad-form__wide">
                <span className="field-label">Department</span>
                <input
                  className="text-input"
                  list="ad-department-options"
                  value={subjectEditor.values.department}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: {
                              ...current.values,
                              department: event.target.value,
                              facultyId: '',
                            },
                          }
                        : current
                    )
                  }
                  placeholder="Computer Science"
                  maxLength={120}
                  required
                />
                <datalist id="ad-department-options">
                  {departments.map((department) => (
                    <option key={department} value={department} />
                  ))}
                </datalist>
              </label>
              <label className="sd-field">
                <span className="field-label">Academic year</span>
                <input
                  className="text-input"
                  value={subjectEditor.values.academicYear}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: {
                              ...current.values,
                              academicYear: event.target.value,
                            },
                          }
                        : current
                    )
                  }
                  placeholder="2026-27"
                  pattern="\d{4}-\d{2}"
                  required
                />
              </label>
              <label className="sd-field">
                <span className="field-label">Batch</span>
                <input
                  className="text-input"
                  value={subjectEditor.values.batch}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: { ...current.values, batch: event.target.value },
                          }
                        : current
                    )
                  }
                  placeholder="2024-2028"
                  pattern="\d{4}-\d{4}"
                  required
                />
              </label>
              <label className="sd-field">
                <span className="field-label">Section</span>
                <input
                  className="text-input"
                  value={subjectEditor.values.section}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: {
                              ...current.values,
                              section: event.target.value.toUpperCase(),
                            },
                          }
                        : current
                    )
                  }
                  maxLength={8}
                  required
                />
              </label>
              <label className="sd-field ad-form__wide">
                <span className="field-label">Faculty owner (optional)</span>
                <select
                  className="sd-select"
                  value={subjectEditor.values.facultyId}
                  onChange={(event) =>
                    setSubjectEditor((current) =>
                      current
                        ? {
                            ...current,
                            values: { ...current.values, facultyId: event.target.value },
                          }
                        : current
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {faculty
                    .filter(
                      (member) => member.department === subjectEditor.values.department
                    )
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} · {member.department}
                      </option>
                    ))}
                </select>
                <span className="ad-field-note">
                  Only active faculty from the subject department can be selected.
                </span>
              </label>
            </div>

            {subjectEditor.error ? (
              <div className="ad-form__error" role="alert">
                {subjectEditor.error}
              </div>
            ) : null}

            <div className="ad-form__actions">
              <button
                type="button"
                className="sd-download"
                onClick={() => setSubjectEditor(null)}
                disabled={subjectEditor.saving}
              >
                Cancel
              </button>
              <button type="submit" className="ad-primary" disabled={subjectEditor.saving}>
                {subjectEditor.saving
                  ? 'Saving…'
                  : subjectEditor.mode === 'create'
                    ? 'Create subject'
                    : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {facultyEditor ? (
        <Modal
          title="Allocate faculty"
          subtitle={`${facultyEditor.subject.code} · ${facultyEditor.subject.name}`}
          onClose={() => setFacultyEditor(null)}
        >
          <form className="ad-form" onSubmit={saveFaculty}>
            <label className="sd-field">
              <span className="field-label">Faculty owner</span>
              <select
                className="sd-select"
                value={facultyEditor.facultyId}
                onChange={(event) =>
                  setFacultyEditor((current) =>
                    current ? { ...current, facultyId: event.target.value } : current
                  )
                }
                required
              >
                <option value="">Select faculty</option>
                {candidateFaculty.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.email}
                  </option>
                ))}
              </select>
            </label>

            {!candidateFaculty.length ? (
              <div className="ad-form__error" role="status">
                No active faculty belong to {facultyEditor.subject.department}. Add or activate a
                faculty account in that department first.
              </div>
            ) : null}

            {facultyEditor.subject.faculty ? (
              <p className="ov-note">
                Currently assigned to {facultyEditor.subject.faculty.name}. Saving will replace the
                faculty owner on this subject and its sessions.
              </p>
            ) : null}

            {facultyEditor.error ? (
              <div className="ad-form__error" role="alert">
                {facultyEditor.error}
              </div>
            ) : null}

            <div className="ad-form__actions">
              <button
                type="button"
                className="sd-download"
                onClick={() => setFacultyEditor(null)}
                disabled={facultyEditor.saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ad-primary"
                disabled={facultyEditor.saving || !facultyEditor.facultyId}
              >
                {facultyEditor.saving ? 'Saving…' : 'Allocate faculty'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {requirementsEditor ? (
        <Modal
          title="Examination requirements"
          subtitle={`${requirementsEditor.subject.code} · ${requirementsEditor.subject.name}`}
          onClose={() => setRequirementsEditor(null)}
          wide
        >
          <form className="ad-form" onSubmit={saveRequirements}>
            <div className="ad-requirements">
              <section>
                <div className="ad-requirements__head">
                  <div>
                    <h3>Syllabus units</h3>
                    <p>Unit structure used to check coverage before paper approval.</p>
                  </div>
                  <button
                    type="button"
                    className="ad-action"
                    onClick={() =>
                      updateRequirements((current) => ({
                        ...current,
                        syllabus: [...current.syllabus, { title: '', topics: '' }],
                      }))
                    }
                  >
                    + Add unit
                  </button>
                </div>

                {requirementsEditor.syllabus.length ? (
                  <div className="ad-requirements__list">
                    {requirementsEditor.syllabus.map((unit, index) => (
                      <div className="ad-requirement-row" key={index}>
                        <div className="ad-requirement-row__head">
                          <span>Unit {index + 1}</span>
                          <button
                            type="button"
                            className="ad-action ad-action--danger"
                            onClick={() =>
                              updateRequirements((current) => ({
                                ...current,
                                syllabus: current.syllabus.filter(
                                  (_, itemIndex) => itemIndex !== index
                                ),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <label className="sd-field">
                          <span className="field-label">Unit title</span>
                          <input
                            className="text-input"
                            value={unit.title}
                            onChange={(event) =>
                              updateRequirements((current) => ({
                                ...current,
                                syllabus: current.syllabus.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, title: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="Relational modelling"
                            maxLength={160}
                            required
                          />
                        </label>
                        <label className="sd-field">
                          <span className="field-label">Topics covered</span>
                          <textarea
                            className="text-input ad-textarea"
                            rows={2}
                            value={unit.topics}
                            onChange={(event) =>
                              updateRequirements((current) => ({
                                ...current,
                                syllabus: current.syllabus.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, topics: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="Normalisation, ER modelling, keys…"
                            maxLength={3000}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ov-empty">No syllabus units saved yet.</p>
                )}
              </section>

              <section>
                <div className="ad-requirements__head">
                  <div>
                    <h3>Marks scheme</h3>
                    <p>Assessment components and maximum marks. Total: {requirementTotal}.</p>
                  </div>
                  <button
                    type="button"
                    className="ad-action"
                    onClick={() =>
                      updateRequirements((current) => ({
                        ...current,
                        components: [...current.components, { name: '', maxMarks: '' }],
                      }))
                    }
                  >
                    + Add component
                  </button>
                </div>

                {requirementsEditor.components.length ? (
                  <div className="ad-requirements__list">
                    {requirementsEditor.components.map((component, index) => (
                      <div className="ad-component-row" key={index}>
                        <label className="sd-field">
                          <span className="field-label">Component</span>
                          <input
                            className="text-input"
                            value={component.name}
                            onChange={(event) =>
                              updateRequirements((current) => ({
                                ...current,
                                components: current.components.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="End-semester examination"
                            maxLength={80}
                            required
                          />
                        </label>
                        <label className="sd-field ad-component-row__marks">
                          <span className="field-label">Max marks</span>
                          <input
                            className="text-input"
                            type="number"
                            min="1"
                            max="1000"
                            value={component.maxMarks}
                            onChange={(event) =>
                              updateRequirements((current) => ({
                                ...current,
                                components: current.components.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, maxMarks: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            required
                          />
                        </label>
                        <button
                          type="button"
                          className="ad-action ad-action--danger ad-component-row__remove"
                          onClick={() =>
                            updateRequirements((current) => ({
                              ...current,
                              components: current.components.filter(
                                (_, itemIndex) => itemIndex !== index
                              ),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ov-empty">No assessment components saved yet.</p>
                )}
              </section>
            </div>

            <label className="sd-field">
              <span className="field-label">Review notes for the Exam Cell</span>
              <textarea
                className="text-input ad-textarea"
                rows={3}
                value={requirementsEditor.notes}
                onChange={(event) =>
                  updateRequirements((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Blueprint rules, compulsory questions, practical requirements…"
                maxLength={1000}
              />
            </label>

            {requirementsEditor.error ? (
              <div className="ad-form__error" role="alert">
                {requirementsEditor.error}
              </div>
            ) : null}

            <div className="ad-form__actions">
              <button
                type="button"
                className="sd-download"
                onClick={() => setRequirementsEditor(null)}
                disabled={requirementsEditor.saving}
              >
                Cancel
              </button>
              <button type="submit" className="ad-primary" disabled={requirementsEditor.saving}>
                {requirementsEditor.saving ? 'Saving…' : 'Save requirements'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
