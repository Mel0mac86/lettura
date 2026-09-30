# Architettura

My Book Reader è un'app **offline-first**: tutti i dati vivono sul dispositivo e il cloud (V2) sarà solo
un livello di sincronizzazione opzionale.

```
┌──────────────────────── UI (Expo Router) ────────────────────────┐
│ app/(tabs)  Home · Libreria · Cerca · Annotazioni · Impostazioni  │
│ app/reader/[id]  →  ReflowReader (EPUB/TXT)  |  PdfReader (PDF)   │
│ app/book/[id] · app/categories                                    │
└───────────────▲──────────────────────────────▲───────────────────┘
                │ hooks (useAsyncData, …)      │ bridge JSON
┌───────────────┴──────────── services ────────┴───────────────────┐
│ books/ (import, formati, repository)   epub/  txt/  pdf/  reader/ │
│ annotations/  search/  categories/  settings/  stats/  tts/       │
│ ai/ (RAG, V4)   sync/ auth/ (V2)                                  │
└───────▲───────────────────────────────▲──────────────────────────┘
        │ SqlDatabase                   │ FileStorage
┌───────┴────────────┐        ┌─────────┴──────────────────────────┐
│ expo-sqlite (SQLite)│        │ expo-file-system (iOS/Android)      │
│ sql.js nei test     │        │ IndexedDB (web) · memoria (test)    │
└────────────────────┘        └────────────────────────────────────┘
```

## Principi

- **Servizi puri e testabili**: le classi in `services/` non importano React né moduli nativi. Le
  dipendenze (database, storage, id, hash) sono iniettate da `services/container.ts`.
- **Adattatori di piattaforma**: `ExpoSqliteDatabase`, `ExpoFileStorage`, `WebFileStorage`,
  `ReaderWebView(.web).tsx` isolano le API specifiche.
- **Percorsi relativi**: nel database si salvano `books/<id>.epub`, `covers/<id>.jpg`, mai URI assoluti
  (su iOS il percorso del container cambia con gli aggiornamenti).

## Importazione

`BookImporter.importBook()`:

1. legge i byte del file scelto;
2. `detectFormat()` riconosce il formato dai *magic bytes* (`%PDF-`, zip + `mimetype`), con estensione e MIME come indizi;
3. `validateBookBytes()` controlla dimensione e integrità;
4. calcola lo SHA-256 per evitare duplicati;
5. il `BookFormatHandler` del formato estrae metadati, copertina e testo;
6. salva file e copertina nello storage privato, crea il record e indicizza il testo;
7. in caso di errore rimuove tutto ciò che ha scritto.

Gli EPUB con DRM (Adobe/Readium LCP/FairPlay, rilevati da `META-INF/encryption.xml` / `sinf.xml`) vengono
rifiutati. L'offuscamento dei font (IDPF/Adobe) non è DRM ed è accettato.

## Lettori

### EPUB / TXT (reflowable)

- `EpubDocument` (JSZip + fast-xml-parser, JS puro) legge OPF, spine, indice (nav EPUB 3 o NCX EPUB 2),
  metadati e copertina; i capitoli vengono sanificati (niente script, stili, handler `on*`) e le immagini
  incorporate come data URI.
- `TxtDocument` divide il testo in capitoli ("Capitolo 1", "Chapter IV", …) o in sezioni da ~30.000 caratteri.
- La pagina `services/reader/reflowHtml.ts` impagina il capitolo con **CSS multi-column** e trasla il contenuto.
- **Le posizioni sono offset di carattere** nel `textContent` del capitolo: segnalibri, evidenziazioni e
  risultati di ricerca restano corretti cambiando font, margini o dimensione dello schermo.

### PDF

- pdf.js 3.x viene incorporato come stringa (`scripts/generate-pdfjs-bundle.js`, eseguito al `postinstall`)
  e gira in un Web Worker creato da Blob: **nessuna richiesta di rete**.
- Pagine renderizzate in modo lazy (solo quelle vicine allo schermo), zoom e pinch-to-zoom.
- Alla prima apertura: numero pagine, metadati, copertina (miniatura pagina 1) e testo per la ricerca globale.

### Bridge RN ↔ WebView

Messaggi JSON tipizzati (`services/reader/bridge.ts`, `services/pdf/pdfViewerHtml.ts`). Su web la
WebView è sostituita da un iframe `srcdoc` con `postMessage`.

## Database

Vedi `database/schema.ts`. Tabelle principali: `books`, `bookmarks`, `highlights`, `notes`,
`categories`, `book_categories`, più `book_tags`, `book_text` (testo per ricerca/RAG),
`reading_sessions` (statistiche) e `settings`.

Le migrazioni sono in `database/migrations/` e vengono applicate all'avvio (`runMigrations`).

## Ricerca

`book_text` contiene il testo di ogni capitolo/pagina e una copia normalizzata (minuscolo, senza accenti)
**della stessa lunghezza**: la corrispondenza avviene con `instr()` in SQLite e la posizione trovata si
riporta sul testo originale per snippet e navigazione. È portabile (funziona anche con sql.js e su web);
FTS5 potrà essere aggiunto dietro la stessa interfaccia `SearchService`.

## Sincronizzazione (V2)

- Chiavi primarie UUID e timestamp ISO su tutte le tabelle → merge "last write wins" per record.
- Contratto `SyncProvider` (`services/sync/SyncProvider.ts`) e `AuthProvider` (`services/auth/`).
- Implementazione prevista: Supabase (Postgres + RLS per utente, Storage per il backup dei file,
  Auth per l'account). Il backup dei file dei libri sarà **opzionale ed esplicito**.

## Text-to-Speech

`TtsController` (indipendente dal motore) divide il testo in frasi, gestisce Play/Pausa/Stop/±15 s e usa
`ExpoSpeechEngine` (voci native iOS/Android). Un motore diverso si aggiunge implementando `TextToSpeechEngine`.
