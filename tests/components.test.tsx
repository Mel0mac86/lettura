import { render, screen } from '@testing-library/react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';

describe('componenti UI', () => {
  it('ProgressBar mostra la percentuale ed è accessibile', async () => {
    await render(<ProgressBar progress={0.72} showLabel />);
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 72 });
  });

  it('EmptyState mostra titolo e messaggio', async () => {
    await render(<EmptyState icon="book-outline" title="La tua libreria è vuota" message="Aggiungi un libro" />);
    expect(screen.getByText('La tua libreria è vuota')).toBeTruthy();
    expect(screen.getByText('Aggiungi un libro')).toBeTruthy();
  });
});
