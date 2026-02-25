import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CamperDetail from './pages/CamperDetail';
import Manage from './pages/Manage';
import Staff from './pages/Staff';
import Checkin from './pages/Checkin';
import Trends from './pages/Trends';
import Layout from './components/Layout';

function PrivateRoute({ children, roles }) {
  const token = localStorage.getItem('gv_token');
  if (!token) return <Navigate to="/login" replace />;
  if (roles) {
    try {
      const user = JSON.parse(localStorage.getItem('gv_user') || '{}');
      if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
    } catch { return <Navigate to="/login" replace />; }
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="campers/:id" element={<CamperDetail />} />
          <Route path="manage" element={<Manage />} />
          <Route path="staff" element={<Staff />} />
          <Route path="checkin" element={<PrivateRoute roles={['admin', 'nurse']}><Checkin /></PrivateRoute>} />
          <Route path="trends" element={<PrivateRoute roles={['admin', 'nurse']}><Trends /></PrivateRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
