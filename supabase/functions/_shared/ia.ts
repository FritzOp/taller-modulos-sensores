// Código compartido por las funciones de IA. La API key de Gemini solo existe aquí,
// como secreto de Supabase: nunca viaja a la app.
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import { APICallError, RetryError, type LanguageModel } from 'npm:ai@7';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GEMINI_API_KEY') });
export const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
// Si el modelo principal está saturado (503) o sin cuota (429), se intenta con este
export const MODELO_RESPALDO = Deno.env.get('GEMINI_MODEL_RESPALDO') ?? 'gemini-3.5-flash-lite';
export const MODELOS = [...new Set([MODELO, MODELO_RESPALDO])];
// Sin esto, un modelo saturado puede tardar más de un minuto en responder con error
export const TIEMPO_POR_INTENTO_MS = 25_000;

const limiteConfigurado = Number(Deno.env.get('LIMITE_DIARIO'));
export const LIMITE_DIARIO =
  Number.isInteger(limiteConfigurado) && limiteConfigurado > 0 ? limiteConfigurado : 20;

export type FuncionIA = 'asistente' | 'describir-foto' | 'tarjetas';

export interface ErrorIA {
  error: string;
  mensaje: string;
  limite?: number;
}

export function responder(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/**
 * C5. Revisa y registra el uso de IA de las últimas 24 horas.
 * Se usa el cliente del usuario (RLS), no la secret key: solo puede contar y crear
 * sus propias filas, así la regla la hace cumplir la base de datos y no solo este código.
 * Devuelve una respuesta si hay que cortar aquí, o null si puede seguir.
 */
export async function consumirCuota(
  supabase: SupabaseClient,
  funcion: FuncionIA
): Promise<Response | null> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('uso_ia')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', desde);

  if (error) {
    console.error('uso_ia select', error);
    return responder(
      { error: 'uso_no_disponible', mensaje: 'No se pudo revisar tu límite de uso. Intenta de nuevo.' },
      503
    );
  }

  if ((count ?? 0) >= LIMITE_DIARIO) {
    return responder(
      {
        error: 'limite_diario',
        limite: LIMITE_DIARIO,
        mensaje: `Llegaste al límite de ${LIMITE_DIARIO} usos de IA en 24 horas. Vuelve a intentarlo más tarde.`,
      } satisfies ErrorIA,
      429
    );
  }

  const { error: insertError } = await supabase.from('uso_ia').insert({ funcion });
  if (insertError) {
    console.error('uso_ia insert', insertError);
    return responder(
      { error: 'uso_no_disponible', mensaje: 'No se pudo registrar tu uso de IA. Intenta de nuevo.' },
      503
    );
  }
  return null;
}

function errorReal(error: unknown) {
  // Tras los reintentos automáticos el error real viene dentro de RetryError
  return RetryError.isInstance(error) ? error.lastError : error;
}

function esTiempoAgotado(error: unknown) {
  const nombre = (error as { name?: string } | null)?.name;
  return nombre === 'TimeoutError' || nombre === 'AbortError';
}

/** Saturación o falta de cuota del modelo: vale la pena probar con el de respaldo. */
export function esSaturacion(error: unknown): boolean {
  const real = errorReal(error);
  if (esTiempoAgotado(real)) return true;
  return APICallError.isInstance(real) && [429, 500, 503].includes(real.statusCode ?? 0);
}

/** Traduce un error de Gemini a un mensaje para la persona. Nunca se muestra el error crudo. */
export function errorDeGemini(error: unknown): { status: number; body: ErrorIA } {
  const real = errorReal(error);
  if (APICallError.isInstance(real) && real.statusCode === 429) {
    return {
      status: 429,
      body: {
        error: 'cuota_gemini',
        mensaje: 'Se agotó la cuota gratuita de Gemini. Espera un minuto e intenta de nuevo.',
      },
    };
  }
  if (esSaturacion(real)) {
    return {
      status: 503,
      body: {
        error: 'gemini_saturado',
        mensaje: 'Gemini está saturado en este momento. Intenta de nuevo en un minuto.',
      },
    };
  }
  return {
    status: 502,
    body: { error: 'ia_no_disponible', mensaje: 'La IA no pudo responder. Intenta de nuevo.' },
  };
}

/** Respuestas de una sola vez: si un modelo está saturado, se intenta con el siguiente. */
export async function conRespaldo<T>(llamar: (modelo: LanguageModel) => Promise<T>): Promise<T> {
  let ultimoError: unknown;
  for (const id of MODELOS) {
    try {
      return await llamar(google(id));
    } catch (error) {
      ultimoError = error;
      if (!esSaturacion(error)) throw error;
      console.warn(`Modelo ${id} saturado, se intenta con el siguiente`);
    }
  }
  throw ultimoError;
}

/** Lo mínimo de un resultado de streamText que se usa aquí. */
interface ResultadoStream<PARTE> {
  stream: ReadableStream<PARTE>;
}

/**
 * Streaming con respaldo: se espera el primer evento útil del modelo. Si es un error de
 * saturación o no llega a tiempo, se cancela y se intenta con el siguiente modelo, antes
 * de que la persona vea nada. Desde la primera palabra, ya no se cambia de modelo.
 */
export async function streamConRespaldo<PARTE extends { type: string; error?: unknown }>(
  iniciar: (modelo: LanguageModel, signal: AbortSignal) => ResultadoStream<PARTE>
): Promise<ReadableStream<PARTE>> {
  let ultimo: ReadableStream<PARTE> | null = null;

  for (const [indice, id] of MODELOS.entries()) {
    const control = new AbortController();
    const [vistazo, entrega] = iniciar(google(id), control.signal).stream.tee();
    ultimo = entrega;
    if (indice === MODELOS.length - 1) return entrega; // el último se entrega tal cual

    const lector = vistazo.getReader();
    const temporizador = setTimeout(
      () => control.abort(new DOMException('timeout', 'TimeoutError')),
      TIEMPO_POR_INTENTO_MS
    );
    let saturado = false;
    try {
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        if (value.type === 'error') {
          saturado = esSaturacion(value.error);
          break;
        }
        if (value.type === 'text-delta' || value.type === 'finish') break;
      }
    } catch (error) {
      saturado = esSaturacion(error) || control.signal.aborted;
    } finally {
      clearTimeout(temporizador);
      lector.cancel().catch(() => {});
    }
    // Al abortar, el stream puede cerrarse con un evento 'abort' en vez de lanzar un error
    if (control.signal.aborted) saturado = true;

    if (!saturado) return entrega;
    console.warn(`Modelo ${id} saturado en el chat, se intenta con el siguiente`);
    entrega.cancel().catch(() => {});
  }
  return ultimo!;
}
