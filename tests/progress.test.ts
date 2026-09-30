import {
  computePageProgress,
  computeReflowProgress,
  formatPercent,
  statusFromProgress,
} from '@/utils/progress';

describe('percentuale di avanzamento', () => {
  it('pesa i capitoli in base alla lunghezza', () => {
    const lengths = [100, 300, 600];
    expect(computeReflowProgress(lengths, 0, 0)).toBe(0);
    expect(computeReflowProgress(lengths, 1, 0)).toBeCloseTo(0.1);
    expect(computeReflowProgress(lengths, 1, 0.5)).toBeCloseTo(0.25);
    expect(computeReflowProgress(lengths, 2, 1)).toBe(1);
  });

  it('gestisce input fuori intervallo e libri vuoti', () => {
    expect(computeReflowProgress([], 0, 0.5)).toBe(0);
    expect(computeReflowProgress([10, 10], 5, 2)).toBe(1);
    expect(computeReflowProgress([0, 0], 0, 1)).toBe(0.5);
  });

  it('calcola il progresso dei PDF per pagina', () => {
    expect(computePageProgress(1, 4)).toBe(0.25);
    expect(computePageProgress(4, 4)).toBe(1);
    expect(computePageProgress(3, 0)).toBe(0);
  });

  it('formatta la percentuale e deriva lo stato', () => {
    expect(formatPercent(0.7234)).toBe('72%');
    expect(formatPercent(1)).toBe('100%');
    expect(statusFromProgress(0)).toBe('not_started');
    expect(statusFromProgress(0.4)).toBe('reading');
    expect(statusFromProgress(0.999)).toBe('completed');
  });
});
