import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileUp, Calendar, FileCheck2, LogOut, GraduationCap, Loader2 } from 'lucide-react';

const API_BASE_URL = 'https://demoa-backend-668678630709.us-central1.run.app/api';

const Portal = () => {
  const { currentUser, logout } = useAuth();
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Register form state
  const [ci, setCi] = useState('');
  const [phone, setPhone] = useState('');
  const [registering, setRegistering] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDiploma, setSelectedDiploma] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    
    setLoading(true);
    const q = query(collection(db, 'estudiantes'), where('uid_firebase', '==', currentUser.uid));
    
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data();
        const id = docSnap.id;
        if (data.estado === 'Pendiente_Titulo' && data.titulo_requerido === false) {
          try {
            await updateDoc(doc(db, 'estudiantes', id), { estado: 'Habilitado_Conocimientos' });
            setStudentData({ id, ...data, estado: 'Habilitado_Conocimientos' });
          } catch (err) {
            console.error("Error auto-correcting student state:", err);
            setStudentData({ id, ...data });
          }
        } else {
          setStudentData({ id, ...data });
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching student:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ci || !phone) return alert("Completa todos los campos");
    
    if (!/^\d{8}$/.test(phone)) {
      return alert("El celular debe tener exactamente 8 dígitos numéricos.");
    }
    if (!/^\d{4,10}(-[0-9a-zA-Z]{1,2})?$/.test(ci)) {
      return alert("Formato de CI inválido (ej. 1234567 o 1234567-1A).");
    }

    setRegistering(true);

    try {
      const docRef = doc(db, 'estudiantes', ci);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        alert("Ese CI ya está registrado en el sistema.");
        setRegistering(false);
        return;
      }

      const newData = {
        nombres: currentUser?.displayName?.split(' ')[0] || '',
        apellidos: currentUser?.displayName?.split(' ').slice(1).join(' ') || '',
        email: currentUser?.email,
        uid_firebase: currentUser?.uid,
        estado: 'Pendiente',
        telefono_celular: phone,
        titulo_requerido: true,
        fecha_registro: new Date().toISOString()
      };
      
      await setDoc(docRef, newData);
      setStudentData({ id: ci, ...newData });
    } catch (error) {
      console.error(error);
      alert("Error al registrar");
    } finally {
      setRegistering(false);
    }
  };

  const handleVerifyDocs = async () => {
    if (!selectedFile || !studentData) return;
    setVerifying(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          
          const storageRef = ref(storage, `documentos_identidad/${studentData.id}_${selectedFile.name}`);
          await uploadBytes(storageRef, selectedFile);
          const url_ci = await getDownloadURL(storageRef);

          await updateDoc(doc(db, 'estudiantes', studentData.id), {
            url_ci: url_ci
          });

          const res = await fetch(`${API_BASE_URL}/verify-docs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ci_estudiante: studentData.id,
              archivo_b64: base64
            })
          });

          if (!res.ok) {
            let errorMsg = "Error en servidor";
            try {
               const errorData = await res.json();
               errorMsg = errorData.detail || errorData.message || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
          }
          const data = await res.json();
          
          let nextState = data.estado_nuevo;
          if (nextState === 'Habilitado_Conocimientos' && studentData.titulo_requerido !== false) {
             nextState = 'Pendiente_Titulo';
             await updateDoc(doc(db, 'estudiantes', studentData.id), { estado: nextState });
          }

          setStudentData((prev: any) => ({ ...prev, estado: nextState, url_ci: url_ci }));
        } catch (innerError: any) {
          console.error(innerError);
          alert(`Error al procesar: ${innerError.message || innerError}. Por favor revisa la consola para más detalles.`);
        } finally {
          setVerifying(false);
        }
      };
    } catch (error) {
      console.error(error);
      alert("Error al verificar documento");
      setVerifying(false);
    }
  };

  const handleVerifyDiploma = async () => {
    if (!selectedDiploma || !studentData) return;
    setVerifying(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedDiploma);
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          
          const storageRef = ref(storage, `titulos_bachiller/${studentData.id}_${selectedDiploma.name}`);
          await uploadBytes(storageRef, selectedDiploma);
          const url_diploma = await getDownloadURL(storageRef);

          await updateDoc(doc(db, 'estudiantes', studentData.id), {
            url_diploma: url_diploma
          });

          const res = await fetch(`${API_BASE_URL}/verify-diploma`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ci_estudiante: studentData.id,
              archivo_b64: base64
            })
          });

          if (!res.ok) {
            let errorMsg = "Error en servidor";
            try {
               const errorData = await res.json();
               errorMsg = errorData.detail || errorData.message || errorMsg;
            } catch (e) {}
            throw new Error(errorMsg);
          }
          const data = await res.json();
          
          setStudentData((prev: any) => ({ ...prev, estado: data.estado_nuevo, url_diploma: url_diploma }));
        } catch (innerError: any) {
          console.error(innerError);
          alert(`Error al procesar: ${innerError.message || innerError}. Por favor revisa la consola para más detalles.`);
        } finally {
          setVerifying(false);
        }
      };
    } catch (error) {
      console.error(error);
      alert("Error al verificar título");
      setVerifying(false);
    }
  };


  if (loading) return <div className="app-container" style={{ textAlign: 'center' }}>Cargando portal...</div>;

  if (!studentData) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-panel fade-in" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Completa tu Registro</h2>
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Cédula de Identidad</label>
              <input type="text" className="input-glass" value={ci} onChange={(e) => setCi(e.target.value)} placeholder="Ej. 1234567 o 1234567-1A" required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Teléfono Celular (8 dígitos)</label>
              <input type="text" className="input-glass" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 77777777" required />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={registering}>
              {registering ? 'Registrando...' : 'Finalizar Registro'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isCIUploaded = studentData.estado !== 'Pendiente' && studentData.estado !== 'Rechazado_Documentos';
  const isDiplomaUploaded = !!studentData.url_diploma && studentData.estado !== 'Rechazado_Titulo';
  const needsDiploma = studentData.titulo_requerido !== false;
  const canScheduleConocimientos = studentData.estado === 'Habilitado_Conocimientos';
  const canScheduleIngles = studentData.estado === 'Habilitado_Ingles';
  const isConocimientosApproved = ['Habilitado_Ingles', 'Programado_Ingles', 'Aprobado', 'Contrato_Generado'].includes(studentData.estado);
  const isInglesApproved = ['Aprobado', 'Contrato_Generado'].includes(studentData.estado);
  
  const getStepStatus = (stepName: string) => {
      switch(stepName) {
          case 'Docs': return isCIUploaded ? '✅ Listo' : '⏳ Pendiente';
          case 'Conocimientos': return isConocimientosApproved ? '✅ Aprobado' : (studentData.estado.includes('Conocimientos') ? '⏳ En proceso' : '🔒 Bloqueado');
          case 'Ingles': return isInglesApproved ? '✅ Aprobado' : (studentData.estado.includes('Ingles') ? '⏳ En proceso' : '🔒 Bloqueado');
          case 'Contrato': return ['Firma_Programada', 'Inscrito_Finalizado'].includes(studentData.estado) ? '✅ Listo' : (studentData.estado === 'Contrato_Generado' ? '⏳ Agendar Firma' : (studentData.estado === 'Aprobado' ? '⏳ Listo para generar' : '🔒 Bloqueado'));
          default: return '';
      }
  };

  return (
    <div className="app-container fade-in" style={{ position: 'relative' }}>
      
      {/* Overlay de Procesamiento */}
      {verifying && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, color: 'white'
        }}>
          <Loader2 size={48} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: 'var(--primary)' }} />
          <h2 style={{ letterSpacing: '2px' }}>Procesando...</h2>
          <p style={{ color: '#aaa', marginTop: '0.5rem' }}>La Inteligencia Artificial está analizando tu documento</p>
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      <div className="header">
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Hola, {studentData.nombres}</h2>
          <span style={{ 
            background: 'rgba(59, 130, 246, 0.2)', 
            color: 'var(--primary)', 
            padding: '4px 12px', 
            borderRadius: '20px', 
            fontSize: '0.85rem',
            fontWeight: '600'
          }}>
            Estado: {studentData.estado.replace('_', ' ')}
          </span>
        </div>
        <button className="btn-primary" onClick={logout} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
          <LogOut size={18} /> Salir
        </button>
      </div>

      {/* Status Tracker */}
      <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>1. Documentos</h4>
            <p style={{ fontWeight: 'bold' }}>{getStepStatus('Docs')}</p>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>2. Ex. Conocimientos</h4>
            <p style={{ fontWeight: 'bold' }}>{getStepStatus('Conocimientos')}</p>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>3. Ex. Inglés</h4>
            <p style={{ fontWeight: 'bold' }}>{getStepStatus('Ingles')}</p>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>4. Contrato Final</h4>
            <p style={{ fontWeight: 'bold' }}>{getStepStatus('Contrato')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* CI Upload Panel */}
        <div className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <FileUp size={22} color="var(--primary)" />
            Cédula de Identidad
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Sube tu CI escaneada en formato PDF (Máx 5MB).
          </p>
          <input 
            type="file" accept=".pdf" 
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
            className="input-glass" style={{ marginBottom: '1rem', padding: '0.5rem' }} 
            disabled={isCIUploaded}
          />
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleVerifyDocs} disabled={!selectedFile || isCIUploaded}>
            Enviar y Validar CI
          </button>
          {isCIUploaded && (
             <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>CI validado correctamente.</p>
          )}
          {studentData.estado === 'Rechazado_Documentos' && (
             <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
               ❌ La IA rechazó el documento. Asegúrate de que sea un CI boliviano, tenga fotografía y se vean ambos lados. Sube el correcto.
             </p>
          )}
        </div>

        {/* Diploma Upload Panel */}
        {needsDiploma && (
          <div className="glass-panel" style={{ opacity: isCIUploaded ? 1 : 0.6 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <GraduationCap size={22} color={isCIUploaded ? "var(--primary)" : "var(--text-muted)"} />
              Título de Bachiller
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Sube tu Título de Bachiller en PDF. La IA verificará el documento.
            </p>
            <input 
              type="file" accept=".pdf" 
              onChange={(e) => setSelectedDiploma(e.target.files?.[0] || null)} 
              className="input-glass" style={{ marginBottom: '1rem', padding: '0.5rem' }} 
              disabled={!isCIUploaded || isDiplomaUploaded}
            />
            <button className="btn-primary" style={{ width: '100%' }} onClick={handleVerifyDiploma} disabled={!selectedDiploma || !isCIUploaded || isDiplomaUploaded}>
              Enviar y Validar Título
            </button>
            {isDiplomaUploaded && (
               <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>Título enviado y validado.</p>
            )}
            {studentData.estado === 'Rechazado_Titulo' && (
               <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                 ❌ La IA no reconoce este documento como un Título de Bachiller válido. Por favor, sube el correcto.
               </p>
            )}
          </div>
        )}

        {/* Exam Conocimientos Panel */}
        <div className="glass-panel" style={{ opacity: canScheduleConocimientos || isConocimientosApproved ? 1 : 0.6 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Calendar size={22} color={(canScheduleConocimientos || isConocimientosApproved) ? 'var(--primary)' : 'var(--text-muted)'} />
            Examen de Conocimientos
          </h3>
          <button className="btn-primary" style={{ width: '100%', background: 'var(--bg-card)' }} disabled={!canScheduleConocimientos} onClick={async () => {
            if (!studentData) return;
            try {
              setVerifying(true);
              const res = await fetch(`${API_BASE_URL}/schedule-exam`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ci_estudiante: studentData.id, tipo_examen: 'Conocimientos' })
              });
              if (!res.ok) throw new Error("Error agendando examen");
              const data = await res.json();
              await updateDoc(doc(db, 'estudiantes', studentData.id), { estado_examen: 'Programado_Conocimientos' });
              setStudentData((prev: any) => ({ ...prev, estado_examen: 'Programado_Conocimientos' }));
              alert(`Examen de Conocimientos agendado. Enlace: ${data.meet_url}`);
            } catch (e: any) {
              alert(e.message);
            } finally {
              setVerifying(false);
            }
          }}>
            {isConocimientosApproved ? 'Aprobado ✅' : (studentData.estado_examen === 'Programado_Conocimientos' ? 'Agendado ⏳' : 'Agendar Fecha')}
          </button>
        </div>

        {/* Exam Inglés Panel */}
        <div className="glass-panel" style={{ opacity: canScheduleIngles || isInglesApproved ? 1 : 0.6 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Calendar size={22} color={(canScheduleIngles || isInglesApproved) ? 'var(--primary)' : 'var(--text-muted)'} />
            Examen de Inglés
          </h3>
          <button className="btn-primary" style={{ width: '100%', background: 'var(--bg-card)' }} disabled={!canScheduleIngles} onClick={async () => {
            if (!studentData) return;
            try {
              setVerifying(true);
              const res = await fetch(`${API_BASE_URL}/schedule-exam`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ci_estudiante: studentData.id, tipo_examen: 'Ingles' })
              });
              if (!res.ok) throw new Error("Error agendando examen");
              const data = await res.json();
              await updateDoc(doc(db, 'estudiantes', studentData.id), { estado_examen: 'Programado_Ingles' });
              setStudentData((prev: any) => ({ ...prev, estado_examen: 'Programado_Ingles' }));
              alert(`Examen de Inglés agendado. Enlace: ${data.meet_url}`);
            } catch (e: any) {
              alert(e.message);
            } finally {
              setVerifying(false);
            }
          }}>
            {isInglesApproved ? 'Aprobado ✅' : (studentData.estado_examen === 'Programado_Ingles' ? 'Agendado ⏳' : 'Agendar Fecha')}
          </button>
        </div>

        {/* Contract Panel */}
        <div className="glass-panel" style={{ opacity: ['Aprobado', 'Contrato_Generado', 'Firma_Programada', 'Inscrito_Finalizado'].includes(studentData.estado) ? 1 : 0.6 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <FileCheck2 size={22} color={['Aprobado', 'Contrato_Generado', 'Firma_Programada', 'Inscrito_Finalizado'].includes(studentData.estado) ? 'var(--success)' : 'var(--text-muted)'} />
            Contrato Final
          </h3>
          
          {studentData.estado === 'Aprobado' && (
              <button className="btn-primary" style={{ width: '100%', background: 'var(--bg-card)' }} disabled={studentData.estado !== 'Aprobado'} onClick={async () => {
                if (!studentData) return;
                try {
                  setVerifying(true);
                  const res = await fetch(`${API_BASE_URL}/generate-contract`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ci_estudiante: studentData.id })
                  });
                  if (!res.ok) throw new Error("Error generando contrato");
                  const data = await res.json();
                  await updateDoc(doc(db, 'estudiantes', studentData.id), { estado: 'Contrato_Generado', url_contrato_final: data.contrato_url });
                  alert("Contrato generado con éxito.");
                } catch (e: any) {
                  alert(e.message);
                } finally {
                  setVerifying(false);
                }
              }}>
                Generar Contrato
              </button>
          )}

          {studentData.estado === 'Contrato_Generado' && (
              <button className="btn-primary" style={{ width: '100%', background: 'var(--bg-card)' }} onClick={async () => {
                try {
                  const fechaFirma = new Date(Date.now() + 86400000).toLocaleDateString(); // Tomorrow
                  await updateDoc(doc(db, 'estudiantes', studentData.id), { 
                    estado: 'Firma_Programada', 
                    fecha_firma: fechaFirma 
                  });
                  alert(`Firma agendada para el ${fechaFirma}`);
                } catch (e: any) {
                  alert("Error agendando firma");
                }
              }}>
                Agendar Firma de Contrato
              </button>
          )}

          {studentData.estado === 'Firma_Programada' && (
             <p style={{ color: 'var(--primary)', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '4px' }}>
                Firma programada para el <strong>{studentData.fecha_firma}</strong>.<br/><br/> ¡Te esperamos en Admisiones!
             </p>
          )}

          {studentData.estado === 'Inscrito_Finalizado' && (
             <div style={{ textAlign: 'center' }}>
               <p style={{ color: 'var(--success)', marginBottom: '1rem', fontWeight: 'bold' }}>🎉 ¡Felicidades! Eres oficialmente un estudiante UCB.</p>
               <button className="btn-primary" style={{ width: '100%' }} onClick={() => window.open(studentData.url_contrato_firmado, '_blank')}>
                 Descargar Contrato Firmado
               </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portal;
