// Edge Function "tarjetas" (C3): salida estructurada a partir de la conversación.
// Recibe { messages } del chat y responde { tarjetas: [{ pregunta, respuesta }] } (3 a 5).
import { withSupabase } from 'npm:@supabase/server@1';
import { generateText, Output, type UIMessage } from 'npm:ai@7';
import { z } from 'npm:zod@4';
import {
  conRespaldo,
  consumirCuota,
  errorDeGemini,
  responder,
  TIEMPO_POR_INTENTO_MS,
} from '../_shared/ia.ts';

const tarjetasSchema = z.object({
  tarjetas: z
    .array(
      z.object({
        pregunta: z.string().min(1).max(200),
        respuesta: z.string().min(1).max(400),
      }),
    )
    .min(3)
    .max(5),
});

/** Solo el texto de la conversación: las fotos no hacen falta y gastarían tokens. */
function transcripcion(messages: UIMessage[]): string {
  return messages
    .slice(-30)
    .map((message) => {
      const texto = message.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join(' ')
        .trim();
      if (!texto) return null;
      return `${message.role === 'user' ? 'Persona' : 'Asistente'}: ${texto.slice(0, 1500)}`;
    })
    .filter(Boolean)
    .join('\n');
}

export default {
  fetch: withSupabase({ auth: 'user', errors: { detailed: false } }, async (req, ctx) => {
    if (req.method !== 'POST') return responder({ error: 'metodo', mensaje: 'Usa POST.' }, 405);

    const body = await req.json().catch(() => null);
    const messages: UIMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const texto = transcripcion(messages.filter((m) => m && Array.isArray(m.parts)));
    if (texto.split('\n').length < 2) {
      return responder(
        { error: 'peticion_invalida', mensaje: 'Conversa un poco más antes de crear tarjetas.' },
        400,
      );
    }

    const bloqueo = await consumirCuota(ctx.supabase, 'tarjetas');
    if (bloqueo) return bloqueo;

    try {
      const { output } = await conRespaldo((model) =>
        generateText({
          model,
          instructions:
            'Creas tarjetas de repaso en español a partir de una conversación. Cada tarjeta tiene una pregunta ' +
            'corta y su respuesta, basadas solo en lo que se habló. Entre 3 y 5 tarjetas.',
          prompt: texto,
          output: Output.object({ schema: tarjetasSchema }),
          temperature: 0.3,
          maxRetries: 0,
          timeout: TIEMPO_POR_INTENTO_MS,
          maxOutputTokens: 1200,
        })
      );
      return responder(output);
    } catch (error) {
      console.error(error);
      const { status, body: errorBody } = errorDeGemini(error);
      return responder(errorBody, status);
    }
  }),
};
