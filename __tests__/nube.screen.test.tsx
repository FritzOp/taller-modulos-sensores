// Pestaña Nube: pantalla, hook y TanStack Query reales. Solo se reemplaza la petición a Supabase.
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NubeScreen from '@/app/(tabs)/nube';
import { listCloudPage } from '@/services/cloudPhotos';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(() => new Promise(() => {})),
}));
jest.mock('react-native-reanimated', () => require('./helpers/reanimatedMock'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: View };
});
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: View };
});
jest.mock('@/services/cloudPhotos', () => ({ listCloudPage: jest.fn() }));
jest.mock('@/db/repositories/photos', () => ({ photosRepo: { localFilesQuery: jest.fn(() => 'files') } }));

const mockLocalFiles: { current: { id: number; clientId: string; uri: string }[] } = { current: [] };
jest.mock('drizzle-orm/expo-sqlite', () => ({ useLiveQuery: () => ({ data: mockLocalFiles.current }) }));

const mockAuth = { isGuest: false, user: { id: 'usuario' } as { id: string } | null };
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));

const pageMock = listCloudPage as jest.Mock;

function photo(index: number, note: string | null = `nota ${index}`) {
  return {
    client_id: `foto-${index}`,
    storage_path: `u/foto-${index}.jpg`,
    latitude: 11.5,
    longitude: -72.9,
    note,
    favorite: false,
    client_created_at: new Date(Date.UTC(2026, 0, 1, 0, 60 - index)).toISOString(),
    imageUrl: `https://firmada/${index}`,
  };
}

const onePage = (indexes: number[], nextCursor: string | null = null) => ({
  items: indexes.map((index) => photo(index)),
  nextCursor,
});

let client: QueryClient;

async function renderScreen() {
  await render(
    <QueryClientProvider client={client}>
      <NubeScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  pageMock.mockReset();
  mockAuth.isGuest = false;
  mockAuth.user = { id: 'usuario' };
  mockLocalFiles.current = [];
  onlineManager.setOnline(true);
});

afterEach(() => {
  client.clear();
});

describe('Los cuatro estados de UI', () => {
  test('carga: indicador mientras llega la primera página', async () => {
    pageMock.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByTestId('cloud-loading')).toBeTruthy();
  });

  test('error con reintento: el botón vuelve a pedir y muestra los datos', async () => {
    pageMock.mockRejectedValueOnce(new Error('Falló el servidor'));
    pageMock.mockResolvedValueOnce(onePage([1]));
    await renderScreen();

    expect(await screen.findByText('No se pudo cargar la nube')).toBeTruthy();
    expect(screen.getByText('Falló el servidor')).toBeTruthy();

    await fireEvent.press(screen.getByText('Reintentar'));

    expect(await screen.findByText('nota 1')).toBeTruthy();
    expect(pageMock).toHaveBeenCalledTimes(2);
  });

  test('vacío sin búsqueda', async () => {
    pageMock.mockResolvedValue(onePage([]));
    await renderScreen();
    expect(await screen.findByText('Aún no hay fotos en la nube')).toBeTruthy();
  });

  test('vacío con búsqueda: el mensaje es distinto', async () => {
    pageMock.mockResolvedValue(onePage([]));
    await renderScreen();
    await screen.findByText('Aún no hay fotos en la nube');

    await fireEvent.changeText(screen.getByPlaceholderText('Buscar por nota...'), 'nada');

    expect(await screen.findByText('Ninguna foto coincide')).toBeTruthy();
  });

  test('sin conexión y sin datos: pide conectarse en lugar de cargar para siempre', async () => {
    onlineManager.setOnline(false);
    await renderScreen();

    expect(await screen.findByText('Conéctate a internet para cargar tus fotos de la nube.')).toBeTruthy();
    expect(screen.queryByTestId('cloud-loading')).toBeNull();
    expect(pageMock).not.toHaveBeenCalled();
  });

  test('sin conexión con datos guardados: aviso y lista visible; se refresca al volver la red', async () => {
    pageMock.mockResolvedValue(onePage([1]));
    await renderScreen();
    await screen.findByText('nota 1');

    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByText('Sin conexión. Se muestran los datos guardados.')).toBeTruthy();
    expect(screen.getByText('nota 1')).toBeTruthy();

    client.invalidateQueries();
    pageMock.mockResolvedValue(onePage([2]));
    await act(async () => onlineManager.setOnline(true));

    expect(await screen.findByText('nota 2')).toBeTruthy();
    expect(screen.queryByText('Sin conexión. Se muestran los datos guardados.')).toBeNull();
  });
});

