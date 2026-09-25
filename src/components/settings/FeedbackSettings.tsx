import React, { useState, useEffect, useCallback } from 'react';
import {
  BugAntIcon,
  LightBulbIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ArrowsPointingOutIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import { useToast } from '@astryxdesign/core/Toast';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Text, Heading } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Layout';

export interface FeedbackItem {
  id: string;
  type: 'bug' | 'feature' | 'general';
  title: string | null;
  description: string;
  screenshot_url: string | null;
  page_url: string | null;
  user_agent: string | null;
  screen_resolution: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackStats {
  total: number;
  statusCounts: {
    open: number;
    in_review: number;
    resolved: number;
    closed: number;
  };
  typeCounts: {
    bug: number;
    feature: number;
    general: number;
  };
}

export interface FeedbackSettingsProps {
  hideHeader?: boolean;
}

export const FeedbackSettings: React.FC<FeedbackSettingsProps> = ({ hideHeader = false }) => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected item for detail / status update dialog
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [editStatus, setEditStatus] = useState<string>('open');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Fullscreen image preview lightbox
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const toast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query string
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '100');

      const [listRes, statsRes] = await Promise.all([
        api.get<{ feedbacks: FeedbackItem[]; total: number }>(`/api/feedbacks?${params.toString()}`),
        api.get<FeedbackStats>('/api/feedbacks/stats'),
      ]);

      setFeedbacks(listRes.feedbacks || []);
      setStats(statsRes || null);
    } catch (err: any) {
      console.error('Error loading feedbacks:', err);
      toast({ body: err?.message || 'Gagal memuat data masukan', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, searchQuery, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDetail = (item: FeedbackItem) => {
    setSelectedItem(item);
    setEditStatus(item.status);
    setAdminNotes(item.admin_notes || '');
  };

  const handleSaveStatus = async () => {
    if (!selectedItem) return;
    setIsUpdating(true);
    try {
      await api.put(`/api/feedbacks/${selectedItem.id}/status`, {
        status: editStatus,
        adminNotes: adminNotes.trim() || undefined,
      });

      toast({ body: 'Status masukan berhasil diperbarui', type: 'success' });
      setSelectedItem(null);
      loadData();
    } catch (err: any) {
      console.error('Error updating feedback status:', err);
      toast({ body: err?.message || 'Gagal memperbarui status', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (item: FeedbackItem) => {
    if (!window.confirm('Yakin ingin menghapus laporan masukan ini?')) return;
    try {
      await api.delete(`/api/feedbacks/${item.id}`);
      toast({ body: 'Laporan berhasil dihapus', type: 'success' });
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      }
      loadData();
    } catch (err: any) {
      console.error('Error deleting feedback:', err);
      toast({ body: err?.message || 'Gagal menghapus laporan', type: 'error' });
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bug':
        return <Badge variant="critical" size="sm" label="Bug" />;
      case 'feature':
        return <Badge variant="info" size="sm" label="Usulan Fitur" />;
      default:
        return <Badge variant="success" size="sm" label="Masukan" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="warning" size="sm" label="Baru (Open)" />;
      case 'in_review':
        return <Badge variant="info" size="sm" label="Ditinjau" />;
      case 'resolved':
        return <Badge variant="success" size="sm" label="Selesai" />;
      default:
        return <Badge variant="neutral" size="sm" label="Ditutup" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Description */}
      {!hideHeader && (
        <VStack gap={1}>
          <Heading level={3}>
            Laporan Masukan, Bug & Usulan Fitur
          </Heading>
          <Text type="supporting" color="secondary">
            Kelola seluruh feedback dan kendala yang dilaporkan oleh anggota koperasi dan pengguna sistem lengkap dengan tangkapan layar.
          </Text>
        </VStack>
      )}

      {/* Stats Summary Cards */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary, #71717a)' }}>
              Total Laporan
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px' }}>
              {stats.total}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--color-warning-500, #f59e0b)' }}>
              Menunggu / Open
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-warning-500, #f59e0b)' }}>
              {stats.statusCounts.open}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--color-critical-500, #ef4444)' }}>
              Kendala (Bug)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-critical-500, #ef4444)' }}>
              {stats.typeCounts.bug}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-500, #0171E3)' }}>
              Usulan Fitur
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-primary-500, #0171E3)' }}>
              {stats.typeCounts.feature}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--color-success-500, #10b981)' }}>
              Terselesaikan
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-success-500, #10b981)' }}>
              {stats.statusCounts.resolved}
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
          border: '1px solid var(--color-border-primary, #e4e4e7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipe:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
              color: 'var(--color-text-primary, #18181b)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">Semua Tipe</option>
            <option value="bug">Bug / Kendala</option>
            <option value="feature">Usulan Fitur</option>
            <option value="general">Masukan Umum</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
              color: 'var(--color-text-primary, #18181b)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="open">Baru (Open)</option>
            <option value="in_review">Ditinjau</option>
            <option value="resolved">Selesai</option>
            <option value="closed">Ditutup</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <MagnifyingGlassIcon
            style={{
              position: 'absolute',
              left: '10px',
              width: '16px',
              height: '16px',
              color: 'var(--color-text-secondary, #71717a)',
            }}
          />
          <input
            type="text"
            placeholder="Cari judul, deskripsi, pelapor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
              color: 'var(--color-text-primary, #18181b)',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <Button
          variant="secondary"
          onClick={loadData}
          isDisabled={loading}
        >
          <HStack gap={1} vAlign="center">
            <ArrowPathIcon
              style={{
                width: '16px',
                height: '16px',
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Segarkan</span>
          </HStack>
        </Button>
      </div>

      {/* Feedbacks List Table */}
      <div
        style={{
          border: '1px solid var(--color-border-primary, #e4e4e7)',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-background-primary, #ffffff)',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary, #71717a)' }}>
            Memuat data masukan...
          </div>
        ) : feedbacks.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary, #71717a)' }}>
            Tidak ada laporan masukan yang sesuai dengan filter.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                    borderBottom: '1px solid var(--color-border-primary, #e4e4e7)',
                    color: 'var(--color-text-secondary, #71717a)',
                    fontSize: '0.8rem',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Kategori & Tanggal</th>
                  <th style={{ padding: '12px 16px' }}>Judul & Masukan</th>
                  <th style={{ padding: '12px 16px' }}>Pelapor</th>
                  <th style={{ padding: '12px 16px' }}>Tangkapan Layar</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid var(--color-border-primary, #e4e4e7)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '12px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>{getTypeBadge(item.type)}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #71717a)' }}>
                          {new Date(item.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top', maxWidth: '300px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #18181b)', marginBottom: '4px' }}>
                        {item.title || '(Tanpa Judul)'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--color-text-secondary, #71717a)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.description}
                      </div>
                      {item.page_url && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--color-primary-500, #0171E3)',
                          }}
                        >
                          Halaman: {item.page_url}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 500 }}>{item.user_name || 'Anonim'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #71717a)' }}>
                        {item.user_email || item.user_role || 'Pengguna'}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      {item.screenshot_url ? (
                        <div
                          onClick={() => setPreviewImage(item.screenshot_url)}
                          style={{
                            cursor: 'pointer',
                            position: 'relative',
                            width: '64px',
                            height: '40px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border-primary, #e4e4e7)',
                          }}
                        >
                          <img
                            src={item.screenshot_url}
                            alt="Screenshot"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #71717a)' }}>
                          Tidak ada
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                      {getStatusBadge(item.status)}
                    </td>

                    <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                      <HStack gap={1} hAlign="end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenDetail(item)}
                        >
                          <HStack gap={1} vAlign="center">
                            <EyeIcon width={14} />
                            <span>Detail</span>
                          </HStack>
                        </Button>

                        <IconButton
                          icon={<Icon icon={TrashIcon} />}
                          label="Hapus masukan"
                          title="Hapus masukan"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                        />
                      </HStack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail and Status Update Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-background-primary, #ffffff)',
              color: 'var(--color-text-primary, #18181b)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--color-border-primary, #e4e4e7)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-border-primary, #e4e4e7)',
              }}
            >
              <HStack vAlign="center" gap={2}>
                {getTypeBadge(selectedItem.type)}
                <Heading level={3} style={{ margin: 0 }}>
                  {selectedItem.title || 'Detail Masukan'}
                </Heading>
              </HStack>
              <IconButton
                icon={<Icon icon={XMarkIcon} />}
                label="Tutup Modal"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItem(null)}
              />
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Reporter Info */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                  fontSize: '0.85rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '8px',
                }}
              >
                <div>
                  <strong>Pelapor:</strong> {selectedItem.user_name || 'Anonim'} ({selectedItem.user_role || 'Pengguna'})
                </div>
                <div>
                  <strong>Email:</strong> {selectedItem.user_email || '-'}
                </div>
                <div>
                  <strong>Waktu:</strong>{' '}
                  {new Date(selectedItem.created_at).toLocaleString('id-ID')}
                </div>
                <div>
                  <strong>Halaman:</strong> {selectedItem.page_url || '-'}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Deskripsi Lengkap
                </label>
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border-primary, #e4e4e7)',
                    backgroundColor: 'var(--color-background-subtle, #f8fafc)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedItem.description}
                </div>
              </div>

              {/* Screenshot Preview */}
              {selectedItem.screenshot_url && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tangkapan Layar</label>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(selectedItem.screenshot_url)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary-500, #0171E3)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ArrowsPointingOutIcon style={{ width: '14px', height: '14px' }} />
                      <span>Perbesar Layar Penuh</span>
                    </button>
                  </div>
                  <div
                    onClick={() => setPreviewImage(selectedItem.screenshot_url)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid var(--color-border-primary, #e4e4e7)',
                      maxHeight: '220px',
                      backgroundColor: '#000',
                    }}
                  >
                    <img
                      src={selectedItem.screenshot_url}
                      alt="Tangkapan Layar"
                      style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: '220px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Technical Environment Info */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-primary, #e4e4e7)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary, #71717a)',
                  lineHeight: 1.5,
                }}
              >
                <div><strong>Resolusi Layar:</strong> {selectedItem.screen_resolution || '-'}</div>
                <div style={{ wordBreak: 'break-all' }}><strong>User Agent:</strong> {selectedItem.user_agent || '-'}</div>
              </div>

              {/* Status and Admin Notes Form */}
              <div
                style={{
                  borderTop: '1px solid var(--color-border-primary, #e4e4e7)',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ubah Status:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-primary, #e4e4e7)',
                      backgroundColor: 'var(--color-background-primary, #ffffff)',
                      color: 'var(--color-text-primary, #18181b)',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                    }}
                  >
                    <option value="open">Baru (Open)</option>
                    <option value="in_review">Sedang Ditinjau (In Review)</option>
                    <option value="resolved">Selesai (Resolved)</option>
                    <option value="closed">Ditutup (Closed)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                    Catatan Admin / Tindak Lanjut:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan catatan perbaikan, rilis terkait, atau verifikasi..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-primary, #e4e4e7)',
                      backgroundColor: 'var(--color-background-primary, #ffffff)',
                      color: 'var(--color-text-primary, #18181b)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '16px 20px',
                borderTop: '1px solid var(--color-border-primary, #e4e4e7)',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-primary, #e4e4e7)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-primary, #18181b)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={isUpdating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary-500, #0171E3)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isUpdating ? 'wait' : 'pointer',
                }}
              >
                {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Fullscreen Image Preview */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              backgroundColor: '#000',
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XMarkIcon style={{ width: '20px', height: '20px' }} />
            </button>
            <img
              src={previewImage}
              alt="Pratinjau Layar Penuh"
              style={{
                display: 'block',
                maxWidth: '90vw',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackSettings;
