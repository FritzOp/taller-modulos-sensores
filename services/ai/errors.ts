// C4. Traduce cualquier error de la IA a un mensaje claro y a una acción.
// Funciones puras: no saben de React, de Supabase ni de la red.

export type TipoErrorIA = 'sin_red' | 'sesion' | 'limite' | 'cuota' | 'invalida' | 'servicio';

export interface ErrorIA {
  tipo: TipoErrorIA;
  mensaje: string;
  /** Tiene sentido ofrecer "Reintentar" */
  reintentable: boolean;
}

/** Lo que devuelven las Edge Functions: { error, mensaje } */
interface CuerpoError {
  error?: string;
  mensaje?: string;
  code?: string | number;
  message?: string;
}

const MENSAJES = {
  sin_red: 'Sin conexión. La IA necesita internet; tus fotos y notas siguen guardadas aquí.',
  sesion: 'Tu sesión venció. Vuelve a iniciar sesión para usar la IA.',
  cuota: 'Se agotó la cuota gratuita de Gemini. Espera un minuto e intenta de nuevo.',
  invalida: 'No se pudo procesar la petición.',
  servicio: 'La IA no pudo responder. Intenta de nuevo.',
};

/** Mensajes que la Edge Function manda dentro del stream (onError del servidor). */
const MENSAJE_CUOTA_STREAM = /cuota/i;

function parsearCuerpo(texto: unknown): CuerpoError | null {
  if (texto && typeof texto === 'object') return texto as CuerpoError;
  if (typeof texto !== 'string' || !texto.trim().startsWith('{')) return null;
  try {
    return JSON.parse(texto) as CuerpoError;
  } catch {
    return null;
  }
}

/** Interpreta una respuesta HTTP con error: estado y cuerpo. */
export function errorDesdeRespuesta(status: number | undefined, cuerpo: unknown): ErrorIA {
  const body = parsearCuerpo(cuerpo);

  if (status === 401 || body?.code === 401) {
    return { tipo: 'sesion', mensaje: MENSAJES.sesion, reintentable: false };
  }
  if (body?.error === 'limite_diario') {
    return {
      tipo: 'limite',
      mensaje: body.mensaje ?? 'Llegaste al límite diario de uso de IA.',
      reintentable: false,
    };
  }
  if (status === 429 || body?.error === 'cuota_gemini') {
    return { tipo: 'cuota', mensaje: body?.mensaje ?? MENSAJES.cuota, reintentable: true };
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return { tipo: 'invalida', mensaje: body?.mensaje ?? MENSAJES.invalida, reintentable: false };
  }
  return { tipo: 'servicio', mensaje: body?.mensaje ?? MENSAJES.servicio, reintentable: true };
}

function esErrorDeRed(error: { name?: string; message?: string }) {
  return (
    error.name === 'FunctionsFetchError' ||
    /network request failed|fetch failed|failed to fetch|unable to resolve host|network error/i.test(
      error.message ?? ''
    )
  );
}

/**
 * Interpreta cualquier error: el de useChat (APICallError con statusCode y responseBody),
 * el texto que el servidor manda dentro del stream, un error de red o la falta de sesión.
 */
export function interpretarErrorIA(error: unknown, online = true): ErrorIA {
  if (!online) return { tipo: 'sin_red', mensaje: MENSAJES.sin_red, reintentable: true };
  if (!error || typeof error !== 'object') {
    return { tipo: 'servicio', mensaje: MENSAJES.servicio, reintentable: true };
  }

  const e = error as { name?: string; message?: string; statusCode?: number; responseBody?: string };

  if (e.message?.startsWith('No hay sesión')) {
    return { tipo: 'sesion', mensaje: MENSAJES.sesion, reintentable: false };
  }
  if (esErrorDeRed(e)) return { tipo: 'sin_red', mensaje: MENSAJES.sin_red, reintentable: true };
  if (typeof e.statusCode === 'number') {
    return errorDesdeRespuesta(e.statusCode, e.responseBody ?? e.message);
  }

  // El servidor ya respondió 200 y el error llegó dentro del stream: el texto ya es para la persona
  const cuerpo = parsearCuerpo(e.message);
  if (cuerpo) return errorDesdeRespuesta(undefined, cuerpo);
  if (e.message && MENSAJE_CUOTA_STREAM.test(e.message)) {
    return { tipo: 'cuota', mensaje: e.message, reintentable: true };
  }
  return { tipo: 'servicio', mensaje: e.message || MENSAJES.servicio, reintentable: true };
}
