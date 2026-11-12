export const ROLES = [
  { value: 'student', label: 'Student', short: 'Student' },
  { value: 'faculty', label: 'Faculty', short: 'Faculty' },
  { value: 'hod', label: 'HOD / Dept Admin', short: 'HOD / Dept Admin' },
  { value: 'exam_cell', label: 'Examination Cell', short: 'Examination Cell' },
  { value: 'academic_admin', label: 'Academic Admin', short: 'Academic Admin' },
  { value: 'super_admin', label: 'Super Admin', short: 'Super Admin' },
];

export const ROLE_LABELS = ROLES.reduce((acc, role) => {
  acc[role.value] = role.label;
  return acc;
}, {});
