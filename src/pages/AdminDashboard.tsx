import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, doc, updateDoc, query, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Users, CheckCircle, XCircle, RotateCcw, FileText, Download } from 'lucide-react';

const AdminDashboard = () => {
  const { logout, currentUser } = useAuth();
  const [estudiantes, setEstudiantes] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'estudiantes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEstudiantes(data);
    });
    return unsubscribe;
  }, []);

  const updateEstado = async (id: string, nuevoEstado: string) => {
    try {
      await updateDoc(doc(db, 'estudiantes', id), { estado: nuevoEstado });
      await addDoc(collection(db, 'logs_auditoria'), {
        actor: currentUser?.email,
        accion: `Cambio de estado a: ${nuevoEstado}`,
        detalles: `Postulante CI: ${id}`,
        fecha: new Date().toISOString()
      });
    } catch (error) {
      alert("Error actualizando el estado");
    }
  };

  return (
    <div className="app-container fade-in">
      <div className="header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.8rem', marginBottom: '0.5rem' }}>
            <Users size={28} color="var(--primary)" />
            Panel de Administración
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Gestión de Postulantes UCB</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => window.open('http://localhost:8000/api/export-data', '_blank')} style={{ background: 'var(--success)', color: 'white' }}>
            <Download size={18} /> Exportar ZIP
          </button>
          <button className="btn-primary" onClick={logout} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
            <LogOut size={18} /> Salir
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>CI</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Nombres</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Teléfono</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Estado</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay estudiantes registrados.
                </td>
              </tr>
            )}
            {estudiantes.map((est) => (
              <tr key={est.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem' }}>{est.id}</td>
                <td style={{ padding: '1rem' }}>{est.nombres} {est.apellidos}</td>
                <td style={{ padding: '1rem' }}>{est.telefono_celular}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    background: est.estado.includes('Habilitado') || est.estado === 'Aprobado' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: est.estado.includes('Habilitado') || est.estado === 'Aprobado' ? 'var(--success)' : 'var(--primary)',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem'
                  }}>
                    {est.estado.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {est.url_ci && (
                    <a href={est.url_ci} target="_blank" rel="noreferrer" title="Ver Documento" style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                      <FileText size={20} />
                    </a>
                  )}
                  <button onClick={() => updateEstado(est.id, 'Habilitado_Conocimientos')} title="Aprobar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)' }}>
                    <CheckCircle size={20} />
                  </button>
                  <button onClick={() => updateEstado(est.id, 'Rechazado_Documentos')} title="Rechazar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
                    <XCircle size={20} />
                  </button>
                  <button onClick={() => updateEstado(est.id, 'Pendiente')} title="Habilitar Reintento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                    <RotateCcw size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
