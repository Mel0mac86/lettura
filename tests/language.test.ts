import { guessLanguage, normalizeLanguageTag, resolveSpeechLanguage } from '@/utils/language';

describe('lingua per la lettura ad alta voce', () => {
  it('riconosce la lingua dal testo', () => {
    expect(guessLanguage('Il mercato non è sempre razionale e per questo la gestione del rischio è importante.')).toBe('it-IT');
    expect(guessLanguage('The market is not always rational and that is why risk management is important.')).toBe('en-US');
    expect(guessLanguage('ok')).toBeNull();
  });

  it('usa il testo prima dei metadati, poi i metadati', () => {
    expect(resolveSpeechLanguage('en', 'Questo è il primo capitolo del libro che sto leggendo con la mia famiglia.')).toBe('it-IT');
    expect(resolveSpeechLanguage('it', '1 2 3')).toBe('it-IT');
    expect(normalizeLanguageTag('en')).toBe('en-US');
    expect(normalizeLanguageTag('pt_BR')).toBe('pt-BR');
  });
});
