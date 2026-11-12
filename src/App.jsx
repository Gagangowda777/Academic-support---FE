import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminDashboard from './pages/admin/AdminDashboard';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import ExamCellDashboard from './pages/examCell/ExamCellDashboard';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import HodDashboard from './pages/hod/HodDashboard';
import StudentDashboard from './pages/student/StudentDashboard';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function PortalRoute() {
  const { user } = useAuth();

  if (user?.role === 'student') return <StudentDashboard />;
  if (user?.role === 'faculty') return <FacultyDashboard />;
  if (user?.role === 'hod') return <HodDashboard />;
  if (user?.role === 'exam_cell') return <ExamCellDashboard />;
  if (user?.role === 'academic_admin' || user?.role === 'super_admin') {
    return <AdminDashboard />;
  }

  return <DashboardPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/portal"
        element={
          <RequireAuth>
            <PortalRoute />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}
