import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShuConfigDialog } from './ShuConfigDialog';
import * as apiModule from '../services/api';

describe('ShuConfigDialog Component', () => {
  it('renders modal with current configuration', () => {
    const onClose = mock(() => {});
    const onSuccess = mock(() => {});

    render(
      <ShuConfigDialog
        currentConfig={{
          anggotaPct: 40,
          cadanganPct: 25,
          pengurusPct: 20,
          sosialPct: 10,
          pembangunanPct: 5,
          jasaSimpananPct: 50,
          jasaPinjamanPct: 50,
        }}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText('Atur Alokasi SHU (AD/ART)')).toBeTruthy();
    expect(screen.getByText('1. Distribusi SHU Netto')).toBeTruthy();
    expect(screen.getByText('2. Pembagian Porsi Anggota')).toBeTruthy();

    const saveBtn = screen.getByRole('button', { name: 'Simpan & Terapkan' });
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.hasAttribute('disabled')).toBe(false);
  });

  it('submits updated config to api and triggers onSuccess', async () => {
    const onClose = mock(() => {});
    const onSuccess = mock(() => {});
    const putMock = mock(() => Promise.resolve({ success: true }));
    (apiModule.api as any).put = putMock;

    render(
      <ShuConfigDialog
        currentConfig={{
          anggotaPct: 40,
          cadanganPct: 25,
          pengurusPct: 20,
          sosialPct: 10,
          pembangunanPct: 5,
          jasaSimpananPct: 50,
          jasaPinjamanPct: 50,
        }}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const saveBtn = screen.getByRole('button', { name: 'Simpan & Terapkan' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
