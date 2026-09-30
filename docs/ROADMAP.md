# Roadmap

## V1 — Lettore locale ✅
EPUB · PDF · TXT · libreria · lettore · ricerca · segnalibri · note · evidenziazioni · progresso ·
modalità chiara/scura/seppia/notte · offline · statistiche di base · lettura ad alta voce (base)

## V2 — Account e cloud
- Account (Supabase Auth, `services/auth/AuthProvider.ts`)
- Sincronizzazione di posizione, segnalibri, note, evidenziazioni e categorie (`services/sync/SyncProvider.ts`)
- Backup opzionale dei file dei libri (Supabase Storage, cifratura lato client)
- Apertura dei libri da "Apri in…" / condivisione dall'app File di iOS

## V3 — Esperienza di lettura avanzata
- Text-to-Speech avanzato (evidenziazione della frase letta, scelta voce, velocità, timer)
- Statistiche avanzate (obiettivi, grafici, tempo per libro)
- Dizionario e traduzione del testo selezionato
- Formati aggiuntivi: CBZ/CBR (fumetti), FB2, MOBI (senza DRM)
- AZW/AZW3 solo se privi di DRM e quando tecnicamente e legalmente appropriato

## V4 — Assistente AI sul libro
Vedi [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md): riassunti, spiegazioni, domande e risposte con citazioni,
flashcard, quiz, traduzione, ricerca di concetti, mappe concettuali.
