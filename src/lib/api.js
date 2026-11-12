// The JWT is delivered in an httpOnly cookie and mirrored in memory so API
// calls can also send it as a Bearer token. It is never put in localStorage.
let accessToken = null;
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
  return `${API_ORIGIN}/api${path}`;
}

export function setAccessToken(token) {
  accessToken = token;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(apiUrl(path), {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || 'Request failed. Please try again.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function requestForm(path, formData) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || 'Upload failed. Please try again.');
    error.status = response.status;
    throw error;
  }

  return data;
}

async function requestBlob(path) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(apiUrl(path), {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    const error = new Error(data?.message || 'Preview could not be loaded.');
    error.status = response.status;
    throw error;
  }

  return response.blob();
}

export const api = {
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  studentOverview: () => request('/student/overview'),
  setReviewed: (sessionId, reviewed) =>
    request(`/student/sessions/${sessionId}/review`, { method: 'PATCH', body: { reviewed } }),
  facultyOverview: () => request('/faculty/overview'),
  facultyNotifications: () => request('/faculty/notifications'),
  facultyMarkNotificationsRead: () =>
    request('/faculty/notifications/read', { method: 'PATCH' }),
  facultyClasses: () => request('/faculty/classes'),
  facultySubjectSessions: (subjectId) => request(`/faculty/subjects/${subjectId}/sessions`),
  facultySubjectStudents: (subjectId) => request(`/faculty/subjects/${subjectId}/students`),
  facultySession: (sessionId) => request(`/faculty/sessions/${sessionId}`),
  uploadMaterial: (sessionId, formData) =>
    requestForm(`/faculty/sessions/${sessionId}/material`, formData),
  hodOverview: () => request('/hod/overview'),
  hodFaculty: () => request('/hod/faculty'),
  hodSubjects: () => request('/hod/subjects'),
  hodSubjectSessions: (subjectId) => request(`/hod/subjects/${subjectId}/sessions`),
  hodAttendance: (subjectId) =>
    request(`/hod/attendance${subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''}`),
  hodExaminations: () => request('/hod/examinations'),
  hodCreateExam: (payload) => request('/hod/exams', { method: 'POST', body: payload }),
  hodUpdateExam: (examId, payload) =>
    request(`/hod/exams/${examId}`, { method: 'PATCH', body: payload }),
  hodDeleteExam: (examId) => request(`/hod/exams/${examId}`, { method: 'DELETE' }),
  hodReports: () => request('/hod/reports'),
  hodSendReminder: (sessionId) =>
    request(`/hod/sessions/${sessionId}/reminder`, { method: 'POST' }),
  hodAssignFaculty: (subjectId, facultyId, force = false) =>
    request(`/hod/subjects/${subjectId}/faculty`, {
      method: 'PATCH',
      body: { facultyId, force },
    }),
  examCellOverview: () => request('/exam-cell/overview'),
  examCellExams: (query = '') => request(`/exam-cell/exams${query}`),
  examCellCreateExam: (payload) =>
    request('/exam-cell/exams', { method: 'POST', body: payload }),
  examCellUpdateExam: (examId, payload) =>
    request(`/exam-cell/exams/${examId}`, { method: 'PATCH', body: payload }),
  examCellDeleteExam: (examId) =>
    request(`/exam-cell/exams/${examId}`, { method: 'DELETE' }),
  examCellSubjects: () => request('/exam-cell/subjects'),
  examCellPlan: (subjectId) => request(`/exam-cell/subjects/${subjectId}/plan`),
  examCellSavePlan: (subjectId, payload) =>
    request(`/exam-cell/subjects/${subjectId}/plan`, { method: 'PUT', body: payload }),
  facultyQuestionPapers: () => request('/faculty/question-papers'),
  facultyCreatePaper: (payload) =>
    request('/faculty/question-papers', { method: 'POST', body: payload }),
  facultyCreatePaperDocument: (formData) =>
    requestForm('/faculty/question-papers/upload', formData),
  facultyQuestionBankContext: (examId) =>
    request(`/faculty/question-banks/${examId}/context`),
  facultyUploadPastQuestionPapers: (formData) =>
    requestForm('/faculty/question-banks/past-papers', formData),
  facultyPastPaperPreview: (paperId) =>
    requestBlob(`/faculty/question-banks/past-papers/${paperId}/preview`),
  facultyPastPaperText: (paperId) =>
    request(`/faculty/question-banks/past-papers/${paperId}/text`),
  facultyDeletePastQuestionPaper: (paperId) =>
    request(`/faculty/question-banks/past-papers/${paperId}`, { method: 'DELETE' }),
  facultyGenerateQuestionBank: (payload) =>
    request('/faculty/question-banks/generate', { method: 'POST', body: payload }),
  facultyAnalyzePastPapers: (payload) =>
    request('/faculty/question-banks/past-papers/analyze', { method: 'POST', body: payload }),
  facultyUpdatePaper: (paperId, payload) =>
    request(`/faculty/question-papers/${paperId}`, { method: 'PATCH', body: payload }),
  facultyDeletePaper: (paperId) =>
    request(`/faculty/question-papers/${paperId}`, { method: 'DELETE' }),
  examCellQuestionPapers: () => request('/exam-cell/question-papers'),
  examCellApprovePaper: (paperId, note = '') =>
    request(`/exam-cell/question-papers/${paperId}/approve`, { method: 'POST', body: { note } }),
  examCellRejectPaper: (paperId, note = '') =>
    request(`/exam-cell/question-papers/${paperId}/reject`, { method: 'POST', body: { note } }),
  adminOverview: () => request('/admin/overview'),
  adminUsers: (query = '') => request(`/admin/users${query}`),
  adminAcademics: () => request('/admin/academics'),
  adminCreateSubject: (payload) =>
    request('/admin/subjects', { method: 'POST', body: payload }),
  adminUpdateSubject: (subjectId, payload) =>
    request(`/admin/subjects/${subjectId}`, { method: 'PATCH', body: payload }),
  adminAssignSubjectFaculty: (subjectId, facultyId) =>
    request(`/admin/subjects/${subjectId}/faculty`, {
      method: 'PATCH',
      body: { facultyId },
    }),
  adminSaveSubjectRequirements: (subjectId, payload) =>
    request(`/admin/subjects/${subjectId}/requirements`, { method: 'PUT', body: payload }),
  adminSystem: () => request('/admin/system'),
  adminUpdateIntegration: (key, payload) =>
    request(`/admin/system/integrations/${key}`, { method: 'PUT', body: payload }),
  adminTestIntegration: (key) =>
    request(`/admin/system/integrations/${key}/test`, { method: 'POST' }),
  adminActivity: () => request('/admin/activity'),
  adminSetUserStatus: (userId, isActive) =>
    request(`/admin/users/${userId}/status`, { method: 'PATCH', body: { isActive } }),
  adminSetUserRole: (userId, role) =>
    request(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role } }),
};
