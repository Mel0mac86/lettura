# Assistente AI (V4) — architettura RAG

```
Libro ──► Parsing ──► Chunks ──► Embeddings ──► Vector store ──► AI Assistant
(EPUB/PDF/TXT) (book_text) (chunker.ts) (EmbeddingProvider) (VectorStore) (BookAssistant)
```

Il codice è in `services/ai/` ed è già coperto da test (`tests/aiAssistant.test.ts`) con provider finti.
Nessun contenuto dei libri viene inviato a servizi esterni nella V1.

## Componenti

| File | Ruolo |
| --- | --- |
| `types.ts` | Interfacce: `BookChunk`, `EmbeddingProvider`, `VectorStore`, `LlmProvider`, `Citation` |
| `chunker.ts` | Divide il testo (già estratto in `book_text`) in blocchi sovrapposti, preferendo fine paragrafo/frase, conservando capitolo, pagina e posizione |
| `InMemoryVectorStore.ts` | Vector store locale (coseno) per un libro sul dispositivo |
| `BookAssistant.ts` | Indicizzazione, retrieval e risposta con citazioni |

## Regole anti-allucinazione

1. **Retrieval prima di tutto**: se nessun passaggio supera la soglia di similarità, l'assistente risponde
   "Non ho trovato questa informazione nel libro." **senza chiamare il modello**.
2. **Prompt vincolato** (`GROUNDED_SYSTEM_PROMPT`): il modello può usare solo i passaggi `<fonte n="…">`.
3. **Citazioni obbligatorie**: ogni risposta riporta capitolo, pagina e passaggio di origine
   (`Citation.start/end` permettono di aprire il lettore nel punto esatto).

## Funzioni previste su questa base

- riassunto di capitolo (retrieval per capitolo → prompt di sintesi);
- spiegazione di un paragrafo selezionato (il passaggio è la fonte);
- domande e risposte sul libro (`ask`);
- flashcard e quiz (generati solo dai chunk del capitolo, con citazione);
- traduzione del testo selezionato;
- ricerca di concetti (ricerca semantica sui vettori);
- mappe concettuali (estrazione di concetti e relazioni dai chunk).

## Scelte per la produzione

- **Chiavi API mai nell'app**: le chiamate passano da un backend dell'utente (es. Supabase Edge Function)
  indicato in `EXPO_PUBLIC_AI_BACKEND_URL`.
- **Consenso esplicito** prima di inviare passaggi di un libro a un servizio esterno.
- Vector store persistente: tabella SQLite con vettori serializzati (o `sqlite-vec`) lato dispositivo,
  oppure `pgvector` su Supabase per la sincronizzazione.
