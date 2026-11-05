import { authErrorMessage, signUpOutcome } from '@/services/authMessages';

describe('signUpOutcome', () => {
  test('con sesión, la cuenta ya está activa', () => {
    expect(signUpOutcome({ session: {}, user: { identities: [{}] } })).toBe('signed_in');
  });

  test('un usuario sin identidades significa que el correo ya estaba registrado', () => {
    expect(signUpOutcome({ session: null, user: { identities: [] } })).toBe('already_registered');
  });

  test('sin sesión y con identidad, falta confirmar el correo', () => {
    expect(signUpOutcome({ session: null, user: { identities: [{}] } })).toBe('confirm_email');
  });
});

describe('authErrorMessage', () => {
  test('traduce los errores conocidos por su código', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe(
      'El correo o la contraseña no son correctos.'
    );
    expect(authErrorMessage({ message: 'Email not confirmed', code: 'email_not_confirmed' })).toContain('confirma');
  });

  test('un error desconocido conserva su mensaje', () => {
    expect(authErrorMessage({ message: 'Algo raro', code: 'otro' })).toBe('Algo raro');
    expect(authErrorMessage({ message: 'Network request failed' })).toBe('Network request failed');
  });
});
