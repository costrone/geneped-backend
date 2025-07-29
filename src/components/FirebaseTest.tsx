import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const FirebaseTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Verificando...');
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const testFirebase = async () => {
      try {
        // Verificar configuración
        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID
        };

        setConfig(firebaseConfig);

        // Verificar si las variables están definidas
        const missingVars = Object.entries(firebaseConfig)
          .filter(([key, value]) => !value)
          .map(([key]) => key);

        if (missingVars.length > 0) {
          setError(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
          return;
        }

        // Verificar conexión a Firestore
        setStatus('Probando conexión a Firestore...');
        const testCollection = collection(db, 'test');
        await getDocs(testCollection);
        
        setStatus('✅ Firebase configurado correctamente');
        
        // Verificar autenticación
        onAuthStateChanged(auth, (user) => {
          if (user) {
            setStatus(`✅ Usuario autenticado: ${user.email}`);
          } else {
            setStatus('✅ Firebase listo - Usuario no autenticado');
          }
        });

      } catch (err: any) {
        setError(`Error: ${err.message}`);
        console.error('Error en prueba de Firebase:', err);
      }
    };

    testFirebase();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-soft">
      <h2 className="text-2xl font-bold text-primary-700 mb-4">Prueba de Firebase</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-700">Estado:</h3>
          <p className="text-sm">{status}</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <h3 className="font-semibold text-red-700">Error:</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {config && (
          <div>
            <h3 className="font-semibold text-gray-700">Configuración:</h3>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirebaseTest; 