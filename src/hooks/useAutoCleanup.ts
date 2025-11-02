import { useEffect, useRef } from 'react';
import { medicalRecordService } from '../services/firebase';
import { useUser } from '../contexts/UserContext';

export const useAutoCleanup = () => {
  const { user } = useUser();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Función para limpiar registros antiguos
    const cleanupOldRecords = async () => {
      try {
        await medicalRecordService.cleanupOldDeleted(user.uid);
        console.log('🧹 Limpieza automática completada para el usuario:', user.uid);
      } catch (error) {
        const err: any = error;
        console.error('Error en limpieza automática:', err?.code || err?.message || err);
      }
    };

    // Ejecutar limpieza con un pequeño retraso para asegurar auth/claims
    const timeoutId = setTimeout(() => {
      cleanupOldRecords();
    }, 3000);

    // Configurar limpieza automática cada 24 horas
    intervalRef.current = setInterval(cleanupOldRecords, 24 * 60 * 60 * 1000);

    // Limpiar el intervalo cuando el componente se desmonte
    return () => {
      clearTimeout(timeoutId);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user]);

  // Función para ejecutar limpieza manual
  const manualCleanup = async () => {
    if (!user?.uid) {
      throw new Error('Usuario no autenticado');
    }

    try {
      await medicalRecordService.cleanupOldDeleted(user.uid);
      console.log('🧹 Limpieza manual completada para el usuario:', user.uid);
    } catch (error) {
      console.error('Error en limpieza manual:', error);
      throw error;
    }
  };

  return { manualCleanup };
}; 