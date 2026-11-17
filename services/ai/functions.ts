// Llamadas de una sola respuesta a las Edge Functions de IA (describir-foto, tarjetas).
// supabase.functions.invoke envía el token de sesión automáticamente.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { errorDesdeRespuesta, interpretarErrorIA, type ErrorIA } from '@/services/ai/errors';

/** Error con el detalle ya traducido, para que la pantalla solo lo muestre. */
export class FalloIA extends Error {
  constructor(public readonly detalle: ErrorIA) {
    super(detalle.mensaje);
    this.name = 'FalloIA';
  }
}

export async function invocarIA<T>(funcion: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(funcion, { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      // Con 4xx o 5xx, el cuerpo de la respuesta trae { error, mensaje }
      const respuesta = error.context as Response;
      const cuerpo = await respuesta.json().catch(() => null);
      throw new FalloIA(errorDesdeRespuesta(respuesta.status, cuerpo));
    }
    throw new FalloIA(interpretarErrorIA(error));
  }
  if (data === null) throw new FalloIA(errorDesdeRespuesta(undefined, null));
  return data;
}
