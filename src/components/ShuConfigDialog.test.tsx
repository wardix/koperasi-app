import { describe, it, expect, mock, afterEach, spyOn } from 'bun:test';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ShuConfigDialog } from './ShuConfigDialog';
import * as apiModule from '../services/api';

describe('ShuConfigDialog Component', () => {
  let putSpy: any;

  afterEach(() => {
    cleanup();
    putSpy?.mockRestore?.();
  });

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
    putSpy = spyOn(apiModule.api, 'put').mockResolvedValue({ success: true } as any);

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
      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
