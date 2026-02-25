import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CamperDetail from './pages/CamperDetail';
import Manage from './pages/Manage';
import Staff from './pages/Staff';
import Checkin from './pages/Checkin';
import Trends from './pages/Trends';
import CabinView from './pages/CabinView';
import Flowsheet from './pages/Flowsheet';
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

function DefaultRedirect() {
  try {
    const user = JSON.parse(localStorage.getItem('gv_user') || '{}');
    return <Navigate to={user.role === 'counselor' ? '/cabin' : '/dashboard'} replace />;
  } catch {
    return <Navigate to="/dashboard" replace />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DefaultRedirect />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cabin" element={<CabinView />} />
          <Route path="campers/:id" element={<CamperDetail />} />
          <Route path="manage" element={<PrivateRoute roles={['admin', 'nurse']}><Manage /></PrivateRoute>} />
          <Route path="staff" element={<PrivateRoute roles={['admin']}><Staff /></PrivateRoute>} />
          <Route path="checkin" element={<PrivateRoute roles={['admin', 'nurse']}><Checkin /></PrivateRoute>} />
          <Route path="trends" element={<PrivateRoute roles={['admin', 'nurse']}><Trends /></PrivateRoute>} />
          <Route path="daysheet" element={<PrivateRoute roles={['admin', 'nurse']}><Flowsheet /></PrivateRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
