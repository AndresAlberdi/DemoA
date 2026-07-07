import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileUp, Calendar, FileCheck2, LogOut } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

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
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const fetchStudent = async () => {
      if (!currentUser) return;
      
      try {
        // Find student by UID
        const q = query(collection(db, 'estudiantes'), where('uid_firebase', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setStudentData({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
        }
      } catch (error) {
        console.error("Error fetching student:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [currentUser]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ci || !phone) return alert("Completa todos los campos");
    setRegistering(true);

    try {
      // Check if CI already exists
      const docRef = doc(db, 'estudiantes', ci);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        alert("Ese CI ya está registrado en el sistema.");
        setRegistering(false);
        return;
      }

      // Create new student record
      const newData = {
        nombres: currentUser?.displayName?.split(' ')[0] || '',
        apellidos: currentUser?.displayName?.split(' ').slice(1).join(' ') || '',
        email: currentUser?.email,
        uid_firebase: currentUser?.uid,
        estado: 'Pendiente',
        telefono_celular: phone,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert("Por favor, sube solo archivos PDF.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("El archivo no debe pesar más de 5MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleVerifyDocs = async () => {
    if (!selectedFile || !studentData) return;
    setVerifying(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        const base64 = reader.result;
        
        // 1. Subir archivo a Storage
        const storageRef = ref(storage, `documentos_identidad/${studentData.id}_${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        const url_ci = await getDownloadURL(storageRef);

        // 2. Actualizar URL en Firestore
        await updateDoc(doc(db, 'estudiantes', studentData.id), {
          url_ci: url_ci
        });

        // 3. Llamar a la IA para validar
        const res = await fetch(`${API_BASE_URL}/verify-docs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ci_estudiante: studentData.id,
            archivo_b64: base64
          })
        });

        if (!res.ok) throw new Error("Error en servidor");
        const data = await res.json();
        
        alert("Validación completada: " + data.estado_nuevo);
        setStudentData((prev: any) => ({ ...prev, estado: data.estado_nuevo, url_ci: url_ci }));
      };
    } catch (error) {
      console.error(error);
      alert("Error al verificar documento");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="app-container" style={{ textAlign: 'center' }}>Cargando portal...</div>;

  // Render Registration Form if no student data
  if (!studentData) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass-panel fade-in" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Completa tu Registro</h2>
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Cédula de Identidad</label>
              <input type="text" className="input-glass" value={ci} onChange={(e) => setCi(e.target.value)} placeholder="Ej. 1234567" required />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Teléfono Celular</label>
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

  // Render Dashboard
  return (
    <div className="app-container fade-in">
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* Upload Panel */}
        <div className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <FileUp size={22} color="var(--primary)" />
            Subir Documentos
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Sube tu Cédula de Identidad escaneada en formato PDF (Máx 5MB). La Inteligencia Artificial verificará tu documento automáticamente.
          </p>
          
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileChange} 
            className="input-glass" 
            style={{ marginBottom: '1rem', padding: '0.5rem' }} 
            disabled={studentData.estado !== 'Pendiente'}
          />
          
          <button 
            className="btn-primary" 
            style={{ width: '100%' }} 
            onClick={handleVerifyDocs}
            disabled={!selectedFile || verifying || studentData.estado !== 'Pendiente'}
          >
            {verifying ? 'Validando con IA...' : 'Enviar y Validar'}
          </button>
          {studentData.estado !== 'Pendiente' && (
            <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center' }}>Documentos ya enviados.</p>
          )}
        </div>

        {/* Exams Panel */}
        <div className="glass-panel" style={{ opacity: studentData.estado === 'Habilitado_Conocimientos' ? 1 : 0.6 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Calendar size={22} color={studentData.estado === 'Habilitado_Conocimientos' ? 'var(--primary)' : 'var(--text-muted)'} />
            Examen de Admisión
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Una vez aprobados tus documentos, podrás agendar tu examen de conocimientos básico.
          </p>
          <button className="btn-primary" style={{ width: '100%', background: 'var(--bg-card)' }} disabled={studentData.estado !== 'Habilitado_Conocimientos'}>
            Agendar Fecha
          </button>
        </div>

        {/* Contract Panel */}
        <div className="glass-panel" style={{ opacity: studentData.estado === 'Aprobado' ? 1 : 0.6 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <FileCheck2 size={22} color={studentData.estado === 'Aprobado' ? 'var(--success)' : 'var(--text-muted)'} />
            Contrato Final
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Firma digitalmente tu contrato de admisión para culminar el proceso.
          </p>
          <button className="btn-primary" style={{ width: '100%', background: 'var(--bg-card)' }} disabled={studentData.estado !== 'Aprobado'}>
            Generar Contrato
          </button>
        </div>
      </div>
    </div>
  );
};

export default Portal;
