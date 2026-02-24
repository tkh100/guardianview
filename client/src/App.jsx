import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CamperDetail from './pages/CamperDetail';
import Manage from './pages/Manage';
import Layout from './components/Layout';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('gv_token');
  return token ? children : <Navigate to="/login" replace />;
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
