'use client';

import React, {useState} from 'react';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
} from '@astryxdesign/core/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {useApiQuery} from '../hooks/useApiQuery';
import {useAuth} from '../hooks/useAuth';
import {formatRp} from '../utils/format';
import {DataStateView} from '../components/DataStateView';
import {chartColors, getThemedGridProps, getThemedAxisProps, getThemedTooltipProps} from '../design/chartTheme';
import type {ReportData} from '../shared/types';

type ReportType = 'cooperative_summary' | 'savings_summary' | 'loans_summary' | 'interest_income' | 'ar_summary' | 'savings_member' | 'cashflow_statement';

export default function ReportsTemplate() {
  const { hasPermission } = useAuth();
  const canExportReports = hasPermission('export:reports');
  const [selectedReport, setSelectedReport] = useState<ReportType>('cooperative_summary');
  const currentYear = new Date().getFullYear().toString();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: reportResponse, isLoading: isSummaryLoading, error: summaryError, refetch: fetchSummary } = useApiQuery<ReportData>('/api/reports/summary');
  const { data: monthlyInterestRes, isLoading: isInterestLoading, error: interestError, refetch: fetchInterest } = useApiQuery<Array<{ monthKey: string, monthName: string, interestIncome: number }>>(`/api/reports/monthly-interest?year=${currentYear}`);
  const { data: arRes, isLoading: isArLoading, error: arError, refetch: fetchAr } = useApiQuery<Array<{ memberName: string, principal: number, totalAmount: number, paidAmount: number, remainingAmount: number, status: string }>>('/api/reports/ar');
  const { data: savingsMemberRes, isLoading: isSavingsMemberLoading, error: savingsMemberError, refetch: fetchSavingsMember } = useApiQuery<Array<{ memberName: string, simpananPokok: number, simpananWajib: number, simpananSukarela: number, totalSavings: number }>>('/api/reports/savings-member');
  
  const cashflowPath = `/api/reports/cashflow-statement?startDate=${startDate}&endDate=${endDate}`;
  const { data: cashflowRes, isLoading: isCashflowLoading, error: cashflowError, refetch: fetchCashflow } = useApiQuery<Array<{ category: string, subcategory: string, total: number }>>(cashflowPath);

  let isLoading = false;
  let error: string | null = null;
  let refetch = () => {};

  if (selectedReport === 'interest_income') {
    isLoading = isInterestLoading; error = interestError; refetch = fetchInterest;
  } else if (selectedReport === 'ar_summary') {
    isLoading = isArLoading; error = arError; refetch = fetchAr;
  } else if (selectedReport === 'savings_member') {
    isLoading = isSavingsMemberLoading; error = savingsMemberError; refetch = fetchSavingsMember;
  } else if (selectedReport === 'cashflow_statement') {
    isLoading = isCashflowLoading; error = cashflowError; refetch = fetchCashflow;
  } else {
    isLoading = isSummaryLoading; error = summaryError; refetch = fetchSummary;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let filename = "";
    
    if (selectedReport === 'interest_income') {
      if (!monthlyInterestRes) return;
      filename = `laporan_pendapatan_bunga_${currentYear}.csv`;
      csvContent += "Bulan,Pendapatan Bunga\r\n";
      for (const item of monthlyInterestRes) {
        csvContent += `${item.monthName},${item.interestIncome}\r\n`;
      }
      csvContent += `Total Pendapatan Bunga Tahunan,${monthlyInterestRes.reduce((sum, item) => sum + item.interestIncome, 0)}\r\n`;
    } else {
      if (!reportResponse) return;
      if (selectedReport === 'cooperative_summary') {
        filename = "laporan_ringkasan_koperasi.csv";
        csvContent += "Parameter Keuangan & Operasional,Nilai/Jumlah\r\n";
        csvContent += `Total Anggota Terdaftar,${reportResponse.members.totalMembers}\r\n`;
        csvContent += `Anggota Berstatus Aktif,${reportResponse.members.activeMembers}\r\n`;
        csvContent += `Total Dana Simpanan Anggota,${reportResponse.members.totalSavings}\r\n`;
        csvContent += `Total Pinjaman Tersalurkan (Kredit Aktif),${reportResponse.loans.totalLoansAmount}\r\n`;
        csvContent += `Total Penerimaan Angsuran Pinjaman,${reportResponse.loans.totalPaymentsReceived}\r\n`;
      } else if (selectedReport === 'savings_summary') {
        filename = "laporan_portfolio_simpanan.csv";
        csvContent += "Jenis Simpanan,Total Akumulasi\r\n";
        csvContent += `Simpanan Pokok (Modal Awal),${reportResponse.members.totalPokok}\r\n`;
        csvContent += `Simpanan Wajib (Bulanan),${reportResponse.members.totalWajib}\r\n`;
        csvContent += `Simpanan Sukarela (Tabungan Bebas),${reportResponse.members.totalSukarela}\r\n`;
        csvContent += `Total Seluruh Simpanan,${reportResponse.members.totalSavings}\r\n`;
      } else if (selectedReport === 'loans_summary') {
        filename = "laporan_portfolio_pinjaman.csv";
        csvContent += "Status Portofolio Kredit,Total Nominal\r\n";
        csvContent += `Kredit Lancar Aktif (Disetujui),${reportResponse.loans.activeLoansAmount}\r\n`;
        csvContent += `Kredit Lunas (Telah Diselesaikan),${reportResponse.loans.paidLoansAmount}\r\n`;
        csvContent += `Kredit Bermasalah (Macet / NPL),${reportResponse.loans.badLoansAmount}\r\n`;
        csvContent += `Total Kumulatif Penyaluran Pinjaman,${reportResponse.loans.totalLoansAmount}\r\n`;
      } else if (selectedReport === 'ar_summary' && arRes) {
        filename = "laporan_piutang_pinjaman.csv";
        csvContent += "Nama Anggota,Pokok Pinjaman,Total Tagihan,Telah Dibayar,Sisa Piutang,Status\r\n";
        for (const item of arRes) {
          csvContent += `${item.memberName},${item.principal},${item.totalAmount},${item.paidAmount},${item.remainingAmount},${item.status}\r\n`;
        }
      } else if (selectedReport === 'savings_member' && savingsMemberRes) {
        filename = "laporan_rekap_simpanan_anggota.csv";
        csvContent += "Nama Anggota,Simpanan Pokok,Simpanan Wajib,Simpanan Sukarela,Total Simpanan\r\n";
        for (const item of savingsMemberRes) {
          csvContent += `${item.memberName},${item.simpananPokok},${item.simpananWajib},${item.simpananSukarela},${item.totalSavings}\r\n`;
        }
      } else if (selectedReport === 'cashflow_statement' && cashflowRes) {
        filename = "laporan_arus_kas.csv";
        csvContent += "Kategori,Subkategori,Total\r\n";
        for (const item of cashflowRes) {
          csvContent += `${item.category},${item.subcategory},${item.total}\r\n`;
        }
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider className="no-print">
          <HStack gap={2} vAlign="center" style={{ width: '100%' }}>
            <StackItem size="fill">
              <Heading level={1}>Laporan Koperasi</Heading>
            </StackItem>
            <StackItem>
              {canExportReports && (
              <HStack gap={2}>
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--color-success-500)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  📥 Ekspor CSV
                </button>
                <button
                  onClick={handlePrint}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--color-primary-500)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  🖨️ Cetak Laporan
                </button>
              </HStack>
              )}
            </StackItem>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={3}>
          <style>{`
            @media print {
              /* Hide all components except the printable report card */
              body * {
                visibility: hidden;
              }
              #printable-report-area, #printable-report-area * {
                visibility: visible;
              }
              #printable-report-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <Grid columns={{minWidth: 260, repeat: 'fit'}} gap={4}>
            {/* Sidebar selector card */}
            <StackItem className="no-print" style={{ minWidth: '240px', flex: '0 0 280px' }}>
              <Card style={{ padding: '16px' }}>
                <VStack gap={3}>
                  <Heading level={3}>Pilih Laporan</Heading>
                  <VStack gap={2}>
                    <button
                      onClick={() => setSelectedReport('cooperative_summary')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'cooperative_summary' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'cooperative_summary' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      📊 Laporan Ringkasan Koperasi
                    </button>
                    <button
                      onClick={() => setSelectedReport('savings_summary')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'savings_summary' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'savings_summary' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      💰 Laporan Mutasi & Simpanan
                    </button>
                    <button
                      onClick={() => setSelectedReport('loans_summary')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'loans_summary' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'loans_summary' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      📈 Laporan Portofolio Pinjaman
                    </button>
                    <button
                      onClick={() => setSelectedReport('interest_income')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'interest_income' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'interest_income' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      💵 Laporan Pendapatan Bunga
                    </button>
                    <button
                      onClick={() => setSelectedReport('ar_summary')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'ar_summary' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'ar_summary' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      📋 Daftar Piutang Pinjaman
                    </button>
                    <button
                      onClick={() => setSelectedReport('savings_member')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'savings_member' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'savings_member' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      🗂️ Rekap Simpanan Anggota
                    </button>
                    <button
                      onClick={() => setSelectedReport('cashflow_statement')}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: selectedReport === 'cashflow_statement' ? 'var(--color-primary-500)' : 'transparent',
                        color: selectedReport === 'cashflow_statement' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      🌊 Laporan Arus Kas Periode
                    </button>
                  </VStack>
                  
                  {selectedReport === 'cashflow_statement' && (
                    <VStack gap={2} style={{ marginTop: '20px' }}>
                      <Heading level={4}>Filter Tanggal</Heading>
                      <div>
                        <Text type="supporting">Mulai</Text>
                        <input 
                          type="date" 
                          value={startDate} 
                          onChange={(e) => setStartDate(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} 
                        />
                      </div>
                      <div>
                        <Text type="supporting">Sampai</Text>
                        <input 
                          type="date" 
                          value={endDate} 
                          onChange={(e) => setEndDate(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginTop: '4px' }} 
                        />
                      </div>
                    </VStack>
                  )}
                </VStack>
              </Card>
            </StackItem>

            {/* Preview area card */}
            <StackItem style={{ flex: '1 1 auto' }}>
              <DataStateView isLoading={isLoading} error={error} onRetry={refetch} errorTitle="Gagal Memuat Laporan">
                {(() => {
                  // Only open the printable card when the *selected* report has data.
                  // Other endpoints may resolve earlier (empty arrays are truthy) and must
                  // not render summary sections that read reportResponse.members / .loans.
                  const summaryReady = !!(
                    reportResponse &&
                    reportResponse.members &&
                    reportResponse.loans
                  );
                  const hasSelectedData =
                    (selectedReport === 'cooperative_summary' ||
                      selectedReport === 'savings_summary' ||
                      selectedReport === 'loans_summary')
                      ? summaryReady
                      : selectedReport === 'interest_income'
                        ? Array.isArray(monthlyInterestRes)
                        : selectedReport === 'ar_summary'
                          ? Array.isArray(arRes)
                          : selectedReport === 'savings_member'
                            ? Array.isArray(savingsMemberRes)
                            : selectedReport === 'cashflow_statement'
                              ? Array.isArray(cashflowRes)
                              : false;

                  if (!hasSelectedData) {
                    return (
                      <Text type="supporting" color="secondary">
                        {isLoading ? 'Memuat data laporan…' : 'Belum ada data untuk laporan ini.'}
                      </Text>
                    );
                  }

                  return (
                  <Card id="printable-report-area" style={{ padding: '40px', backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <VStack gap={5}>
                      {/* Document Header */}
                      <div style={{ borderBottom: '3px double #000', paddingBottom: '20px', textAlign: 'center' }}>
                        <Heading level={2} style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-text-primary)' }}>Koperasi Simpan Pinjam Koperasi-App</Heading>
                        <Text type="supporting" color="secondary" style={{ marginTop: '4px' }}>
                          Jl. Raya Koperasi No. 123, Jakarta, Indonesia | Telp: (021) 555-0199
                        </Text>
                      </div>

                      {/* Report Title */}
                      <div style={{ textAlign: 'center' }}>
                        <Heading level={3} style={{ textDecoration: 'underline', textTransform: 'uppercase', margin: 0 }}>
                          {selectedReport === 'cooperative_summary' && 'LAPORAN RINGKASAN PERKEMBANGAN KOPERASI'}
                          {selectedReport === 'savings_summary' && 'LAPORAN PORTFOLIO SIMPANAN ANGGOTA'}
                          {selectedReport === 'loans_summary' && 'LAPORAN KINERJA DAN PORTOFOLIO PINJAMAN'}
                          {selectedReport === 'interest_income' && 'LAPORAN REKAPITULASI PENDAPATAN BUNGA BULANAN'}
                          {selectedReport === 'ar_summary' && 'DAFTAR PIUTANG PINJAMAN ANGGOTA'}
                          {selectedReport === 'savings_member' && 'REKAPITULASI SIMPANAN PER ANGGOTA'}
                          {selectedReport === 'cashflow_statement' && 'LAPORAN ARUS KAS PERIODE'}
                        </Heading>
                        <Text type="supporting" color="secondary" style={{ marginTop: '4px' }}>
                          Per Tanggal: {formattedDate} {selectedReport === 'cashflow_statement' && (startDate || endDate) && ` (Filter: ${startDate || 'Awal'} s.d ${endDate || 'Sekarang'})`}
                        </Text>
                      </div>

                      {/* Report Content — each section requires its own payload */}
                      {selectedReport === 'cooperative_summary' && summaryReady && reportResponse && (
                        <VStack gap={4}>
                          <Text type="body">
                            Laporan ini menyajikan rangkuman perkembangan koperasi secara umum yang mencakup data keanggotaan, akumulasi simpanan, serta total portofolio penyaluran pinjaman.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Parameter Keuangan & Operasional</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Nilai/Jumlah</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Total Anggota Terdaftar</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{reportResponse.members?.totalMembers ?? 0} Orang</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Anggota Berstatus Aktif</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{reportResponse.members?.activeMembers ?? 0} Orang</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Total Dana Simpanan Anggota</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-success-500)' }}>{formatRp(reportResponse.members?.totalSavings)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Total Pinjaman Tersalurkan (Kredit Aktif)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-primary-500)' }}>{formatRp(reportResponse.loans?.totalLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: '12px 8px' }}>Total Penerimaan Angsuran Pinjaman</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-success-500)' }}>{formatRp(reportResponse.loans?.totalPaymentsReceived)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'savings_summary' && summaryReady && reportResponse && (
                        <VStack gap={4}>
                          <Text type="body">
                            Rincian portfolio dana simpanan yang dihimpun dari seluruh anggota koperasi yang terbagi berdasarkan jenis simpanan pokok, wajib, dan sukarela.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Jenis Simpanan</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Akumulasi</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Simpanan Pokok (Modal Awal)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(reportResponse.members?.totalPokok)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Simpanan Wajib (Bulanan)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(reportResponse.members?.totalWajib)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Simpanan Sukarela (Tabungan Bebas)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(reportResponse.members?.totalSukarela)}</td>
                              </tr>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-background-secondary)' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 600 }}>Total Seluruh Simpanan</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--color-success-500)' }}>{formatRp(reportResponse.members?.totalSavings)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'loans_summary' && summaryReady && reportResponse && (
                        <VStack gap={4}>
                          <Text type="body">
                            Rincian portofolio kredit dan pinjaman yang telah disalurkan kepada anggota beserta status pengembalian dan kualitas aset kredit.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status Portofolio Kredit</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Nominal</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Kredit Lancar Aktif (Disetujui)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-primary-500)' }}>{formatRp(reportResponse.loans?.activeLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Kredit Lunas (Telah Diselesaikan)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-success-500)' }}>{formatRp(reportResponse.loans?.paidLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                <td style={{ padding: '12px 8px' }}>Kredit Bermasalah (Macet / NPL)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-critical-500)' }}>{formatRp(reportResponse.loans?.badLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-background-secondary)' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 600 }}>Total Kumulatif Penyaluran Pinjaman</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{formatRp(reportResponse.loans?.totalLoansAmount)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'interest_income' && monthlyInterestRes && (
                        <VStack gap={4}>
                          <Text type="body">
                            Laporan realisasi pendapatan bunga pinjaman koperasi per bulan untuk tahun buku {currentYear}.
                          </Text>

                          <div className="no-print" style={{ height: '300px', width: '100%', marginTop: '20px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={monthlyInterestRes}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid {...getThemedGridProps()} />
                                <XAxis dataKey="monthName" {...getThemedAxisProps()} />
                                <YAxis tickFormatter={(tick) => `Rp ${(tick / 1000).toLocaleString('id-ID')}k`} {...getThemedAxisProps()} />
                                <RechartsTooltip formatter={(value: any) => formatRp(value)} {...getThemedTooltipProps()} />
                                <Bar dataKey="interestIncome" fill={chartColors.success} radius={[4, 4, 0, 0]} name="Pendapatan Bunga" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Bulan</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Pendapatan Bunga</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyInterestRes.map((item) => (
                                <tr key={item.monthKey} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                  <td style={{ padding: '12px 8px' }}>{item.monthName}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: 'var(--color-success-500)' }}>
                                    {formatRp(item.interestIncome)}
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-background-secondary)', fontWeight: 600 }}>
                                <td style={{ padding: '12px 8px' }}>Total Pendapatan Bunga Tahunan</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--color-success-500)' }}>
                                  {formatRp(monthlyInterestRes.reduce((sum, item) => sum + item.interestIncome, 0))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'ar_summary' && arRes && (
                        <VStack gap={4}>
                          <Text type="body">
                            Rincian tagihan pinjaman per anggota yang masih memiliki sisa piutang aktif atau macet.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nama Anggota</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Pokok Pinjaman</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Tagihan</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Telah Dibayar</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Sisa Piutang</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {arRes.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                  <td style={{ padding: '12px 8px' }}>{item.memberName}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.principal)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.totalAmount)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--color-success-500)' }}>{formatRp(item.paidAmount)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(item.remainingAmount)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                    <span style={{ 
                                      padding: '4px 8px', 
                                      borderRadius: '4px', 
                                      fontSize: '0.85em',
                                      backgroundColor: item.status === 'Macet' ? '#fee2e2' : '#dcfce7',
                                      color: item.status === 'Macet' ? '#dc2626' : '#166534'
                                    }}>
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {arRes.length === 0 && (
                                <tr>
                                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Tidak ada piutang.</td>
                                </tr>
                              )}
                              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-background-secondary)', fontWeight: 600 }}>
                                <td colSpan={4} style={{ padding: '12px 8px' }}>Total Sisa Piutang Koperasi</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                  {formatRp(arRes.reduce((sum, item) => sum + item.remainingAmount, 0))}
                                </td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'savings_member' && savingsMemberRes && (
                        <VStack gap={4}>
                          <Text type="body">
                            Rincian simpanan (Pokok, Wajib, Sukarela) per anggota koperasi.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nama Anggota</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Pokok</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Wajib</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Sukarela</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Simpanan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {savingsMemberRes.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                  <td style={{ padding: '12px 8px' }}>{item.memberName}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.simpananPokok)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.simpananWajib)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatRp(item.simpananSukarela)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(item.totalSavings)}</td>
                                </tr>
                              ))}
                              {savingsMemberRes.length === 0 && (
                                <tr>
                                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Tidak ada data anggota.</td>
                                </tr>
                              )}
                              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-background-secondary)', fontWeight: 600 }}>
                                <td colSpan={4} style={{ padding: '12px 8px' }}>Total Simpanan Koperasi</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                  {formatRp(savingsMemberRes.reduce((sum, item) => sum + item.totalSavings, 0))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'cashflow_statement' && cashflowRes && (
                        <VStack gap={4}>
                          <Text type="body">
                            Laporan arus kas masuk (Inflow) dan keluar (Outflow) berdasarkan kategori.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Kategori</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Subkategori</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Nominal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {['inflow', 'outflow'].map(cat => (
                                <React.Fragment key={cat}>
                                  <tr>
                                    <td colSpan={3} style={{ padding: '12px 8px', fontWeight: 600, textTransform: 'uppercase', backgroundColor: 'var(--color-background-secondary)' }}>
                                      {cat === 'inflow' ? 'ARUS KAS MASUK (INFLOW)' : 'ARUS KAS KELUAR (OUTFLOW)'}
                                    </td>
                                  </tr>
                                  {cashflowRes.filter(c => c.category === cat).map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                      <td></td>
                                      <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{item.subcategory.replace(/_/g, ' ')}</td>
                                      <td style={{ padding: '12px 8px', textAlign: 'right', color: cat === 'inflow' ? 'var(--color-success-500)' : 'var(--color-critical-500)' }}>
                                        {formatRp(item.total)}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr style={{ borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>
                                    <td colSpan={2} style={{ padding: '12px 8px', textAlign: 'right' }}>
                                      Subtotal {cat}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                      {formatRp(cashflowRes.filter(c => c.category === cat).reduce((sum, item) => sum + item.total, 0))}
                                    </td>
                                  </tr>
                                </React.Fragment>
                              ))}
                              
                              <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-background-subtle)', fontWeight: 600 }}>
                                <td colSpan={2} style={{ padding: '16px 8px' }}>NET CASH (KAS BERSIH PERIODE)</td>
                                <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                                  {formatRp(
                                    cashflowRes.filter(c => c.category === 'inflow').reduce((sum, item) => sum + item.total, 0) -
                                    cashflowRes.filter(c => c.category === 'outflow').reduce((sum, item) => sum + item.total, 0)
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}


                      {/* Signature block */}
                      <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'center', width: '200px' }}>
                          <Text type="body">Disiapkan oleh,</Text>
                          <div style={{ height: '70px' }} />
                          <Text type="body" style={{ fontWeight: 600, textDecoration: 'underline' }}>Bendahara Koperasi</Text>
                        </div>
                        <div style={{ textAlign: 'center', width: '200px' }}>
                          <Text type="body">Disetujui oleh,</Text>
                          <div style={{ height: '70px' }} />
                          <Text type="body" style={{ fontWeight: 600, textDecoration: 'underline' }}>Ketua Koperasi</Text>
                        </div>
                      </div>
                    </VStack>
                  </Card>
                  );
                })()}
              </DataStateView>
            </StackItem>
          </Grid>
        </LayoutContent>
      }
    />
  );
}
