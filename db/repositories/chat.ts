// C1. Conversaciones del asistente en SQLite. Solo viven en este teléfono.
import { and, asc, desc, eq, notInArray } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { chatMessages, conversations } from '@/db/schema';

/** Lo mínimo de un UIMessage que se guarda: id, rol y sus parts. */
export interface StoredMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: unknown[];
}

const TITULO_MAXIMO = 48;

function tituloDe(messages: StoredMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const texto = message.parts
      .map((part) => (part as { type?: string; text?: string }).type === 'text' ? (part as { text: string }).text : '')
      .join(' ')
      .trim();
    if (texto) return texto.length > TITULO_MAXIMO ? `${texto.slice(0, TITULO_MAXIMO - 1)}…` : texto;
  }
  return null;
}

export const chatRepo = {
  async latest(userId: string) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(1)
      .get();
  },

  async create(userId: string) {
    const [conversation] = await db
      .insert(conversations)
      .values({ id: Crypto.randomUUID(), userId })
      .returning();
    return conversation;
  },

  async messages(conversationId: string): Promise<StoredMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(asc(chatMessages.position))
      .all();
    return rows.map((row) => ({ id: row.id, role: row.role, parts: JSON.parse(row.parts) }));
  },

  /**
   * Guarda la conversación completa con upsert por id. Si un mensaje desapareció (por
   * ejemplo, al regenerar la última respuesta), también se borra aquí.
   */
  async save(conversationId: string, messages: StoredMessage[]) {
    for (const [position, message] of messages.entries()) {
      const values = {
        id: message.id,
        conversationId,
        role: message.role,
        parts: JSON.stringify(message.parts),
        position,
      };
      await db
        .insert(chatMessages)
        .values(values)
        .onConflictDoUpdate({
          target: chatMessages.id,
          set: { role: values.role, parts: values.parts, position },
        });
    }

    const ids = messages.map((message) => message.id);
    await db
      .delete(chatMessages)
      .where(
        ids.length > 0
          ? and(eq(chatMessages.conversationId, conversationId), notInArray(chatMessages.id, ids))
          : eq(chatMessages.conversationId, conversationId)
      );

    await db
      .update(conversations)
      .set({ updatedAt: new Date(), title: tituloDe(messages) })
      .where(eq(conversations.id, conversationId));
  },
};
