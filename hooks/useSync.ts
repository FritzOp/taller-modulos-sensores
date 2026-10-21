import { useState, useCallback, useEffect } from 'react';
import { syncManager, type SyncResult } from '@/services/syncManager';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';

export function useSync() {
  const { userId, isGuest } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const checkPending = useCallback(async () => {
    try {
      const pending = await photosRepo.getPendingSyncPhotos(userId);
      const deletions = await photosRepo.getPendingDeletions(userId);
      setPendingCount(pending.length + deletions.length);
    } catch {
      setPendingCount(0);
    }
  }, [userId]);

  useEffect(() => {
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [checkPending]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (isGuest || isSyncing) {
      return {
        success: false,
        uploadedCount: 0,
        deletedCount: 0,
        downloadedCount: 0,
        errors: isGuest ? ['Modo invitado: Inicia sesión para sincronizar'] : ['Sincronización en curso'],
      };
    }

    setIsSyncing(true);
    try {
      const result = await syncManager.runFullSync(userId);
      setLastSyncResult(result);
      await checkPending();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [userId, isGuest, isSyncing, checkPending]);

  const fetchCloudNow = useCallback(async (): Promise<number> => {
    if (isGuest || isSyncing) return 0;
    setIsSyncing(true);
    try {
      const count = await syncManager.fetchCloudPhotos(userId);
      await checkPending();
      return count;
    } finally {
      setIsSyncing(false);
    }
  }, [userId, isGuest, isSyncing, checkPending]);

  // Auto-sync when a logged-in user mounts the screen
  useEffect(() => {
    if (!isGuest) {
      syncNow();
    }
  }, [userId, isGuest]);

  return {
    isSyncing,
    pendingCount,
    lastSyncResult,
    syncNow,
    fetchCloudNow,
    checkPending,
  };
}
