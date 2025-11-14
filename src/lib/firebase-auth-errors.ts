// Utility to convert Firebase Auth errors into user-friendly messages

type AuthContext = 'signin' | 'signup' | 'google' | 'apple' | 'default';

function extractAuthCode(error: unknown): string | null {
  try {
    const anyErr = error as any;
    if (anyErr && typeof anyErr.code === 'string') {
      return anyErr.code;
    }
    if (anyErr && typeof anyErr.message === 'string') {
      const m: string = anyErr.message;
      const match = m.match(/\((auth\/[^)]+)\)/);
      if (match && match[1]) return match[1];
    }
  } catch {}
  return null;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Your Credentials are invalid. Please try again.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect password. Try again or reset your password.',
  'auth/invalid-email': 'That email looks invalid.',
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/popup-closed-by-user': 'The sign-in popup was closed before completing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and try again.',
  'auth/account-exists-with-different-credential': 'This email is linked to a different sign-in method. Try signing in with Google, or use the original method.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is disabled. Please contact support.'
};

export function getFriendlyAuthError(error: unknown, context: AuthContext = 'default'): string {
  const code = extractAuthCode(error);
  if (code && FRIENDLY_MESSAGES[code]) {
    return FRIENDLY_MESSAGES[code];
  }

  switch (context) {
    case 'signup':
      return "Couldn't create your account. Please check your details and try again.";
    case 'google':
      return "Couldn't sign you in with Google. Please try again.";
    case 'apple':
      return "Couldn't sign you in with Apple. Please try again.";
    case 'signin':
      return "Couldn't sign you in. Please try again.";
    default:
      return 'Something went wrong. Please try again.';
  }
}


