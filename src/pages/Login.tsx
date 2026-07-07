import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

const Login = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      navigate('/portal');
    }
  }, [currentUser, navigate]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // El useEffect redirigirá automáticamente si tiene éxito
    } catch (error) {
      console.error("Error signing in with Google", error);
      alert("Hubo un error al iniciar sesión. Por favor intenta de nuevo.");
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-panel fade-in" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>UCB Admisiones</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Portal de Postulantes</p>
        
        <button className="btn-primary" onClick={handleGoogleLogin} style={{ width: '100%', marginBottom: '1rem' }}>
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

export default Login;
