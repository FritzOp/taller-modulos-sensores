// T2. Reduce la foto y la envía a la Edge Function "describir-foto".
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { invocarIA } from '@/services/ai/functions';

export const ANCHO_MAXIMO = 1024;
export const CALIDAD_JPEG = 0.7;

/** 1024 px de ancho y JPEG 0.7: unos 150 KB en lugar de varios MB. */
export async function fotoComoDataUrl(uri: string): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  contexto.resize({ width: ANCHO_MAXIMO, height: null });
  const imagen = await contexto.renderAsync();
  const guardada = await imagen.saveAsync({
    format: SaveFormat.JPEG,
    compress: CALIDAD_JPEG,
    base64: true,
  });
  if (!guardada.base64) throw new Error('No se pudo preparar la foto.');
  return `data:image/jpeg;base64,${guardada.base64}`;
}

/** Devuelve la descripción sugerida. La foto sale del teléfono hacia Google Gemini. */
export async function describirFoto(uri: string): Promise<string> {
  const imagen = await fotoComoDataUrl(uri);
  const { descripcion } = await invocarIA<{ descripcion: string }>('describir-foto', { imagen });
  return descripcion;
}
