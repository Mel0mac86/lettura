import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { runMigrations } from '@/database/migrate';
import { createServices, type AppServices } from '@/services/container';
import { createDatabase } from '@/services/database/createDatabase';
import { createFileStorage } from '@/services/storage/createFileStorage';
import { toUserMessage } from '@/utils/errors';

const ServicesContext = createContext<AppServices | null>(null);

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function initServices(): Promise<AppServices> {
  const db = await createDatabase();
  await runMigrations(db);
  const storage = await createFileStorage();
  return createServices({ db, storage, newId: () => Crypto.randomUUID(), hash: sha256 });
}

/** Opens the local database, runs migrations and exposes the services to the app. */
export function AppServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<AppServices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    initServices()
      .then((result) => !cancelled && setServices(result))
      .catch((e: unknown) => !cancelled && setError(toUserMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  if (error) return <ErrorState title="Impossibile aprire la libreria" message={error} onRetry={retry} />;
  if (!services) return <LoadingState message="Apertura della libreria…" />;
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <AppServicesProvider>');
  return services;
}
