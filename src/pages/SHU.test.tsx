import { describe, it, expect, mock, afterEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SHU from './SHU';

// Mock useAuth
mock.module('../hooks/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
  }),
}));

let mockApiData: any = {
  year: '2026',
  pendapatan: 100000000,
  biayaOperasional: 20000000,
  shuNetto: 80000000,
  distribusi: {
    anggota: 40000000,
    cadangan: 24000000,
    pengurus: 16000000,
    sosial: 0,
    pembangunan: 0,
  },
  config: {
    anggotaPct: 50,
    cadanganPct: 30,
    pengurusPct: 20,
    sosialPct: 0, // 0%
    pembangunanPct: 0, // 0%
    jasaSimpananPct: 50,
    jasaPinjamanPct: 50,
  },
  alokasiAnggota: [
    { id: 'mem-1', name: 'Budi Santoso', totalSavings: 10000000, averageSavings: 10000000, savingsShare: 2500000, loansShare: 2500000, shu: 5000000 },
  ],
};

// Mock useApiQuery
mock.module('../hooks/useApiQuery', () => ({
  useApiQuery: () => ({
    data: mockApiData,
    isLoading: false,
    error: null,
    refetch: mock(() => {}),
  }),
}));

describe('SHU Page', () => {
  afterEach(() => {
    cleanup();
  });
  it('hides 0% distribution items in details list', () => {
    render(<SHU />);

    // Active items (> 0%) should be visible
    expect(screen.getByText(/Alokasi Anggota \(50%\)/)).toBeTruthy();
    expect(screen.getByText(/Dana Cadangan \(30%\)/)).toBeTruthy();
    expect(screen.getByText(/Jasa Pengurus & Pengawas \(20%\)/)).toBeTruthy();

    // 0% items should NOT be in the document
    expect(screen.queryByText(/Dana Sosial \(0%\)/)).toBeNull();
    expect(screen.queryByText(/Dana Pembangunan Kerja \(0%\)/)).toBeNull();
  });

  it('renders Jasa Pinjaman column when jasaPinjamanPct > 0', () => {
    mockApiData = {
      ...mockApiData,
      config: {
        ...mockApiData.config,
        jasaSimpananPct: 50,
        jasaPinjamanPct: 50,
      },
    };
    render(<SHU />);

    expect(screen.getByText('Jasa Simpanan')).toBeTruthy();
    expect(screen.getByText('Jasa Pinjaman')).toBeTruthy();
  });

  it('hides Jasa Pinjaman column when jasaPinjamanPct is 0%', () => {
    mockApiData = {
      ...mockApiData,
      config: {
        ...mockApiData.config,
        jasaSimpananPct: 100,
        jasaPinjamanPct: 0,
      },
    };
    render(<SHU />);

    expect(screen.getByText('Jasa Simpanan')).toBeTruthy();
    expect(screen.queryByText('Jasa Pinjaman')).toBeNull();
  });

  it('opens configuration modal when clicking Atur Alokasi AD/ART', () => {
    render(<SHU />);

    const button = screen.getByRole('button', { name: 'Atur Alokasi AD/ART' });
    expect(button).toBeTruthy();
    fireEvent.click(button);

    expect(screen.getByText('Atur Alokasi SHU (AD/ART)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Simpan & Terapkan' })).toBeTruthy();
  });

  it('renders mode switch buttons for realization and projection', () => {
    render(<SHU />);

    const realBtn = screen.getByRole('button', { name: 'Realisasi (YTD)' });
    const projBtn = screen.getByRole('button', { name: 'Proyeksi Akhir Tahun' });
    expect(realBtn).toBeTruthy();
    expect(projBtn).toBeTruthy();

    fireEvent.click(projBtn);
  });
});
