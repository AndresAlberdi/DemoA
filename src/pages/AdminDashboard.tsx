import { useState, useEffect } from 'react';
import { db, storage } from '../config/firebase';
import { collection, onSnapshot, doc, updateDoc, query, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Users, CheckCircle, XCircle, Download, Search, Trash2, ShieldCheck, GraduationCap, Eye } from 'lucide-react';

const API_BASE_URL = 'https://demoa-backend-668678630709.us-central1.run.app/api';

const AdminDashboard = () => {
  const { logout, currentUser } = useAuth();
  const [estudiantes, setEstudiantes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('estudiantes'); // estudiantes | admins
  const [adminsList, setAdminsList] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'admins') {
      fetch(`${API_BASE_URL}/admin/users/list`)
        .then(res => res.json())
        .then(data => setAdminsList(data.admins || []))
        .catch(console.error);
    }
  }, [activeTab]);
  
  // Admin form state
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [adminCreating, setAdminCreating] = useState(false);

  // Detalle estudiante modal
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

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

  const deleteStudent = async (id: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar completamente al estudiante con CI ${id}? Esta acción no se puede deshacer.`)) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/delete-student/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Error en servidor");
      alert("Estudiante eliminado completamente.");
    } catch (error) {
      console.error(error);
      alert("Error eliminando estudiante");
    }
  };

  const eximirTitulo = async (id: string) => {
    if (!window.confirm("¿Seguro que deseas eximir a este estudiante de presentar su Título de Bachiller?")) return;
    try {
      const student = estudiantes.find(est => est.id === id);
      const updateData: any = { titulo_requerido: false };
      if (student && student.estado === 'Pendiente_Titulo') {
        updateData.estado = 'Habilitado_Conocimientos';
      }
      await updateDoc(doc(db, 'estudiantes', id), updateData);
      alert("Estudiante eximido del título.");
    } catch(err) {
      alert("Error eximiendo título");
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPass || !newAdminName) return alert("Completa los campos");
    setAdminCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail, password: newAdminPass, nombre: newAdminName })
      });
      if (!res.ok) throw new Error("Error en servidor");
      alert("Administrador creado exitosamente.");
      setNewAdminEmail('');
      setNewAdminPass('');
      setNewAdminName('');
    } catch (error) {
      alert("Error creando administrador");
    } finally {
      setAdminCreating(false);
    }
  };

  const filteredEstudiantes = estudiantes.filter(est => 
    est.id.includes(searchTerm) || (est.nombres + ' ' + est.apellidos).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Metrics
  const total = estudiantes.length;
  const pendientes = estudiantes.filter(e => e.estado === 'Pendiente' || e.estado.includes('Rechazado') || e.estado === 'Pendiente_Titulo').length;
  const aprobados = estudiantes.filter(e => e.estado === 'Aprobado' || e.estado === 'Contrato_Generado').length;

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
          <button className="btn-primary" onClick={() => setActiveTab(activeTab === 'estudiantes' ? 'admins' : 'estudiantes')} style={{ background: 'var(--primary)', color: 'white' }}>
            {activeTab === 'estudiantes' ? 'Gestión Admins' : 'Volver a Estudiantes'}
          </button>
          <button className="btn-primary" onClick={logout} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
            <LogOut size={18} /> Salir
          </button>
        </div>
      </div>

      {activeTab === 'estudiantes' ? (
        <>
          {/* Metrics Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Total Registrados</h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{total}</p>
            </div>
            <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>En Proceso</h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{pendientes}</p>
            </div>
            <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Finalizados</h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{aprobados}</p>
            </div>
          </div>

          <div className="glass-panel" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 1rem', borderRadius: '8px', width: '300px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Buscar por CI o Nombre..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
              />
            </div>
            <button className="btn-primary" onClick={() => window.open(`${API_BASE_URL}/export-data`, '_blank')} style={{ background: 'var(--success)', color: 'white' }}>
              <Download size={18} /> Exportar ZIP
            </button>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>CI</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Nombres</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Correo</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Estado</th>
                  <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredEstudiantes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron estudiantes.
                    </td>
                  </tr>
                )}
                {filteredEstudiantes.map((est) => (
                  <tr key={est.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>{est.id}</td>
                    <td style={{ padding: '1rem' }}>{est.nombres} {est.apellidos}</td>
                    <td style={{ padding: '1rem' }}>{est.email || 'No registrado'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: est.estado.includes('Habilitado') || est.estado === 'Aprobado' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: est.estado.includes('Habilitado') || est.estado === 'Aprobado' ? 'var(--success)' : 'var(--primary)',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem'
                      }}>
                        {est.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => setSelectedStudent(est)} title="Ver Detalle" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>
                        <Eye size={20} />
                      </button>
                      {(est.estado === 'Habilitado_Conocimientos' || est.estado === 'Programado_Conocimientos') && (
                        <button onClick={() => updateEstado(est.id, 'Habilitado_Ingles')} title="Aprobar Examen Conocimiento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)' }}>
                          <CheckCircle size={20} />
                        </button>
                      )}
                      {(est.estado === 'Habilitado_Ingles' || est.estado === 'Programado_Ingles') && (
                        <button onClick={() => updateEstado(est.id, 'Aprobado')} title="Aprobar Examen Inglés" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)' }}>
                          <CheckCircle size={20} />
                        </button>
                      )}

                      {(est.titulo_requerido !== false && !est.url_diploma) && (
                        <button onClick={() => eximirTitulo(est.id)} title="Eximir de Título" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F59E0B' }}>
                          <GraduationCap size={20} />
                        </button>
                      )}
                      <button onClick={() => deleteStudent(est.id)} title="Eliminar Registro" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)' }}>
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="glass-panel" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <ShieldCheck size={22} color="var(--primary)" />
            Crear Nuevo Administrador
          </h3>
          <form onSubmit={handleCreateAdmin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nombre Completo</label>
              <input type="text" className="input-glass" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Correo Electrónico</label>
              <input type="email" className="input-glass" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Contraseña</label>
              <input type="password" className="input-glass" value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={adminCreating}>
              {adminCreating ? 'Creando...' : 'Crear Administrador'}
            </button>
          </form>

          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '3rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
            <Users size={22} color="var(--primary)" />
            Administradores Actuales
          </h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {adminsList.map((admin: any) => (
              <li key={admin.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
                <div>
                  <strong>{admin.nombre || 'Sin Nombre'}</strong> <br/>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{admin.email}</span>
                </div>
                <button className="btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={async () => {
                   const newPass = prompt(`Nueva contraseña para ${admin.email}:`);
                   if (newPass) {
                     if (newPass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
                     try {
                       const res = await fetch(`${API_BASE_URL}/admin/users/password`, {
                         method: 'PUT',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ email: admin.email, new_password: newPass })
                       });
                       if (!res.ok) throw new Error("Error al cambiar contraseña");
                       alert("Contraseña actualizada con éxito");
                     } catch (e: any) {
                       alert("Error: " + e.message);
                     }
                   }
                }}>Cambiar Password</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal Detalle Estudiante */}
      {selectedStudent && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel fade-in" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setSelectedStudent(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <XCircle size={24} />
            </button>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Detalle de Postulante</h3>
            <p><strong>CI:</strong> {selectedStudent.id}</p>
            <p><strong>Nombres:</strong> {selectedStudent.nombres} {selectedStudent.apellidos}</p>
            <p><strong>Correo:</strong> {selectedStudent.email || 'No registrado'}</p>
            <p><strong>Celular:</strong> {selectedStudent.telefono_celular}</p>
            <p><strong>Estado Actual:</strong> <span style={{ color: 'var(--primary)' }}>{selectedStudent.estado}</span></p>
            {selectedStudent.fecha_firma && (
               <p><strong>Firma Programada:</strong> <span style={{ color: 'var(--success)' }}>{selectedStudent.fecha_firma}</span></p>
            )}
            <p><strong>Título Requerido:</strong> {selectedStudent.titulo_requerido === false ? 'No (Eximido)' : 'Sí'}</p>
            
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Documentos Subidos</h4>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {selectedStudent.url_ci ? (
                   <li style={{ marginBottom: '0.5rem' }}>✅ <a href={selectedStudent.url_ci} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Cédula de Identidad</a></li>
                ) : <li>⏳ Cédula de Identidad pendiente</li>}
                
                {selectedStudent.titulo_requerido !== false && (
                  selectedStudent.url_diploma ? (
                     <li style={{ marginBottom: '0.5rem' }}>✅ <a href={selectedStudent.url_diploma} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Título de Bachiller</a></li>
                  ) : <li>⏳ Título de Bachiller pendiente</li>
                )}
                
                {selectedStudent.url_contrato_final ? (
                   <li style={{ marginBottom: '0.5rem' }}>✅ <a href={selectedStudent.url_contrato_final} target="_blank" rel="noreferrer" style={{ color: 'var(--success)' }}>Contrato Generado</a></li>
                ) : <li>⏳ Contrato Generado pendiente</li>}

                {selectedStudent.url_contrato_firmado ? (
                   <li style={{ marginBottom: '0.5rem' }}>✅ <a href={selectedStudent.url_contrato_firmado} target="_blank" rel="noreferrer" style={{ color: 'var(--success)' }}>Contrato FIRMADO</a></li>
                ) : <li>⏳ Contrato Firmado pendiente</li>}
              </ul>
            </div>

            {selectedStudent.estado === 'Firma_Programada' && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Completar Inscripción</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sube el contrato físico firmado por el estudiante para finalizar el proceso.</p>
                <input 
                  type="file" accept=".pdf" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      alert("Subiendo contrato...");
                      const storageRef = ref(storage, `contratos_firmados/${selectedStudent.id}_${file.name}`);
                      await uploadBytes(storageRef, file);
                      const url_contrato_firmado = await getDownloadURL(storageRef);

                      await updateDoc(doc(db, 'estudiantes', selectedStudent.id), {
                        url_contrato_firmado: url_contrato_firmado,
                        estado: 'Inscrito_Finalizado'
                      });
                      alert("Contrato subido con éxito. El estudiante está Inscrito Oficialmente.");
                      setSelectedStudent(null);
                    } catch (error) {
                      console.error(error);
                      alert("Error al subir el contrato");
                    }
                  }} 
                  className="input-glass" style={{ marginBottom: '1rem', padding: '0.5rem', width: '100%' }} 
                />
              </div>
            )}

            {(selectedStudent.log_ia || selectedStudent.log_ia_titulo) && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Resultados de Inteligencia Artificial</h4>
                
                {selectedStudent.log_ia && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Validación de CI:</strong>
                    <pre style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedStudent.log_ia, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedStudent.log_ia_titulo && (
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Validación de Título:</strong>
                    <pre style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedStudent.log_ia_titulo, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
