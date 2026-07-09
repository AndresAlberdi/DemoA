import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (currentUser) {
    const isAdmin = currentUser.providerData.some(p => p.providerId === 'password');
    if (isAdmin) {
      setTimeout(() => navigate('/admin/dashboard'), 0);
    } else {
      setTimeout(() => navigate('/portal'), 0);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin/dashboard');
    } catch (error) {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel fade-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <ShieldCheck size={48} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.8rem' }}>Acceso Administrativo</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Panel de Control UCB</p>
        
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Correo Electrónico</label>
            <input type="email" className="input-glass" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Contraseña</label>
            <input type="password" className="input-glass" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
            Ingresar al Panel
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
