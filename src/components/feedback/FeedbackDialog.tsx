import React, { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  BugAntIcon,
  LightBulbIcon,
  ChatBubbleBottomCenterTextIcon,
  CameraIcon,
  ArrowsPointingOutIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';

export type FeedbackType = 'bug' | 'feature' | 'general';

export interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialScreenshot?: string | null;
  onRetakeScreenshot?: () => Promise<string | null | void> | string | null | void;
  isRetaking?: boolean;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isOpen,
  onClose,
  initialScreenshot = null,
  onRetakeScreenshot,
  isRetaking = false,
}) => {
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [screenshotData, setScreenshotData] = useState<string | null>(initialScreenshot);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerRetake = async () => {
    if (!onRetakeScreenshot) return;
    try {
      const res = await onRetakeScreenshot();
      if (typeof res === 'string') {
        setScreenshotData(res);
        setIncludeScreenshot(true);
      }
    } catch (err) {
      console.error('[Feedback] Retake screenshot error:', err);
    }
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('File yang dipilih harus berupa gambar (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file gambar maksimal 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshotData(reader.result);
        setIncludeScreenshot(true);
        setErrorMsg('');
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file gambar.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  // Sync screenshot when parent updates it
  useEffect(() => {
    setScreenshotData(initialScreenshot);
    if (initialScreenshot) {
      setIncludeScreenshot(true);
    }
  }, [initialScreenshot]);

  // Support pasting image from clipboard
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processImageFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false);
      setErrorMsg('');
      setShowFullImage(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const currentResolution =
    typeof window !== 'undefined'
      ? `${window.innerWidth}x${window.innerHeight}`
      : 'Unknown';
  const currentUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  // Check auth tokens
  const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const memberToken =
    typeof localStorage !== 'undefined' ? localStorage.getItem('memberToken') : null;
  const effectiveToken = adminToken || memberToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 5) {
      setErrorMsg('Mohon isi deskripsi masukan minimal 5 karakter');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const headers: Record<string, string> = {};
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }

      const payload = {
        type,
        title: title.trim() || undefined,
        description: description.trim(),
        screenshot: includeScreenshot && screenshotData ? screenshotData : undefined,
        pageUrl: window.location.pathname + window.location.search,
        userAgent: currentUserAgent,
        screenResolution: currentResolution,
        userName: userName.trim() || undefined,
        userEmail: userEmail.trim() || undefined,
      };

      await api.post('/api/feedbacks', payload, { headers });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setErrorMsg(err?.message || 'Gagal mengirim masukan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
      data-feedback-ignore="true"
      data-html2canvas-ignore="true"
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
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-background-primary, #ffffff)',
          color: 'var(--color-text-primary, #18181b)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--color-border-primary, #e4e4e7)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-background-primary-subtle, #eff6ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary-500, #0171E3)',
              }}
            >
              <CameraIcon style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h2
                id="feedback-dialog-title"
                style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}
              >
                Kirim Masukan & Laporan
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  color: 'var(--color-text-secondary, #71717a)',
                }}
              >
                Bantu kami menyempurnakan aplikasi koperasi ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--color-text-secondary, #71717a)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content Form */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {isSuccess ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <CheckCircleIcon
                style={{ width: '56px', height: '56px', color: 'var(--color-success-500, #10b981)' }}
              />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                Terima Kasih atas Masukan Anda!
              </h3>
              <p style={{ margin: 0, color: 'var(--color-text-secondary, #71717a)', maxWidth: '360px' }}>
                Laporan Anda telah kami terima dan akan segera ditindaklanjuti oleh tim pengembang koperasi.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-background-danger-subtle, #fce8e6)',
                    color: 'var(--color-critical-500, #ef4444)',
                    fontSize: '0.85rem',
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {/* Feedback Type Selector */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '8px',
                  }}
                >
                  Kategori Masukan
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: type === 'bug'
                        ? '2px solid var(--color-critical-500, #ef4444)'
                        : '1px solid var(--color-border-primary, #e4e4e7)',
                      backgroundColor: type === 'bug'
                        ? 'var(--color-background-danger-subtle, #fce8e6)'
                        : 'transparent',
                      cursor: 'pointer',
                      color: 'var(--color-text-primary, #18181b)',
                    }}
                  >
                    <BugAntIcon
                      style={{
                        width: '20px',
                        height: '20px',
                        color: type === 'bug' ? 'var(--color-critical-500, #ef4444)' : 'inherit',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: type === 'bug' ? 600 : 500 }}>
                      Kendala / Bug
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: type === 'feature'
                        ? '2px solid var(--color-primary-500, #0171E3)'
                        : '1px solid var(--color-border-primary, #e4e4e7)',
                      backgroundColor: type === 'feature'
                        ? 'var(--color-background-primary-subtle, #eff6ff)'
                        : 'transparent',
                      cursor: 'pointer',
                      color: 'var(--color-text-primary, #18181b)',
                    }}
                  >
                    <LightBulbIcon
                      style={{
                        width: '20px',
                        height: '20px',
                        color: type === 'feature' ? 'var(--color-primary-500, #0171E3)' : 'inherit',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: type === 'feature' ? 600 : 500 }}>
                      Usulan Fitur
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('general')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: type === 'general'
                        ? '2px solid var(--color-success-500, #10b981)'
                        : '1px solid var(--color-border-primary, #e4e4e7)',
                      backgroundColor: type === 'general'
                        ? 'var(--color-background-success-subtle, #e6f4ea)'
                        : 'transparent',
                      cursor: 'pointer',
                      color: 'var(--color-text-primary, #18181b)',
                    }}
                  >
                    <ChatBubbleBottomCenterTextIcon
                      style={{
                        width: '20px',
                        height: '20px',
                        color: type === 'general' ? 'var(--color-success-500, #10b981)' : 'inherit',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: type === 'general' ? 600 : 500 }}>
                      Masukan Umum
                    </span>
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label
                  htmlFor="feedback-title"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Judul Ringkas <span style={{ color: 'var(--color-text-secondary, #71717a)', fontWeight: 400 }}>(opsional)</span>
                </label>
                <input
                  id="feedback-title"
                  type="text"
                  placeholder={
                    type === 'bug'
                      ? 'Contoh: Tombol simpan tidak merespons'
                      : type === 'feature'
                      ? 'Contoh: Tambah fitur cetak kartu anggota'
                      : 'Contoh: Tampilan aplikasi di ponsel'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border-primary, #e4e4e7)',
                    backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                    color: 'var(--color-text-primary, #18181b)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Description Input */}
              <div>
                <label
                  htmlFor="feedback-desc"
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Deskripsi <span style={{ color: 'var(--color-critical-500, #ef4444)' }}>*</span>
                </label>
                <textarea
                  id="feedback-desc"
                  rows={4}
                  required
                  placeholder={
                    type === 'bug'
                      ? 'Jelaskan kendala yang dialami, urutan langkah sebelum kendala muncul, atau pesan error yang tertera...'
                      : type === 'feature'
                      ? 'Jelaskan ide fitur baru yang Anda butuhkan dan bagaimana fitur tersebut dapat mempermudah pekerjaan Anda...'
                      : 'Tuliskan saran, pertanyaan, atau masukan umum Anda...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border-primary, #e4e4e7)',
                    backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                    color: 'var(--color-text-primary, #18181b)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Screenshot Section */}
              <div
                style={{
                  border: '1px solid var(--color-border-primary, #e4e4e7)',
                  borderRadius: '10px',
                  padding: '12px',
                  backgroundColor: 'var(--color-background-subtle, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: screenshotData ? 'pointer' : 'default',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeScreenshot && !!screenshotData}
                      disabled={!screenshotData}
                      onChange={(e) => setIncludeScreenshot(e.target.checked)}
                      style={{ cursor: screenshotData ? 'pointer' : 'default' }}
                    />
                    <span>Sertakan tangkapan layar tampilan saat ini</span>
                  </label>

                  {onRetakeScreenshot && (
                    <button
                      type="button"
                      onClick={handleTriggerRetake}
                      disabled={isRetaking}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary-500, #0171E3)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '6px',
                      }}
                    >
                      <ArrowPathIcon
                        style={{
                          width: '14px',
                          height: '14px',
                          animation: isRetaking ? 'spin 1s linear infinite' : 'none',
                        }}
                      />
                      <span>{isRetaking ? 'Mengambil...' : 'Ambil Ulang'}</span>
                    </button>
                  )}
                </div>

                {screenshotData && includeScreenshot ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px',
                      backgroundColor: 'var(--color-background-primary, #ffffff)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-primary, #e4e4e7)',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '100px',
                        height: '60px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border-primary, #e4e4e7)',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={screenshotData}
                        alt="Tangkapan layar"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 500 }}>
                        Tangkapan Layar Halaman
                      </p>
                      <p
                        style={{
                          margin: '2px 0 0 0',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary, #71717a)',
                        }}
                      >
                        Membantu tim melihat tampilan persis saat laporan dibuat
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setShowFullImage(true)}
                        title="Lihat ukuran penuh"
                        style={{
                          background: 'none',
                          border: '1px solid var(--color-border-primary, #e4e4e7)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary, #71717a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ArrowsPointingOutIcon style={{ width: '16px', height: '16px' }} />
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Ganti dengan unggah gambar"
                        style={{
                          background: 'none',
                          border: '1px solid var(--color-border-primary, #e4e4e7)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary, #71717a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ArrowUpTrayIcon style={{ width: '16px', height: '16px' }} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotData(null);
                          setIncludeScreenshot(false);
                        }}
                        title="Hapus tangkapan layar"
                        style={{
                          background: 'none',
                          border: '1px solid var(--color-border-primary, #e4e4e7)',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-critical-500, #ef4444)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TrashIcon style={{ width: '16px', height: '16px' }} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary, #71717a)',
                        fontStyle: 'italic',
                      }}
                    >
                      {!screenshotData
                        ? 'Tangkapan layar tidak tersedia atau dihapus.'
                        : 'Tangkapan layar dinonaktifkan untuk laporan ini.'}
                    </p>
                    {!screenshotData && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        {onRetakeScreenshot && (
                          <button
                            type="button"
                            onClick={handleTriggerRetake}
                            disabled={isRetaking}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border-primary, #e4e4e7)',
                              backgroundColor: 'var(--color-background-primary, #ffffff)',
                              color: 'var(--color-primary-500, #0171E3)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              cursor: isRetaking ? 'wait' : 'pointer',
                            }}
                          >
                            <CameraIcon style={{ width: '14px', height: '14px' }} />
                            <span>{isRetaking ? 'Mengambil Layar...' : 'Ambil Layar'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border-primary, #e4e4e7)',
                            backgroundColor: 'var(--color-background-primary, #ffffff)',
                            color: 'var(--color-text-primary, #18181b)',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <ArrowUpTrayIcon style={{ width: '14px', height: '14px' }} />
                          <span>Unggah Gambar</span>
                        </button>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-secondary, #71717a)',
                          }}
                        >
                          atau tempel gambar dengan <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: 'var(--color-background-secondary, #f4f4f5)', border: '1px solid var(--color-border-primary, #e4e4e7)', fontSize: '0.75rem' }}>Ctrl+V</kbd>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  aria-label="Pilih gambar tangkapan layar"
                />
              </div>

              {/* Metadata Details Accordion */}
              <div
                style={{
                  borderTop: '1px solid var(--color-border-primary, #e4e4e7)',
                  paddingTop: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowMetadata(!showMetadata)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary, #71717a)',
                    fontSize: '0.75rem',
                  }}
                >
                  <span>Info Teknis Otomatis (URL, Browser, Resolusi)</span>
                  {showMetadata ? (
                    <ChevronUpIcon style={{ width: '14px', height: '14px' }} />
                  ) : (
                    <ChevronDownIcon style={{ width: '14px', height: '14px' }} />
                  )}
                </button>

                {showMetadata && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary, #71717a)',
                      lineHeight: 1.6,
                    }}
                  >
                    <div><strong>Halaman:</strong> {currentUrl}</div>
                    <div><strong>Resolusi:</strong> {currentResolution}</div>
                    <div style={{ wordBreak: 'break-all' }}><strong>User Agent:</strong> {currentUserAgent}</div>
                  </div>
                )}
              </div>

              {/* Guest Identity Fields if unauthenticated */}
              {!effectiveToken && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    paddingTop: '4px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="feedback-user-name"
                      style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        marginBottom: '4px',
                      }}
                    >
                      Nama Anda (opsional)
                    </label>
                    <input
                      id="feedback-user-name"
                      type="text"
                      placeholder="Nama lengkap"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border-primary, #e4e4e7)',
                        backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                        color: 'var(--color-text-primary, #18181b)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="feedback-user-email"
                      style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        marginBottom: '4px',
                      }}
                    >
                      Email Anda (opsional)
                    </label>
                    <input
                      id="feedback-user-email"
                      type="email"
                      placeholder="email@contoh.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border-primary, #e4e4e7)',
                        backgroundColor: 'var(--color-background-secondary, #f4f4f5)',
                        color: 'var(--color-text-primary, #18181b)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
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
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || description.trim().length < 5}
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
                    cursor: isSubmitting || description.trim().length < 5 ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting || description.trim().length < 5 ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#ffffff',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Kirim Masukan</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Full Screenshot Preview */}
      {showFullImage && screenshotData && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowFullImage(false)}
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
              onClick={() => setShowFullImage(false)}
              aria-label="Tutup preview"
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
              src={screenshotData}
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
