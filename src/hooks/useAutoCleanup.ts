import { useEffect, useRef } from 'react';
import { medicalRecordService } from '../services/firebase';

export const useAutoCleanup = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Función para limpiar registros antiguos
    const cleanupOldRecords = async () => {
      try {
        const deletedCount = await medicalRecordService.cleanupOldDeleted();
        if (deletedCount > 0) {
          console.log(`🧹 Limpieza automática: ${deletedCount} registros eliminados definitivamente`);
        }
      } catch (error) {
        console.error('Error en limpieza automática:', error);
      }
    };

    // Ejecutar limpieza inmediatamente al cargar
    cleanupOldRecords();

    // Configurar limpieza automática cada 24 horas
    intervalRef.current = setInterval(cleanupOldRecords, 24 * 60 * 60 * 1000);

    // Limpiar el intervalo cuando el componente se desmonte
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Función para ejecutar limpieza manual
  const manualCleanup = async () => {
    try {
      const deletedCount = await medicalRecordService.cleanupOldDeleted();
      return deletedCount;
    } catch (error) {
      console.error('Error en limpieza manual:', error);
      throw error;
    }
  };

  return { manualCleanup };
}; 