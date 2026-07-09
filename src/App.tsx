import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Portal from './pages/Portal';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/" />;
  return children;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/admin/login" />;
  
  // En este demo, los admins usan email/password, los estudiantes usan Google
  const isAdmin = currentUser.providerData.some(provider => provider.providerId === 'password');
  
  if (!isAdmin) {
    alert("Acceso denegado. Solo administradores pueden ver esta página.");
    return <Navigate to="/portal" />;
  }
  
  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/portal" element={<ProtectedRoute><Portal /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
