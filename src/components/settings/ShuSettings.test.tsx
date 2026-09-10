import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShuSettings } from './ShuSettings';

describe('ShuSettings Component', () => {
  it('renders with default 100% distribution and valid status', () => {
    const onSave = mock(() => {});
    render(
      <ShuSettings
        canUpdate={true}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Alokasi SHU (AD/ART)')).toBeTruthy();
    expect(screen.getByText('1. Distribusi SHU Netto')).toBeTruthy();
    expect(screen.getByText('2. Pembagian Alokasi Anggota')).toBeTruthy();

    // Check save button is enabled
    const saveBtn = screen.getByRole('button', { name: 'Simpan Alokasi SHU' });
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.hasAttribute('disabled')).toBe(false);
  });

  it('disables save button when sum does not equal 100%', () => {
    const onSave = mock(() => {});
    render(
      <ShuSettings
        initialValues={{
          anggotaPct: '50', // 50 + 25 + 20 + 10 + 5 = 110%
          cadanganPct: '25',
          pengurusPct: '20',
          sosialPct: '10',
          pembangunanPct: '5',
        }}
        canUpdate={true}
        onSave={onSave}
      />
    );

    const saveBtn = screen.getByRole('button', { name: 'Simpan Alokasi SHU' });
    expect(saveBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Lebih 10.0%/)).toBeTruthy();
  });

  it('calls onSave with updated values when submitted', () => {
    const onSave = mock(() => {});
    render(
      <ShuSettings
        initialValues={{
          anggotaPct: '45',
          cadanganPct: '20',
          pengurusPct: '20',
          sosialPct: '10',
          pembangunanPct: '5',
          jasaSimpananPct: '60',
          jasaPinjamanPct: '40',
        }}
        canUpdate={true}
        onSave={onSave}
      />
    );

    const saveBtn = screen.getByRole('button', { name: 'Simpan Alokasi SHU' });
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
    const calledWith = onSave.mock.calls[0][0];
    expect(calledWith.anggotaPct).toBe('45');
    expect(calledWith.jasaSimpananPct).toBe('60');
  });
});