describe('Errores con datos en pantalla', () => {
  test('si falla una recarga, la lista no desaparece', async () => {
    pageMock.mockResolvedValueOnce(onePage([1]));
    await renderScreen();
    await screen.findByText('nota 1');

    pageMock.mockRejectedValueOnce(new Error('Falló'));
    await act(async () => {
      await client.refetchQueries();
    });

    expect(await screen.findByText('No se pudo actualizar. Toca para reintentar.')).toBeTruthy();
    expect(screen.getByText('nota 1')).toBeTruthy();
    expect(screen.queryByText('No se pudo cargar la nube')).toBeNull();
  });

  test('si falla la página siguiente, se conserva la lista y se puede reintentar', async () => {
    pageMock.mockResolvedValueOnce(onePage([1], 'cursor-1'));
    await renderScreen();
    await screen.findByText('nota 1');

    pageMock.mockRejectedValueOnce(new Error('Falló'));
    await fireEvent(screen.getByTestId('cloud-list'), 'onEndReached');

    expect(await screen.findByText('No se pudieron cargar más. Toca para reintentar.')).toBeTruthy();
    expect(screen.getByText('nota 1')).toBeTruthy();

    // No reintenta en bucle al seguir tocando el final de la lista
    await fireEvent(screen.getByTestId('cloud-list'), 'onEndReached');
    expect(pageMock).toHaveBeenCalledTimes(2);

    pageMock.mockResolvedValueOnce(onePage([2]));
    await fireEvent.press(screen.getByText('No se pudieron cargar más. Toca para reintentar.'));
    expect(await screen.findByText('nota 2')).toBeTruthy();
  });
});

describe('Infinite scroll', () => {
  test('pide la página siguiente con el cursor y se detiene cuando no hay más', async () => {
    pageMock.mockResolvedValueOnce(onePage([1], 'cursor-1'));
    pageMock.mockResolvedValueOnce(onePage([2]));
    await renderScreen();
    await screen.findByText('nota 1');

    await fireEvent(screen.getByTestId('cloud-list'), 'onEndReached');
    await screen.findByText('nota 2');
    expect(pageMock).toHaveBeenLastCalledWith({ userId: 'usuario', cursor: 'cursor-1', search: '' });
    expect(screen.getByText('nota 1')).toBeTruthy();

    await fireEvent(screen.getByTestId('cloud-list'), 'onEndReached');
    expect(pageMock).toHaveBeenCalledTimes(2);
  });
});

describe('Búsqueda en vivo', () => {
  test('una sola petición al dejar de escribir, sin parpadeo de la lista anterior', async () => {
    pageMock.mockResolvedValue(onePage([1]));
    await renderScreen();
    await screen.findByText('nota 1');
    pageMock.mockClear();

    let answer: (value: unknown) => void = () => {};
    pageMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const input = screen.getByPlaceholderText('Buscar por nota...');
    await fireEvent.changeText(input, 'p');
    await fireEvent.changeText(input, 'pl');
    await fireEvent.changeText(input, 'pla');

    expect(pageMock).not.toHaveBeenCalled();
    await waitFor(() => expect(pageMock).toHaveBeenCalledTimes(1));
    expect(pageMock).toHaveBeenCalledWith({ userId: 'usuario', cursor: null, search: 'pla' });

    // Mientras llega el resultado sigue visible la lista anterior
    expect(screen.getByText('nota 1')).toBeTruthy();
    expect(screen.queryByTestId('cloud-loading')).toBeNull();

    await act(async () => answer(onePage([7])));
    expect(await screen.findByText('nota 7')).toBeTruthy();
  });

  test('sin conexión, una búsqueda nueva avisa que queda en espera', async () => {
    pageMock.mockResolvedValue(onePage([1]));
    await renderScreen();
    await screen.findByText('nota 1');

    await act(async () => onlineManager.setOnline(false));
    await fireEvent.changeText(screen.getByPlaceholderText('Buscar por nota...'), 'playa');

    expect(await screen.findByText('La búsqueda se hará cuando vuelva la conexión.')).toBeTruthy();
    expect(screen.getByText('nota 1')).toBeTruthy();
  });
});

describe('Tarjetas', () => {
  test('sin conexión usa la copia local de la imagen si existe', async () => {
    pageMock.mockResolvedValue(onePage([1, 2]));
    mockLocalFiles.current = [{ id: 9, clientId: 'foto-1', uri: 'file://local/1.jpg' }];
    await renderScreen();
    await screen.findByText('nota 1');

    expect(screen.getByTestId('cloud-image-foto-1').props.source.uri).toBe('file://local/1.jpg');
    expect(screen.getByTestId('cloud-image-foto-2').props.source.uri).toBe('https://firmada/2');
  });

  test('el invitado ve una invitación a iniciar sesión y no hace peticiones', async () => {
    mockAuth.isGuest = true;
    mockAuth.user = null;
    await renderScreen();

    expect(screen.getByText('Iniciar sesión')).toBeTruthy();
    expect(pageMock).not.toHaveBeenCalled();
  });
});

