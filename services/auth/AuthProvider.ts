/**
 * Authentication contract, ready for Supabase Auth (V2).
 * V1 uses a local anonymous user: no account is needed to use the app.
 */
export interface AppUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

export interface AuthProvider {
  getCurrentUser(): Promise<AppUser>;
  signInWithEmail(email: string, password: string): Promise<AppUser>;
  signOut(): Promise<void>;
}

export const LOCAL_USER: AppUser = { id: 'local', email: null, isAnonymous: true };

export class LocalAuthProvider implements AuthProvider {
  async getCurrentUser(): Promise<AppUser> {
    return LOCAL_USER;
  }

  async signInWithEmail(): Promise<AppUser> {
    throw new Error('Gli account saranno disponibili nella versione 2 (Supabase Auth).');
  }

  async signOut(): Promise<void> {
    // Nothing to do for the local user.
  }
}
