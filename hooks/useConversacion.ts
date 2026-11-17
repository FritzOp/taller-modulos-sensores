import { useCallback, useEffect, useState } from 'react';
import type { UIMessage } from 'ai';
import { chatRepo } from '@/db/repositories/chat';

interface Estado {
  conversationId: string | null;
  inicial: UIMessage[];
}

/** C1. Abre la última conversación (o crea una) y permite empezar otra. */
export function useConversacion(userId: string) {
  const [estado, setEstado] = useState<Estado>({ conversationId: null, inicial: [] });

  const cargar = useCallback(async () => {
    const conversacion = (await chatRepo.latest(userId)) ?? (await chatRepo.create(userId));
    const inicial = (await chatRepo.messages(conversacion.id)) as UIMessage[];
    setEstado({ conversationId: conversacion.id, inicial });
  }, [userId]);

  useEffect(() => {
    let vigente = true;
    chatRepo
      .latest(userId)
      .then(async (conversacion) => conversacion ?? chatRepo.create(userId))
      .then(async (conversacion) => {
        const inicial = (await chatRepo.messages(conversacion.id)) as UIMessage[];
        if (vigente) setEstado({ conversationId: conversacion.id, inicial });
      });
    return () => {
      vigente = false;
    };
  }, [userId]);

  const nueva = useCallback(async () => {
    const conversacion = await chatRepo.create(userId);
    setEstado({ conversationId: conversacion.id, inicial: [] });
  }, [userId]);

  const guardar = useCallback(
    (messages: UIMessage[]) =>
      estado.conversationId ? chatRepo.save(estado.conversationId, messages) : Promise.resolve(),
    [estado.conversationId]
  );

  return { ...estado, cargando: estado.conversationId === null, nueva, guardar, recargar: cargar };
}
