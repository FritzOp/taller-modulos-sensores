// Edge Function "asistente": chat con streaming (C1, C2, C4, C5).
import { withSupabase } from 'npm:@supabase/server@1';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'npm:ai@7';
import { consumirCuota, errorDeGemini, responder, streamConRespaldo } from '../_shared/ia.ts';
import { instruccionesAsistente, perfilSchema } from '../_shared/perfil.ts';

export default {
  // auth: 'user' => sin un token de sesión válido responde 401 y nunca llega a Gemini
  fetch: withSupabase({ auth: 'user', errors: { detailed: false } }, async (req, ctx) => {
    if (req.method !== 'POST') return responder({ error: 'metodo', mensaje: 'Usa POST.' }, 405);

    const body = await req.json().catch(() => null);
    const messages: UIMessage[] | null = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || messages.length === 0) {
      return responder({ error: 'peticion_invalida', mensaje: 'Falta el mensaje.' }, 400);
    }

    let modelMessages;
    try {
      // La API no tiene memoria: se reenvía el historial, solo los últimos 20 para cuidar tokens
      modelMessages = await convertToModelMessages(messages.slice(-20));
    } catch {
      return responder({ error: 'peticion_invalida', mensaje: 'El mensaje no tiene un formato válido.' }, 400);
    }

    const bloqueo = await consumirCuota(ctx.supabase, 'asistente');
    if (bloqueo) return bloqueo;

    const instructions = instruccionesAsistente(perfilSchema.parse(body?.perfil));
    // Si el modelo principal está saturado, se cambia al de respaldo antes de la primera palabra
    const stream = await streamConRespaldo((model, abortSignal) =>
      streamText({
        model,
        instructions,
        messages: modelMessages,
        temperature: 0.5,
        maxRetries: 0,
        maxOutputTokens: 1024,
        abortSignal,
      })
    );

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream,
        // Lo que devuelve onError es lo único que ve la persona
        onError: (error) => {
          console.error(error);
          return errorDeGemini(error).body.mensaje;
        },
      }),
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'none' },
    });
  }),
};
