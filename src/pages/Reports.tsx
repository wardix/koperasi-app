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
import {Text, Heading} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {useApiQuery} from '../hooks/useApiQuery';
import {formatRp} from '../utils/format';
import {DataStateView} from '../components/DataStateView';

import type {ReportData} from '../shared/types';

type ReportType = 'cooperative_summary' | 'savings_summary' | 'loans_summary';

export default function ReportsTemplate() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('cooperative_summary');
  const { data: reportResponse, isLoading, error, refetch: fetchReport } = useApiQuery<ReportData>('/api/reports/summary');

  const handlePrint = () => {
    window.print();
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
                  </VStack>
                </VStack>
              </Card>
            </StackItem>

            {/* Preview area card */}
            <StackItem style={{ flex: '1 1 auto' }}>
              <DataStateView isLoading={isLoading} error={error} onRetry={fetchReport} errorTitle="Gagal Memuat Laporan">
                {reportResponse && (
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
