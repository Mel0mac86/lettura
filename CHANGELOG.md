# Changelog

Tutte le modifiche rilevanti del progetto sono documentate in questo file.
Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e il progetto usa il [Semantic Versioning](https://semver.org/lang/it/).

## [1.1.0] - 2026-10-01

### Aggiunto
- Versione web installabile su iPhone ("Aggiungi alla schermata Home") pubblicata su GitHub Pages.
- **Voce naturale italiana (Paola, Piper)** nella web app: voce neurale gratuita che gira sul telefono, anche offline,
  scaricata una sola volta dalle Impostazioni; la frase successiva viene preparata mentre ascolti.
- Scelta di voce e velocità della lettura ad alta voce, con prova della voce.
- Numero di pagina sull'intero libro per EPUB/TXT e pagine mancanti alla fine del capitolo.

### Corretto
- La lettura ad alta voce usa la lingua del testo (prima i PDF/TXT venivano letti con la voce inglese).
- Web: database compatibile con tutti i browser e con più finestre aperte.
- Le statistiche contano solo le pagine lette andando avanti.

## [1.0.0] - 2026-09-30

### Aggiunto
- Progetto Expo SDK 57 + React Native 0.86 + TypeScript strict + Expo Router.
- Database SQLite locale (expo-sqlite) con migrazioni versionate (`PRAGMA user_version`).
- Importazione libri EPUB, PDF e TXT: rilevamento formato dai magic bytes, validazione, estrazione metadati
  (titolo, autore, lingua, copertina, pagine/capitoli), rilevamento duplicati (SHA-256), blocco dei libri con DRM.
- Libreria con griglia/lista, ricerca, filtri per stato, preferiti, categorie personalizzate, tag e ordinamento.
- Lettore EPUB/TXT impaginato (colonne CSS in WebView): swipe, tap laterali, indice, ricerca nel libro,
  segnalibri, evidenziazioni a colori, note, temi Chiaro/Seppia/Scuro/Notte, font, dimensione, interlinea,
  margini, larghezza testo, testo giustificato, schermo intero, percentuale di avanzamento.
- Lettore PDF basato su pdf.js incluso nell'app (offline): zoom con pulsanti e pinch, pagina precedente/successiva,
  numero pagina, ricerca, segnalibri, note, copertina generata dalla prima pagina, indicizzazione del testo.
- Salvataggio automatico della posizione e dello stato (Non iniziato / In lettura / Completato).
- Ricerca globale veloce su titoli, autori, testo dei libri, note ed evidenziazioni.
- Dashboard con "Continua a leggere" e statistiche (libri, pagine lette, tempo, giorni consecutivi).
- Lettura ad alta voce (TTS nativo iOS/Android) con Play/Pausa/Stop/±15 s.
- Architettura predisposta per sincronizzazione Supabase (V2) e assistente AI con RAG e citazioni (V4).
- Supporto web (IndexedDB + SQLite WebAssembly).
- 60 test automatici (Jest + sql.js + Testing Library).
