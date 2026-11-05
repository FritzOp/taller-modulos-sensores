// Traduce las respuestas de Supabase Auth a lo que realmente pasó. Funciones puras.

export type SignUpOutcome = 'signed_in' | 'confirm_email' | 'already_registered';

/**
 * signUp responde sin error aunque el correo ya exista, para no revelar qué correos están
 * registrados. En ese caso entrega un usuario sin identidades, sin sesión y sin cambiar la
 * contraseña. Sin sesión pero con identidades, la cuenta espera que se confirme el correo.
 */
export function signUpOutcome(data: {
  session: unknown | null;
  user: { identities?: unknown[] } | null;
}): SignUpOutcome {
  if (data.session) return 'signed_in';
  if (data.user?.identities?.length === 0) return 'already_registered';
  return 'confirm_email';
}

/** Mensaje en español para los errores más comunes al iniciar sesión o registrarse. */
export function authErrorMessage(error: { message: string; code?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'El correo o la contraseña no son correctos.';
    case 'email_not_confirmed':
      return 'Primero confirma tu cuenta con el enlace que te llegó al correo.';
    case 'weak_password':
      return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
    case 'validation_failed':
    case 'email_address_invalid':
      return 'Revisa que el correo esté bien escrito.';
    case 'over_email_send_rate_limit':
      return 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.';
    default:
      return error.message;
  }
}
