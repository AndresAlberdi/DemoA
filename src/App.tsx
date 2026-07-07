
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

const Login = () => {
  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel fade-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>UCB Admisiones</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Portal de Postulantes</p>
        
        <button className="btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
          <LogIn size={20} />
          Ingresar con Google
        </button>
        
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            ¿Eres administrador? <a href="/admin/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Inicia sesión aquí</a>
          </p>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {/* Placeholder para futuras rutas */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
