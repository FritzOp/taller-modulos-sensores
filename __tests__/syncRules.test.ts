import { decidePull, isPending, remoteWins } from '@/services/syncRules';

const t = (minute: number) => new Date(Date.UTC(2026, 10, 4, 12, minute));
const iso = (minute: number) => t(minute).toISOString();

describe('remoteWins: gana el último cambio', () => {
  test.each([
    ['la nube es más nueva', t(1), iso(2), true],
    ['lo local es más nuevo', t(2), iso(1), false],
    ['fechas iguales: no gana nadie', t(1), iso(1), false],
    ['sin fecha local: gana la nube', null, iso(1), true],
  ])('%s', (_name, local, remote, expected) => {
    expect(remoteWins(local, remote)).toBe(expected);
  });

  test('compara instantes, no texto: la zona horaria no cambia el resultado', () => {
    expect(remoteWins(new Date('2026-11-04T12:00:00.000Z'), '2026-11-04T07:00:00.000-05:00')).toBe(false);
    expect(remoteWins(new Date('2026-11-04T12:00:00.000Z'), '2026-11-04T07:00:01.000-05:00')).toBe(true);
  });
});

describe('isPending', () => {
  test.each([
    ['nunca sincronizada', null, t(1), true],
    ['editada después de subir', t(1), t(2), true],
    ['misma versión', t(1), t(1), false],
    ['la nube ya tiene una versión posterior', t(2), t(1), false],
  ])('%s', (_name, syncedAt, updatedAt, expected) => {
    expect(isPending({ syncedAt, updatedAt })).toBe(expected);
  });
});

describe('decidePull', () => {
  const live = (minute: number) => ({ updated_at: iso(minute), deleted_at: null });
  const deleted = (minute: number) => ({ updated_at: iso(minute), deleted_at: iso(minute) });
  const local = (minute: number, isDeleted = false) => ({
    updatedAt: t(minute),
    deletedAt: isDeleted ? t(minute) : null,
  });

  test.each([
    ['foto nueva de otro teléfono', undefined, live(1), 'insert'],
    ['borrada en la nube y no existe aquí', undefined, deleted(1), 'ignore'],
    ['la nube es más nueva', local(1), live(2), 'apply'],
    ['el borrado remoto es el último cambio', local(1), deleted(2), 'apply'],
    ['la nube revive una foto borrada aquí', local(1, true), live(2), 'apply'],
    ['lo local es más nuevo', local(2), live(1), 'keep'],
    ['misma versión', local(1), live(1), 'keep'],
    ['borrada en los dos lados', local(2, true), deleted(1), 'keep'],
    ['una edición local le gana a un borrado remoto', local(2), deleted(1), 'revive'],
  ] as const)('%s → %s', (_name, localRow, remote, expected) => {
    expect(decidePull(localRow, remote)).toBe(expected);
  });
});
