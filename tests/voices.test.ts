import { pickVoice, voicesForLanguage, type VoiceInfo } from '@/services/tts/voices';

const voices: VoiceInfo[] = [
  { identifier: 'en1', name: 'Samantha', language: 'en-US', enhanced: false },
  { identifier: 'it1', name: 'Alice', language: 'it-IT', enhanced: false },
  { identifier: 'it2', name: 'Federica (Migliorata)', language: 'it-IT', enhanced: true },
  { identifier: 'it3', name: 'Luca', language: 'it_IT', enhanced: false },
];

describe('scelta della voce', () => {
  it('preferisce la voce migliorata della lingua del libro', () => {
    expect(pickVoice(voices, 'it-IT')?.identifier).toBe('it2');
    expect(pickVoice(voices, 'it')?.identifier).toBe('it2');
    expect(pickVoice(voices, 'en-GB')?.identifier).toBe('en1');
  });

  it('usa la voce scelta solo se parla la lingua del libro', () => {
    expect(pickVoice(voices, 'it-IT', 'it3')?.identifier).toBe('it3');
    expect(pickVoice(voices, 'it-IT', 'en1')?.identifier).toBe('it2');
    expect(pickVoice(voices, 'de-DE')).toBeUndefined();
  });

  it('elenca le voci di una lingua, migliori prima', () => {
    expect(voicesForLanguage(voices, 'it-IT').map((v) => v.identifier)).toEqual(['it2', 'it1', 'it3']);
  });
});
