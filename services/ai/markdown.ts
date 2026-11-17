// Gemini responde con un poco de Markdown. Solo se interpreta lo que usa casi siempre
// (negritas y viñetas), sin una librería: el resto se muestra como texto normal.

export interface Fragmento {
  texto: string;
  negrita: boolean;
}

/** Separa las **negritas** del texto. Un ** sin cerrar (mientras llega el stream) se oculta. */
export function fragmentosMarkdown(texto: string): Fragmento[] {
  const limpio = texto
    // Viñetas "* " o "- " al inicio de línea
    .replace(/^(\s*)[*-]\s+/gm, '$1• ')
    // Títulos "## Algo" -> "Algo" en negrita
    .replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  const fragmentos: Fragmento[] = [];
  const partes = limpio.split(/\*\*(.+?)\*\*/gs);
  partes.forEach((parte, indice) => {
    const sinCierre = parte
      // *cursiva* se muestra como texto normal
      .replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '$1')
      .replace(/\*\*/g, '');
    if (sinCierre) fragmentos.push({ texto: sinCierre, negrita: indice % 2 === 1 });
  });
  return fragmentos;
}
