'use client';

import {useState} from 'react';
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
import {formatRp} from '../utils/format';
import {DataStateView} from '../components/DataStateView';

import type {ReportData} from '../shared/types';

type ReportType = 'cooperative_summary' | 'savings_summary' | 'loans_summary' | 'interest_income';

export default function ReportsTemplate() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('cooperative_summary');
  const currentYear = new Date().getFullYear().toString();

  const { data: reportResponse, isLoading: isSummaryLoading, error: summaryError, refetch: fetchSummary } = useApiQuery<ReportData>('/api/reports/summary');
  const { data: monthlyInterestRes, isLoading: isInterestLoading, error: interestError, refetch: fetchInterest } = useApiQuery<Array<{ monthKey: string, monthName: string, interestIncome: number }>>(`/api/reports/monthly-interest?year=${currentYear}`);

  const isLoading = selectedReport === 'interest_income' ? isInterestLoading : isSummaryLoading;
  const error = selectedReport === 'interest_income' ? interestError : summaryError;
  const refetch = selectedReport === 'interest_income' ? fetchInterest : fetchSummary;

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
              <HStack gap={2}>
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10B981',
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
                    backgroundColor: '#0171E3',
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
                        backgroundColor: selectedReport === 'cooperative_summary' ? '#0171E3' : 'transparent',
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
                        backgroundColor: selectedReport === 'savings_summary' ? '#0171E3' : 'transparent',
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
                        backgroundColor: selectedReport === 'loans_summary' ? '#0171E3' : 'transparent',
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
                        backgroundColor: selectedReport === 'interest_income' ? '#0171E3' : 'transparent',
                        color: selectedReport === 'interest_income' ? 'white' : 'inherit',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      💵 Laporan Pendapatan Bunga
                    </button>
                  </VStack>
                </VStack>
              </Card>
            </StackItem>

            {/* Preview area card */}
            <StackItem style={{ flex: '1 1 auto' }}>
              <DataStateView isLoading={isLoading} error={error} onRetry={refetch} errorTitle="Gagal Memuat Laporan">
                {(reportResponse || monthlyInterestRes) && (
                  <Card id="printable-report-area" style={{ padding: '40px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <VStack gap={5}>
                      {/* Document Header */}
                      <div style={{ borderBottom: '3px double #000', paddingBottom: '20px', textAlign: 'center' }}>
                        <Heading level={2} style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: '#111827' }}>Koperasi Simpan Pinjam Koperasi-App</Heading>
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
                        </Heading>
                        <Text type="supporting" color="secondary" style={{ marginTop: '4px' }}>
                          Per Tanggal: {formattedDate}
                        </Text>
                      </div>

                      {/* Report Content */}
                      {selectedReport === 'cooperative_summary' && (
                        <VStack gap={4}>
                          <Text type="body">
                            Laporan ini menyajikan rangkuman perkembangan koperasi secara umum yang mencakup data keanggotaan, akumulasi simpanan, serta total portofolio penyaluran pinjaman.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #374151', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Parameter Keuangan & Operasional</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Nilai/Jumlah</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Total Anggota Terdaftar</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{reportResponse.members.totalMembers} Orang</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Anggota Berstatus Aktif</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{reportResponse.members.activeMembers} Orang</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Total Dana Simpanan Anggota</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#10b981' }}>{formatRp(reportResponse.members.totalSavings)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Total Pinjaman Tersalurkan (Kredit Aktif)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#0171E3' }}>{formatRp(reportResponse.loans.totalLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #374151' }}>
                                <td style={{ padding: '12px 8px' }}>Total Penerimaan Angsuran Pinjaman</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#10b981' }}>{formatRp(reportResponse.loans.totalPaymentsReceived)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'savings_summary' && (
                        <VStack gap={4}>
                          <Text type="body">
                            Rincian portfolio dana simpanan yang dihimpun dari seluruh anggota koperasi yang terbagi berdasarkan jenis simpanan pokok, wajib, dan sukarela.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #374151', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Jenis Simpanan</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Akumulasi</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Simpanan Pokok (Modal Awal)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(reportResponse.members.totalPokok)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Simpanan Wajib (Bulanan)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(reportResponse.members.totalWajib)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Simpanan Sukarela (Tabungan Bebas)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{formatRp(reportResponse.members.totalSukarela)}</td>
                              </tr>
                              <tr style={{ borderBottom: '2px solid #374151', backgroundColor: '#f9fafb' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 600 }}>Total Seluruh Simpanan</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatRp(reportResponse.members.totalSavings)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </VStack>
                      )}

                      {selectedReport === 'loans_summary' && (
                        <VStack gap={4}>
                          <Text type="body">
                            Rincian portofolio kredit dan pinjaman yang telah disalurkan kepada anggota beserta status pengembalian dan kualitas aset kredit.
                          </Text>
                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #374151', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Status Portofolio Kredit</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Total Nominal</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Kredit Lancar Aktif (Disetujui)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#0171E3' }}>{formatRp(reportResponse.loans.activeLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Kredit Lunas (Telah Diselesaikan)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#10b981' }}>{formatRp(reportResponse.loans.paidLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '12px 8px' }}>Kredit Bermasalah (Macet / NPL)</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#ef4444' }}>{formatRp(reportResponse.loans.badLoansAmount)}</td>
                              </tr>
                              <tr style={{ borderBottom: '2px solid #374151', backgroundColor: '#f9fafb' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 600 }}>Total Kumulatif Penyaluran Pinjaman</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{formatRp(reportResponse.loans.totalLoansAmount)}</td>
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
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="monthName" />
                                <YAxis tickFormatter={(tick) => `Rp ${(tick / 1000).toLocaleString('id-ID')}k`} />
                                <RechartsTooltip formatter={(value: any) => formatRp(value)} />
                                <Bar dataKey="interestIncome" fill="#10B981" radius={[4, 4, 0, 0]} name="Pendapatan Bunga" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #374151', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Bulan</th>
                                <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Pendapatan Bunga</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyInterestRes.map((item) => (
                                <tr key={item.monthKey} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '12px 8px' }}>{item.monthName}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500, color: '#10B981' }}>
                                    {formatRp(item.interestIncome)}
                                  </td>
                                </tr>
                              ))}
                              <tr style={{ borderBottom: '2px solid #374151', backgroundColor: '#f9fafb', fontWeight: 600 }}>
                                <td style={{ padding: '12px 8px' }}>Total Pendapatan Bunga Tahunan</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#10B981' }}>
                                  {formatRp(monthlyInterestRes.reduce((sum, item) => sum + item.interestIncome, 0))}
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
                )}
              </DataStateView>
            </StackItem>
          </Grid>
        </LayoutContent>
      }
    />
  );
}
