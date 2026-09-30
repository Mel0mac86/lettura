# Contribuire a My Book Reader

Grazie per voler contribuire! Questo documento spiega come lavorare sul progetto.

## Requisiti

- Node.js 20 o superiore, npm 10+
- Un iPhone/Android con **Expo Go** oppure un simulatore (Xcode / Android Studio)

## Primo avvio

```bash
npm install        # installa le dipendenze e genera il bundle offline di pdf.js
npm start          # avvia Metro / Expo
```

## Comandi utili

| Comando | Descrizione |
| --- | --- |
| `npm run lint` | ESLint (config `eslint-config-expo` + regole React Compiler) |
| `npm run typecheck` | TypeScript in modalità strict |
| `npm test` | Test automatici (Jest) |
| `npm run check` | Tutti e tre i controlli: da eseguire prima di ogni commit |
| `npx expo install <pacchetto>` | Aggiunge una dipendenza compatibile con l'SDK Expo |

## Regole del codice

- **TypeScript strict**, niente `any` non necessari.
- La logica di dominio sta in `services/` ed è **indipendente da React e da Expo**: riceve le dipendenze
  (database, storage, generatore di id) dal costruttore, così è testabile in Node.
- Le API native (expo-sqlite, expo-file-system, …) sono isolate in adattatori (`*Database.ts`, `*FileStorage.ts`).
- I componenti UI gestiscono sempre gli stati di **caricamento**, **vuoto** ed **errore**.
- Testi dell'interfaccia in italiano; commenti di codice in inglese.
- Non modificare migrazioni già rilasciate: aggiungine una nuova in `database/migrations/`.
- Ogni nuova funzionalità di servizio deve avere test in `tests/`.

## Aggiungere un formato (es. CBZ)

1. Aggiungi il formato a `BookFormat` (`types/models.ts`) e a `SUPPORTED_FORMATS` (`services/books/formats.ts`).
2. Implementa un `BookFormatHandler` in `services/books/bookFormatHandlers.ts`.
3. Per formati reflowable implementa `ReflowableDocument`; per formati a pagine crea un lettore dedicato.
4. Aggiorna la migrazione (CHECK del campo `format`) con una **nuova** migrazione.

## Sicurezza e contenuti

- Non aggiungere mai libri protetti da copyright al repository: i test generano i file al volo.
- Non implementare nulla che aggiri DRM o protezioni anticopia.
- Non committare file `.env` reali né chiavi API.

## Pull request

1. Crea un branch dal branch principale.
2. Esegui `npm run check`.
3. Descrivi cosa cambia e come l'hai verificato; aggiorna `CHANGELOG.md`.
