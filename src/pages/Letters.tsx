'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout, LayoutHeader, LayoutContent, VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Table, pixel, proportional } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { Grid } from '@astryxdesign/core/Grid';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@astryxdesign/core/Dialog';
import { useApiQuery } from '../hooks/useApiQuery';
import { formatRp, formatDate } from '../utils/format';

interface OfficialLetter {
  id: string;
  letterNumber: string;
  seqNumber: number;
  category: string;
  letterDate: string;
  partyName: string;
  subject: string;
  description?: string | null;
  amount?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: string;
  createdBy?: string | null;
  createdAt: string;
}

interface LetterCategory {
  id: string;
  code: string;
  label: string;
}

interface LettersResponse {
  data: OfficialLetter[];
  total: number;
  page: number;
  limit: number;
  stats: {
    total: number;
    byCategory: Record<string, number>;
  };
}

export default function LettersPage() {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // Query categories
  const { data: catRes } = useApiQuery<LetterCategory[]>('/api/letters/categories');
  const categories = catRes || [
    { id: 'PINJAMAN_ANGGOTA', code: 'SPP-ANG', label: 'Surat Perjanjian Pinjaman Anggota' },
    { id: 'PINJAMAN_MODAL', code: 'SPH-MODAL', label: 'Surat Perjanjian Pinjaman Modal Masuk' },
    { id: 'SURAT_KELUAR', code: 'SKEL-UMUM', label: 'Surat Keluar Umum' },
    { id: 'SURAT_KEPUTUSAN', code: 'SK-PENG', label: 'Surat Keputusan Pengurus' },
    { id: 'PERJANJIAN_KERJASAMA', code: 'SPK-KERJA', label: 'Surat Perjanjian Kerjasama' },
  ];

  // Query letters list
  const queryUrl = `/api/letters?page=${page}&limit=20&category=${selectedCategory}&year=${selectedYear}&search=${encodeURIComponent(searchQuery)}`;
  const { data: lettersRes, isLoading, error, refetch } = useApiQuery<LettersResponse>(queryUrl);

  // Dialog State for creating new letter
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formCategory, setFormCategory] = useState('PINJAMAN_ANGGOTA');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formPartyName, setFormPartyName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formAttachmentUrl, setFormAttachmentUrl] = useState('');
  const [formAttachmentName, setFormAttachmentName] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isManualNumber, setIsManualNumber] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query preview number whenever category or date changes
  const { data: previewRes } = useApiQuery<{ nextSeq: number; letterNumber: string; categoryCode: string }>(
    `/api/letters/preview-next-number?category=${formCategory}&date=${formDate}`
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Ukuran file maksimal adalah 10 MB');
      return;
    }
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(ext)) {
      setUploadError('Hanya file PDF, JPG, PNG, dan WebP yang diizinkan');
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/upload/loan-attachment', {
        method: 'POST',
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.data?.url) {
        setFormAttachmentUrl(res.data.url);
        setFormAttachmentName(res.data.name || file.name);
      } else {
        setUploadError(res.message || 'Gagal mengunggah file lampiran');
      }
    } catch {
      setUploadError('Terjadi kesalahan jaringan saat mengunggah');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleCreateLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const numericAmount = formAmount ? parseFloat(formAmount.replace(/\D/g, '')) : null;
      const res = await fetch('/api/v1/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formCategory,
          letterDate: formDate,
          partyName: formPartyName.trim(),
          subject: formSubject.trim(),
          description: formDescription.trim() || null,
          amount: numericAmount,
          attachmentUrl: formAttachmentUrl || null,
          attachmentName: formAttachmentName || null,
          manualLetterNumber: isManualNumber ? manualNumber.trim() : null,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setFormSuccess(`Nomor surat '${res.data?.letterNumber}' berhasil diterbitkan!`);
        setTimeout(() => {
          setShowCreateModal(false);
          setFormPartyName('');
          setFormSubject('');
          setFormDescription('');
          setFormAmount('');
          setFormAttachmentUrl('');
          setFormAttachmentName('');
          setIsManualNumber(false);
          setManualNumber('');
          setFormSuccess('');
          refetch();
        }, 1200);
      } else {
        setFormError(res.message || 'Gagal menerbitkan nomor surat');
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLetter = async (letter: OfficialLetter) => {
    if (!window.confirm(`Yakin ingin menghapus arsip surat nomor '${letter.letterNumber}'?`)) return;
    try {
      const res = await fetch(`/api/v1/letters/${letter.id}`, { method: 'DELETE' }).then((r) => r.json());
      if (res.success) {
        refetch();
      } else {
        alert(res.message || 'Gagal menghapus surat');
      }
    } catch {
      alert('Terjadi kesalahan jaringan');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--color-border-primary)',
    backgroundColor: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const columns: TableColumn<OfficialLetter>[] = useMemo(() => [
    {
      key: 'letterNumber',
      header: 'Nomor Surat Resmi',
      width: pixel(210),
      renderCell: (item) => (
        <VStack gap={0}>
          <Text type="body" weight="bold" color="primary">
            {item.letterNumber}
          </Text>
          <Text type="supporting" size="sm" color="secondary">
            Tgl Terbit: {formatDate(item.letterDate)}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'category',
      header: 'Jenis Surat',
      width: pixel(180),
      renderCell: (item) => {
        const cat = categories.find((c) => c.id === item.category);
        const isAnggota = item.category === 'PINJAMAN_ANGGOTA';
        const isModal = item.category === 'PINJAMAN_MODAL';
        return (
          <Badge
            variant={isAnggota ? 'info' : isModal ? 'warning' : 'neutral'}
            label={cat?.label || item.category}
          />
        );
      },
    },
    {
      key: 'partyName',
      header: 'Pihak Terkait (Debitur/Kreditur)',
      width: proportional(1),
      renderCell: (item) => (
        <VStack gap={0}>
          <Text type="body" weight="semibold">{item.partyName}</Text>
          {item.amount && item.amount > 0 ? (
            <Text type="supporting" size="sm" color="success" style={{ fontWeight: 600 }}>
              Nilai: {formatRp(item.amount)}
            </Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: 'subject',
      header: 'Perihal & Keterangan',
      width: proportional(1.5),
      renderCell: (item) => (
        <VStack gap={0}>
          <Text type="body">{item.subject}</Text>
          {item.description && (
            <Text type="supporting" size="sm" color="secondary">
              {item.description}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'attachment',
      header: 'Berkas Fisik',
      width: pixel(120),
      renderCell: (item) => item.attachmentUrl ? (
        <Button
          label="📎 Buka File"
          size="sm"
          variant="secondary"
          onClick={() => window.open(item.attachmentUrl!, '_blank')}
        />
      ) : (
        <Text type="supporting" color="secondary">—</Text>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(80),
      renderCell: (item) => (
        <Button
          label="Hapus"
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteLetter(item)}
        />
      ),
    },
  ], [categories]);

  const stats = lettersRes?.stats;

  return (
    <Layout
      height="auto"
      header={
        <LayoutHeader hasDivider>
          <HStack justify="space-between" vAlign="center" style={{ width: '100%' }}>
            <VStack gap={0}>
              <Heading level={2}>Buku Agenda &amp; Penomoran Surat Resmi</Heading>
              <Text type="supporting" color="secondary">
                Penerbitan nomor surat resmi, perjanjian pinjaman anggota, dan perjanjian pinjaman modal (Anti Duplikasi).
              </Text>
            </VStack>
            <HStack gap={2}>
              <Button
                label="🖨️ Cetak Agenda"
                variant="secondary"
                onClick={() => window.print()}
              />
              <Button
                label="+ Terbitkan Nomor Surat"
                variant="primary"
                onClick={() => {
                  setShowCreateModal(true);
                  setFormError('');
                  setFormSuccess('');
                }}
              />
            </HStack>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={6}>
            {/* Metric Cards */}
            <Grid columns={{ minWidth: 220, repeat: 'fit' }} gap={4}>
              <Card style={{ padding: 16 }}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">Total Surat Terdaftar</Text>
                  <Heading level={2}>{stats?.total || 0}</Heading>
                </VStack>
              </Card>
              <Card style={{ padding: 16 }}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">Perjanjian Pinjaman Anggota (SPP-ANG)</Text>
                  <Heading level={2} color="primary">{stats?.byCategory?.['PINJAMAN_ANGGOTA'] || 0}</Heading>
                </VStack>
              </Card>
              <Card style={{ padding: 16 }}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">Perjanjian Pinjaman Modal (SPH-MODAL)</Text>
                  <Heading level={2} style={{ color: 'var(--color-warning-600, #d97706)' }}>
                    {stats?.byCategory?.['PINJAMAN_MODAL'] || 0}
                  </Heading>
                </VStack>
              </Card>
              <Card style={{ padding: 16 }}>
                <VStack gap={1}>
                  <Text type="supporting" color="secondary">Surat Keluar &amp; SK Lainnya</Text>
                  <Heading level={2}>
                    {(stats?.byCategory?.['SURAT_KELUAR'] || 0) +
                      (stats?.byCategory?.['SURAT_KEPUTUSAN'] || 0) +
                      (stats?.byCategory?.['PERJANJIAN_KERJASAMA'] || 0)}
                  </Heading>
                </VStack>
              </Card>
            </Grid>

            {/* Filter Bar */}
            <Card style={{ padding: 16 }}>
              <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                <HStack gap={3} vAlign="center" wrap="wrap">
                  <div style={{ minWidth: 240 }}>
                    <input
                      type="text"
                      placeholder="Cari Nomor Surat / Nama Pihak / Perihal..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{ ...inputStyle, width: 'auto' }}
                  >
                    <option value="ALL">Semua Jenis Surat</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} ({c.code})</option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{ ...inputStyle, width: 'auto' }}
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={String(y)}>Tahun {y}</option>
                    ))}
                  </select>
                </HStack>

                <Text type="supporting" color="secondary">
                  Ditemukan: {lettersRes?.total || 0} surat
                </Text>
              </HStack>
            </Card>

            {/* Main Table */}
            <Card>
              <Table
                data={lettersRes?.data || []}
                columns={columns}
                idKey="id"
                density="balanced"
                emptyStateMessage={isLoading ? 'Memuat daftar surat...' : 'Belum ada surat resmi yang terdaftar untuk filter ini.'}
              />
            </Card>
          </VStack>

          {/* Modal / Dialog Buat Surat Baru */}
          {showCreateModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '16px',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--color-background-primary)',
                  borderRadius: '12px',
                  maxWidth: '650px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--color-border-primary)',
                }}
              >
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-primary)' }}>
                  <HStack justify="space-between" vAlign="center">
                    <Heading level={3}>Terbitkan Nomor Surat Resmi Baru</Heading>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </HStack>
                </div>

                <form onSubmit={handleCreateLetter} style={{ padding: '20px 24px' }}>
                  <VStack gap={4}>
                    {formError && (
                      <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>
                        ⚠️ {formError}
                      </Text>
                    )}
                    {formSuccess && (
                      <Text type="supporting" color="success" style={{ fontWeight: 600 }}>
                        ✅ {formSuccess}
                      </Text>
                    )}

                    {/* Preview Nomor Surat Otomatis */}
                    <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-primary-500, #0171E3)' }}>
                      <VStack gap={1}>
                        <Text type="supporting" color="secondary">
                          {isManualNumber ? 'Nomor Surat (Input Manual):' : 'Pratinjau Nomor Surat Ter-Generate Otomatis:'}
                        </Text>
                        <Heading level={3} color="primary">
                          {isManualNumber ? (manualNumber || 'Contoh: 001/SPP/VIII/2026') : (previewRes?.letterNumber || 'Memuat nomor...')}
                        </Heading>
                        <HStack justify="space-between" vAlign="center" style={{ marginTop: 4 }}>
                          <Text type="supporting" size="sm" color="secondary">
                            Bebas duplikasi nomor, tersinkronisasi atomik dengan sequence database.
                          </Text>
                          <button
                            type="button"
                            onClick={() => setIsManualNumber(!isManualNumber)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary-500, #0171E3)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            {isManualNumber ? 'Gunakan Auto-Number' : 'Gunakan Nomor Manual / Lama'}
                          </button>
                        </HStack>
                      </VStack>
                    </Card>

                    {isManualNumber && (
                      <VStack gap={1}>
                        <Text type="supporting">Nomor Surat Kustom / Manual</Text>
                        <input
                          type="text"
                          placeholder="Masukkan nomor surat manual lengkap..."
                          value={manualNumber}
                          onChange={(e) => setManualNumber(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>
                    )}

                    <Grid gap={4}>
                      <VStack gap={2}>
                        <Text type="supporting">Kategori Surat</Text>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          style={inputStyle}
                          required
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.label} ({c.code})</option>
                          ))}
                        </select>
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting">Tanggal Terbit Surat</Text>
                        <input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>
                    </Grid>

                    <Grid gap={4}>
                      <VStack gap={2}>
                        <Text type="supporting">Pihak Terkait (Nama Anggota / Lembaga / Bank / Peminjam)</Text>
                        <input
                          type="text"
                          placeholder="Contoh: Budi Santoso / PT Modal Bersama"
                          value={formPartyName}
                          onChange={(e) => setFormPartyName(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting">Nilai Transaksi / Pokok Pinjaman (Opsional)</Text>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Contoh: 10.000.000"
                          value={formAmount}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setFormAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
                          }}
                          style={inputStyle}
                        />
                      </VStack>
                    </Grid>

                    <VStack gap={2}>
                      <Text type="supporting">Perihal Surat</Text>
                      <input
                        type="text"
                        placeholder="Contoh: Surat Perjanjian Pinjaman Multiguna Anggota"
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        style={inputStyle}
                        required
                      />
                    </VStack>

                    <VStack gap={2}>
                      <Text type="supporting">Ringkasan / Catatan Tambahan (Opsional)</Text>
                      <textarea
                        rows={2}
                        placeholder="Keterangan jaminan, nomor rekening pencairan, atau klausul penting..."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        style={inputStyle}
                      />
                    </VStack>

                    {/* Unggah Berkas Fisik / Scan */}
                    <VStack gap={2}>
                      <HStack justify="space-between" vAlign="center">
                        <Text type="supporting">Unggah Berkas Fisik / Scan Surat Bertandatangan (Opsional)</Text>
                        <Text type="supporting" size="sm" color="secondary">PDF / JPG / PNG (Maks 10 MB)</Text>
                      </HStack>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />

                      {!formAttachmentUrl ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            border: '2px dashed var(--color-border-primary)',
                            borderRadius: '8px',
                            padding: '14px',
                            textAlign: 'center',
                            cursor: uploadingAttachment ? 'wait' : 'pointer',
                            backgroundColor: 'var(--color-background-primary)',
                          }}
                        >
                          <Text type="body" weight="semibold">
                            {uploadingAttachment ? '⏳ Sedang mengunggah berkas...' : '📎 Klik untuk Unggah Scan Surat / Perjanjian'}
                          </Text>
                        </div>
                      ) : (
                        <Card style={{ padding: 12, backgroundColor: 'var(--color-background-secondary)' }}>
                          <HStack justify="space-between" vAlign="center">
                            <HStack vAlign="center" gap={2}>
                              <span>📄</span>
                              <Text type="body" weight="bold">{formAttachmentName}</Text>
                            </HStack>
                            <Button
                              label="Hapus Berkas"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setFormAttachmentUrl('');
                                setFormAttachmentName('');
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                            />
                          </HStack>
                        </Card>
                      )}

                      {uploadError && (
                        <Text type="supporting" color="critical">⚠️ {uploadError}</Text>
                      )}
                    </VStack>

                    <HStack justify="end" gap={3} style={{ marginTop: 12 }}>
                      <Button
                        label="Batal"
                        variant="ghost"
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        isDisabled={submitting}
                      />
                      <Button
                        label={submitting ? 'Menerbitkan...' : 'Terbitkan Nomor Surat'}
                        variant="primary"
                        type="submit"
                        isDisabled={submitting}
                      />
                    </HStack>
                  </VStack>
                </form>
              </div>
            </div>
          )}
        </LayoutContent>
      }
    />
  );
}
