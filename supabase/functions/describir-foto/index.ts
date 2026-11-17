// Edge Function "describir-foto" (T1): una sola respuesta, sin streaming.
// Recibe { imagen: "data:image/jpeg;base64,..." } y responde { descripcion }.
import { withSupabase } from 'npm:@supabase/server@1';
import { generateText, Output } from 'npm:ai@7';
import { z } from 'npm:zod@4';
import {
  conRespaldo,
  consumirCuota,
  errorDeGemini,
  responder,
  TIEMPO_POR_INTENTO_MS,
} from '../_shared/ia.ts';

const PREFIJO = 'data:image/jpeg;base64,';
// La app la reduce a 1024 px y JPEG 0.7 (~150 KB). 400 000 caracteres en base64 son ~300 KB.
const MAXIMO_BASE64 = 400_000;

const respuestaSchema = z.object({
  descripcion: z
    .string()
    .min(1)
    .max(400)
    .describe('Descripción de la foto en español, de una a tres oraciones'),
});

export default {
  fetch: withSupabase({ auth: 'user', errors: { detailed: false } }, async (req, ctx) => {
    if (req.method !== 'POST') return responder({ error: 'metodo', mensaje: 'Usa POST.' }, 405);

    const body = await req.json().catch(() => null);
    const imagen: unknown = body?.imagen;
    if (typeof imagen !== 'string' || !imagen.startsWith(PREFIJO)) {
      return responder({ error: 'peticion_invalida', mensaje: 'La foto debe ser JPEG.' }, 400);
    }
    const base64 = imagen.slice(PREFIJO.length);
    if (base64.length === 0 || base64.length > MAXIMO_BASE64) {
      return responder(
        { error: 'peticion_invalida', mensaje: 'La foto es demasiado grande.' },
        413,
      );
    }

    const bloqueo = await consumirCuota(ctx.supabase, 'describir-foto');
    if (bloqueo) return bloqueo;

    try {
      const { output } = await conRespaldo((model) =>
        generateText({
          model,
          instructions:
            'Describes fotos para el álbum personal de una persona. Responde en español, en una a tres oraciones, ' +
            'con lo que se ve: lugar, objetos, ambiente y luz. No inventes nombres de lugares ni identifiques personas.',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe esta foto.' },
                { type: 'file', data: base64, mediaType: 'image/jpeg' },
              ],
            },
          ],
          output: Output.object({ schema: respuestaSchema }),
          temperature: 0.3,
          maxRetries: 0,
          timeout: TIEMPO_POR_INTENTO_MS,
          maxOutputTokens: 400,
        })
      );
      return responder({ descripcion: output.descripcion.trim() });
    } catch (error) {
      console.error(error);
      const { status, body: errorBody } = errorDeGemini(error);
      return responder(errorBody, status);
    }
  }),
};
