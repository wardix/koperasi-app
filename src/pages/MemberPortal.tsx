import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { formatRp } from '../utils/format';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { SunIcon, MoonIcon, BanknotesIcon, ClipboardDocumentCheckIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useThemeMode } from '../contexts/ThemeContext';
import type { EwaFeeTier } from '../../shared/types';

const PREVIEW_TOKEN_KEY = 'memberPreviewToken';
const PREVIEW_NAME_KEY = 'memberPreviewName';
const PREVIEW_RETURN_KEY = 'memberPreviewReturn';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Google Identity Services (loaded via index.html)
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement | null,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: string | number;
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

function readPortalToken(): string | null {
  return sessionStorage.getItem(PREVIEW_TOKEN_KEY) || localStorage.getItem('memberToken');
}

type PortalLoan = {
  id: string;
  purpose: string;
  amount: number;
  status: string;
  createdAt: string;
  totalAmount?: number;
  monthlyPayment?: number;
  interestAmount?: number;
  tenor?: number;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
};

type ScheduleRow = {
  id: string;
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  paidAmount: number;
  status: string;
  lateFee?: number;
};

type PaymentRow = {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method?: string;
};

export default function MemberPortal() {
  const navigate = useNavigate();
  const { mode, setMode } = useThemeMode();
  const isDark = mode === 'dark';
  const [isPreview] = useState(() => !!sessionStorage.getItem(PREVIEW_TOKEN_KEY));
  const [previewName] = useState(() => sessionStorage.getItem(PREVIEW_NAME_KEY) || '');
  const [memberToken, setMemberToken] = useState<string | null>(() => readPortalToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loans, setLoans] = useState<PortalLoan[]>([]);
  const [activeTab, setActiveTab] = useState<'savings' | 'loans' | 'reports' | 'ewa'>('savings');
  const [selectedLoan, setSelectedLoan] = useState<PortalLoan | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Voluntary Savings Withdrawal State
  const [savingsWithdrawals, setSavingsWithdrawals] = useState<any[]>([]);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBank, setWithdrawBank] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawName, setWithdrawName] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Savings Deposit Confirmation State
  const [savingsDeposits, setSavingsDeposits] = useState<any[]>([]);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositSavingsType, setDepositSavingsType] = useState<'pokok' | 'wajib' | 'sukarela'>('wajib');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositTransferDate, setDepositTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depositSenderBank, setDepositSenderBank] = useState('');
  const [depositSenderAccount, setDepositSenderAccount] = useState('');
  const [depositSenderName, setDepositSenderName] = useState('');
  const [depositNotes, setDepositNotes] = useState('');
  const [depositProofUrl, setDepositProofUrl] = useState('');
  const [depositProofName, setDepositProofName] = useState('');
  const [depositUploadingProof, setDepositUploadingProof] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositSuccess, setDepositSuccess] = useState('');

  // EWA State
  const [ewaQuota, setEwaQuota] = useState<any>(null);
  const [ewaHistory, setEwaHistory] = useState<any[]>([]);
  const [feeTiers, setFeeTiers] = useState<EwaFeeTier[]>([]);
  const [ewaLoading, setEwaLoading] = useState(false);
  const [ewaAmount, setEwaAmount] = useState('');
  const [ewaBank, setEwaBank] = useState('');
  const [ewaAccount, setEwaAccount] = useState('');
  const [ewaName, setEwaName] = useState('');
  const [ewaSubmitLoading, setEwaSubmitLoading] = useState(false);
  const [ewaError, setEwaError] = useState('');
  const [ewaSuccess, setEwaSuccess] = useState('');

  const [incomeData, setIncomeData] = useState<any>(null);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [cashflowData, setCashflowData] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  const loadEwaData = async () => {
    const token = readPortalToken();
    if (!token) return;
    setEwaLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [quotaRes, histRes, tiersRes] = await Promise.all([
        fetch('/api/v1/portal/ewa/quota', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/ewa/history', { headers }).then((r) => r.json()),
        fetch('/api/v1/ewa/fee-tiers').then((r) => r.json()).catch(() => ({ success: false })),
      ]);
      if (quotaRes.success) {
        setEwaQuota(quotaRes.data);
        if (quotaRes.data?.feeTiers && Array.isArray(quotaRes.data.feeTiers)) {
          setFeeTiers(quotaRes.data.feeTiers);
        }
        if (quotaRes.data?.employee) {
          if (!ewaBank && quotaRes.data.employee.bankName) setEwaBank(quotaRes.data.employee.bankName);
          if (!ewaAccount && quotaRes.data.employee.bankAccountNumber) setEwaAccount(quotaRes.data.employee.bankAccountNumber);
          if (!ewaName && quotaRes.data.employee.bankAccountName) setEwaName(quotaRes.data.employee.bankAccountName);
        }
      }
      if (histRes.success) {
        setEwaHistory(histRes.data || []);
      }
      if (tiersRes.success && (!quotaRes?.data?.feeTiers || quotaRes.data.feeTiers.length === 0)) {
        setFeeTiers(tiersRes.data || []);
      }
    } catch {
      // ignore
    } finally {
      setEwaLoading(false);
    }
  };

  const handleApplyEwa = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readPortalToken();
    if (!token) return;
    setEwaSubmitLoading(true);
    setEwaError('');
    setEwaSuccess('');
    try {
      const numericAmount = parseFloat(ewaAmount.replace(/\D/g, '')) || 0;
      const res = await fetch('/api/v1/portal/ewa/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: numericAmount,
          destinationBank: ewaQuota?.employee?.bankName,
          destinationAccount: ewaQuota?.employee?.bankAccountNumber,
          destinationName: ewaQuota?.employee?.bankAccountName || ewaQuota?.employee?.name,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setEwaSuccess(res.message || 'Pengajuan penarikan gaji awal berhasil dikirim!');
        setEwaAmount('');
        loadEwaData();
        setTimeout(() => setEwaSuccess(''), 4000);
      } else {
        setEwaError(res.message || 'Gagal mengajukan penarikan EWA');
      }
    } catch {
      setEwaError('Terjadi kesalahan jaringan');
    } finally {
      setEwaSubmitLoading(false);
    }
  };

  const loadReports = async () => {
    const token = readPortalToken();
    if (!token) return;
    setReportsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [incRes, balRes, cfRes] = await Promise.all([
        fetch('/api/v1/portal/reports/income-statement', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/reports/balance-sheet', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/reports/cashflow-statement', { headers }).then((r) => r.json()),
      ]);
      if (incRes.success) setIncomeData(incRes.data);
      if (balRes.success) setBalanceData(balRes.data);
      if (cfRes.success) setCashflowData(cfRes.data);
    } catch {
      setError('Gagal memuat laporan keuangan');
    } finally {
      setReportsLoading(false);
    }
  };

  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyTenor, setApplyTenor] = useState('12');
  const [applyPurpose, setApplyPurpose] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentSize, setAttachmentSize] = useState<number>(0);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentError('');
    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('Ukuran file maksimal adalah 10 MB');
      return;
    }
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExts.includes(ext)) {
      setAttachmentError('Format file hanya boleh PDF, JPG, PNG, atau WebP');
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = readPortalToken();
      const res = await fetch('/api/v1/upload/loan-attachment', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.data?.url) {
        setAttachmentUrl(res.data.url);
        setAttachmentName(res.data.name || file.name);
        setAttachmentSize(file.size);
      } else {
        setAttachmentError(res.message || 'Gagal mengunggah file lampiran');
      }
    } catch {
      setAttachmentError('Terjadi kesalahan saat mengunggah file');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readPortalToken();
    if (!token) return;
    setApplyLoading(true);
    setApplyError('');
    setApplySuccess('');
    try {
      const numericAmount = parseFloat(applyAmount.replace(/\D/g, '')) || 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch('/api/v1/portal/loans/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: numericAmount,
          tenor: parseInt(applyTenor, 10),
          purpose: applyPurpose,
          attachmentUrl: attachmentUrl || null,
          attachmentName: attachmentName || null,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setApplySuccess(res.message || 'Pengajuan pinjaman berhasil dikirim!');
        setApplyAmount('');
        setApplyPurpose('');
        setAttachmentUrl('');
        setAttachmentName('');
        setAttachmentSize(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadData();
        setTimeout(() => {
          setShowApplyForm(false);
          setApplySuccess('');
        }, 2000);
      } else {
        setApplyError(res.message || 'Gagal mengajukan pinjaman');
      }
    } catch {
      setApplyError('Terjadi kesalahan jaringan');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleApplyWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readPortalToken();
    if (!token) return;
    setWithdrawLoading(true);
    setWithdrawError('');
    setWithdrawSuccess('');
    try {
      const numericAmount = parseFloat(withdrawAmount.replace(/\D/g, '')) || 0;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch('/api/v1/portal/savings/withdraw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: numericAmount,
          destinationBank: withdrawBank,
          destinationAccount: withdrawAccount,
          destinationName: withdrawName,
          notes: withdrawNotes || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setWithdrawSuccess(res.message || 'Pengajuan penarikan simpanan sukarela berhasil dikirim!');
        setWithdrawAmount('');
        setWithdrawNotes('');
        loadData();
        setTimeout(() => {
          setShowWithdrawForm(false);
          setWithdrawSuccess('');
        }, 3000);
      } else {
        setWithdrawError(res.message || 'Gagal mengajukan penarikan');
      }
    } catch {
      setWithdrawError('Terjadi kesalahan jaringan');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleUploadDepositProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setDepositError('Ukuran file bukti transfer maksimal 5MB');
      return;
    }

    try {
      setDepositUploadingProof(true);
      setDepositError('');
      const token = readPortalToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/upload/savings-proof', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }).then((r) => r.json());

      if (res.success && res.data) {
        setDepositProofUrl(res.data.url);
        setDepositProofName(res.data.filename || file.name);
      } else {
        setDepositError(res.message || 'Gagal mengunggah bukti transfer');
      }
    } catch {
      setDepositError('Terjadi kesalahan jaringan saat mengunggah bukti');
    } finally {
      setDepositUploadingProof(false);
    }
  };

  const handleApplyDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = readPortalToken();
    if (!token) return;

    setDepositLoading(true);
    setDepositError('');
    setDepositSuccess('');

    try {
      const numericAmount = parseFloat(depositAmount.replace(/\D/g, '')) || 0;
      if (numericAmount <= 0) {
        setDepositError('Nominal setoran harus lebih besar dari Rp 0');
        setDepositLoading(false);
        return;
      }

      const res = await fetch('/api/v1/portal/savings/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          savingsType: depositSavingsType,
          amount: numericAmount,
          transferDate: depositTransferDate,
          senderBank: depositSenderBank.trim() || undefined,
          senderAccount: depositSenderAccount.trim() || undefined,
          senderName: depositSenderName.trim() || undefined,
          proofUrl: depositProofUrl || undefined,
          proofName: depositProofName || undefined,
          notes: depositNotes.trim() || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setDepositSuccess(res.message || 'Konfirmasi setoran simpanan berhasil dikirim!');
        setDepositAmount('');
        setDepositNotes('');
        setDepositProofUrl('');
        setDepositProofName('');
        // Reset file input if present
        const fileInput = document.getElementById('deposit-proof-file') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';

        loadData();
        setTimeout(() => {
          setShowDepositForm(false);
          setDepositSuccess('');
        }, 3500);
      } else {
        setDepositError(res.message || 'Gagal mengirim konfirmasi setoran');
      }
    } catch {
      setDepositError('Terjadi kesalahan jaringan saat mengirim konfirmasi setoran');
    } finally {
      setDepositLoading(false);
    }
  };

  const clearPreviewSession = useCallback(() => {
    sessionStorage.removeItem(PREVIEW_TOKEN_KEY);
    sessionStorage.removeItem(PREVIEW_NAME_KEY);
    sessionStorage.removeItem(PREVIEW_RETURN_KEY);
  }, []);

  const exitPreview = useCallback(() => {
    const returnTo = sessionStorage.getItem(PREVIEW_RETURN_KEY) || '/members';
    clearPreviewSession();
    setMemberToken(null);
    setProfile(null);
    navigate(returnTo);
  }, [clearPreviewSession, navigate]);

  useEffect(() => {
    if (memberToken) {
      loadData();
    }
  }, [memberToken]);

  const loadData = async () => {
    const token = readPortalToken();
    if (!token) return;
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [profileRes, txRes, loansRes, withdrawalsRes, depositsRes] = await Promise.all([
        fetch('/api/v1/portal/profile', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/savings/transactions', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/loans', { headers }).then((r) => r.json()),
        fetch('/api/v1/portal/savings/withdrawals', { headers }).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/v1/portal/savings/deposits', { headers }).then((r) => r.json()).catch(() => ({ success: false, data: [] })),
      ]);

      if (profileRes.success && profileRes.data) {
        setProfile(profileRes.data);
        if (profileRes.data.isCoopMember === false) {
          setActiveTab('ewa');
        }
        if (profileRes.data.employee) {
          if (!withdrawBank && profileRes.data.employee.bankName) setWithdrawBank(profileRes.data.employee.bankName);
          if (!withdrawAccount && profileRes.data.employee.bankAccountNumber) setWithdrawAccount(profileRes.data.employee.bankAccountNumber);
          if (!withdrawName && (profileRes.data.employee.bankAccountName || profileRes.data.name)) {
            setWithdrawName(profileRes.data.employee.bankAccountName || profileRes.data.name);
          }
          if (!depositSenderName && (profileRes.data.employee.bankAccountName || profileRes.data.name)) {
            setDepositSenderName(profileRes.data.employee.bankAccountName || profileRes.data.name);
          }
        } else if (profileRes.data.name) {
          if (!withdrawName) setWithdrawName(profileRes.data.name);
          if (!depositSenderName) setDepositSenderName(profileRes.data.name);
        }
      }
      if (txRes.success) setTransactions(txRes.data || []);
      if (withdrawalsRes.success) setSavingsWithdrawals(withdrawalsRes.data || []);
      if (depositsRes?.success) setSavingsDeposits(depositsRes.data || []);
      if (loansRes.success) {
        setLoans(loansRes.data || []);
      } else if (loansRes.message) {
        setError(loansRes.message || 'Gagal memuat data pinjaman');
      }

      // Always load EWA quota info if user is employee or member
      loadEwaData();
      if (!profileRes.success) {
        setError(profileRes.message || 'Sesi berakhir, silakan masuk lagi');
        if (sessionStorage.getItem(PREVIEW_TOKEN_KEY)) {
          clearPreviewSession();
        } else {
          localStorage.removeItem('memberToken');
        }
        setMemberToken(null);
      }
    } catch {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (loan: PortalLoan) => {
    const token = readPortalToken();
    if (!token) return;
    setSelectedLoan(loan);
    setScheduleLoading(true);
    setPaymentsLoading(true);
    setSchedule([]);
    setPayments([]);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [schedRes, payRes] = await Promise.all([
        fetch(`/api/v1/portal/loans/${loan.id}/schedule`, { headers }).then((r) => r.json()),
        fetch(`/api/v1/portal/loans/${loan.id}/payments`, { headers }).then((r) => r.json()),
      ]);

      if (schedRes.success) {
        setSchedule(schedRes.data || []);
      } else {
        setError(schedRes.message || 'Gagal memuat jadwal angsuran');
      }

      if (payRes.success) {
        setPayments(payRes.data || []);
      }
    } catch {
      setError('Gagal memuat detail pinjaman');
    } finally {
      setScheduleLoading(false);
      setPaymentsLoading(false);
    }
  };

  const completeMemberLogin = useCallback(
    (token: string) => {
      clearPreviewSession();
      localStorage.setItem('memberToken', token);
      setMemberToken(token);
      setError('');
    },
    [clearPreviewSession]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Real member login should not use preview session
      clearPreviewSession();
      const res = await fetch('/api/v1/member-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());

      if (res.success) {
        completeMemberLogin(res.data.token);
      } else {
        setError(res.message || 'Login gagal');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (response: { credential: string }) => {
      setLoading(true);
      setError('');
      try {
        clearPreviewSession();
        const res = await fetch('/api/v1/member-auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ credential: response.credential }),
        }).then((r) => r.json());

        if (res.success && res.data?.token) {
          completeMemberLogin(res.data.token);
        } else {
          setError(
            res.message ||
              'Email Google tidak terdaftar sebagai akses portal. Hubungi pengurus.'
          );
        }
      } catch {
        setError('Terjadi kesalahan jaringan');
      } finally {
        setLoading(false);
      }
    },
    [clearPreviewSession, completeMemberLogin]
  );

  // Render Google Sign-In when showing the login form
  useEffect(() => {
    if (memberToken || !GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const tryRender = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !googleBtnRef.current) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(tryRender, 100);
        }
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'id',
      });
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [memberToken, handleGoogleCredential]);

  const handleLogout = () => {
    if (isPreview || sessionStorage.getItem(PREVIEW_TOKEN_KEY)) {
      exitPreview();
      return;
    }
    fetch('/api/v1/member-auth/logout', { method: 'POST' });
    localStorage.removeItem('memberToken');
    setMemberToken(null);
    setProfile(null);
    setSelectedLoan(null);
    setSchedule([]);
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--color-border-primary)',
    borderRadius: 'var(--radius-md, 6px)',
    backgroundColor: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  };

  const scheduleCols: TableColumn<ScheduleRow>[] = useMemo(
    () => [
      {
        key: 'installmentNo',
        header: 'Cicilan',
        width: pixel(80),
        renderCell: (i) => <Text type="body">#{i.installmentNo}</Text>,
      },
      {
        key: 'dueDate',
        header: 'Jatuh Tempo',
        width: pixel(120),
        renderCell: (i) => (
          <Text type="body">{new Date(i.dueDate).toLocaleDateString('id-ID')}</Text>
        ),
      },
      {
        key: 'principalAmount',
        header: 'Pokok',
        width: pixel(110),
        renderCell: (i) => formatRp(i.principalAmount),
      },
      {
        key: 'interestAmount',
        header: 'Biaya Admin',
        width: pixel(110),
        renderCell: (i) => formatRp(i.interestAmount),
      },
      {
        key: 'paidAmount',
        header: 'Sudah Bayar',
        width: pixel(120),
        renderCell: (i) => formatRp(i.paidAmount || 0),
      },
      {
        key: 'status',
        header: 'Status',
        width: pixel(100),
        renderCell: (i) => {
          const variant =
            i.status === 'Paid' ? 'success' : i.status === 'Late' ? 'critical' : 'neutral';
          const label =
            i.status === 'Paid' ? 'Lunas' : i.status === 'Late' ? 'Terlambat' : 'Belum';
          return <Badge variant={variant} label={label} />;
        },
      },
    ],
    []
  );

  const paymentCols: TableColumn<PaymentRow>[] = useMemo(
    () => [
      {
        key: 'paymentDate',
        header: 'Tanggal Bayar',
        width: pixel(160),
        renderCell: (p) => (
          <Text type="body">
            {p.paymentDate
              ? new Date(p.paymentDate).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
              : '—'}
          </Text>
        ),
      },
      {
        key: 'amount',
        header: 'Jumlah Bayar',
        width: pixel(160),
        renderCell: (p) => (
          <Text type="body" weight="semibold" color="success">
            {formatRp(p.amount)}
          </Text>
        ),
      },
      {
        key: 'method',
        header: 'Metode Pembayaran',
        width: pixel(140),
        renderCell: (p) => <Badge variant="neutral" label={p.method || 'Transfer'} />,
      },
    ],
    []
  );

  const remainingOnSchedule = useMemo(() => {
    return schedule.reduce((sum, row) => {
      const due =
        Number(row.principalAmount || 0) +
        Number(row.interestAmount || 0) +
        Number(row.lateFee || 0);
      const paid = Number(row.paidAmount || 0);
      return sum + Math.max(0, due - paid);
    }, 0);
  }, [schedule]);

  if (!memberToken) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-background-subtle)',
          padding: 16,
        }}
      >
        <Card style={{ width: '100%', maxWidth: 400, padding: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <IconButton
              label={isDark ? "Mode Terang" : "Mode Gelap"}
              icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
              variant="ghost"
              onClick={() => setMode(isDark ? 'light' : 'dark')}
            />
          </div>
          <VStack gap={6}>
            <Heading level={2} align="center">
              Portal Anggota
            </Heading>
            <Text type="body" color="secondary" align="center">
              Masuk untuk melihat simpanan, pinjaman, dan jadwal angsuran Anda.
            </Text>
            {error ? (
              <Text type="supporting" color="critical">
                {error}
              </Text>
            ) : null}

            {GOOGLE_CLIENT_ID ? (
              <VStack gap={3}>
                <div
                  ref={googleBtnRef}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    display: 'flex',
                    justifyContent: 'center',
                    opacity: loading ? 0.6 : 1,
                    pointerEvents: loading ? 'none' : 'auto',
                  }}
                />
                <Text type="supporting" color="secondary" align="center">
                  Email Google harus sama dengan email portal yang didaftarkan pengurus.
                </Text>
                <HStack gap={2} vAlign="center" style={{ width: '100%' }}>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--color-border-primary)',
                    }}
                  />
                  <Text type="supporting" color="secondary">
                    atau
                  </Text>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--color-border-primary)',
                    }}
                  />
                </HStack>
              </VStack>
            ) : null}

            <form
              onSubmit={handleLogin}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <VStack gap={2}>
                <Text type="supporting">ID Anggota / Email</Text>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </VStack>
              <VStack gap={2}>
                <Text type="supporting">Kata Sandi</Text>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  required
                />
              </VStack>
              <Button
                label={loading ? 'Memproses...' : 'Masuk'}
                type="submit"
                variant="primary"
                isDisabled={loading}
              />
            </form>

            <Text type="supporting" color="secondary" align="center">
              Pengurus koperasi?{' '}
              <a
                href="/login"
                style={{
                  color: 'var(--color-primary-500, #0171E3)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Login pengurus
              </a>
            </Text>
          </VStack>
        </Card>
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  const txCols: TableColumn<any>[] = [
    {
      key: 'createdAt',
      header: 'Tanggal',
      width: pixel(120),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID'),
    },
    {
      key: 'type',
      header: 'Jenis',
      width: pixel(160),
      renderCell: (i) => {
        const labels: Record<string, string> = {
          setor_pokok: 'Setor Simpanan Pokok',
          setor_wajib: 'Setor Simpanan Wajib',
          setor_sukarela: 'Setor Simpanan Sukarela',
          tarik_sukarela: 'Tarik Simpanan Sukarela',
          bunga: 'Jasa Simpanan',
        };
        return labels[i.type] ?? i.type?.replace(/_/g, ' ');
      },
    },
    {
      key: 'amount',
      header: 'Jumlah',
      width: pixel(150),
      renderCell: (i) => formatRp(i.amount),
    },
    {
      key: 'balanceAfter',
      header: 'Saldo Akhir',
      width: proportional(1),
      renderCell: (i) => formatRp(i.balanceAfter),
    },
  ];

  const withdrawalCols: TableColumn<any>[] = [
    {
      key: 'createdAt',
      header: 'Tgl Pengajuan',
      width: pixel(130),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    },
    {
      key: 'amount',
      header: 'Nominal Penarikan',
      width: pixel(160),
      renderCell: (i) => (
        <Text type="body" weight="bold" style={{ color: 'var(--color-critical-500, #ef4444)' }}>
          {formatRp(i.amount)}
        </Text>
      ),
    },
    {
      key: 'destinationBank',
      header: 'Rekening Tujuan',
      width: proportional(1.5),
      renderCell: (i) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">{i.destinationBank} - {i.destinationAccount}</Text>
          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
            a.n. {i.destinationName}
          </Text>
        </VStack>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (i) => {
        let variant: 'success' | 'warning' | 'critical' | 'neutral' = 'neutral';
        if (i.status === 'Menunggu') variant = 'warning';
        else if (i.status === 'Disetujui') variant = 'success';
        else if (i.status === 'Ditolak') variant = 'critical';
        return <Badge variant={variant} label={i.status} />;
      },
    },
    {
      key: 'notes',
      header: 'Keterangan',
      width: proportional(1.5),
      renderCell: (i) => {
        if (i.status === 'Ditolak' && i.rejectionReason) {
          return (
            <Text type="supporting" color="critical">
              Alasan ditolak: {i.rejectionReason}
            </Text>
          );
        }
        if (i.status === 'Disetujui' && i.approvedAt) {
          return (
            <Text type="supporting" color="success">
              Dicairkan pada {new Date(i.approvedAt).toLocaleDateString('id-ID')}
            </Text>
          );
        }
        return <Text type="supporting" color="secondary">{i.notes || '-'}</Text>;
      },
    },
  ];

  const depositCols: TableColumn<any>[] = [
    {
      key: 'transferDate',
      header: 'Tgl Transfer',
      width: pixel(120),
      renderCell: (i) => i.transferDate || '-',
    },
    {
      key: 'savingsType',
      header: 'Jenis Simpanan',
      width: pixel(150),
      renderCell: (i) => {
        let label = 'Simpanan Sukarela';
        let variant: 'primary' | 'neutral' | 'success' = 'neutral';
        if (i.savingsType === 'pokok') {
          label = 'Simpanan Pokok';
          variant = 'primary';
        } else if (i.savingsType === 'wajib') {
          label = 'Simpanan Wajib';
          variant = 'success';
        }
        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'amount',
      header: 'Nominal Setoran',
      width: pixel(150),
      renderCell: (i) => (
        <Text type="body" weight="bold" color="primary">
          {formatRp(i.amount)}
        </Text>
      ),
    },
    {
      key: 'senderBank',
      header: 'Rekening Pengirim',
      width: proportional(1.5),
      renderCell: (i) => (
        <VStack gap={0}>
          <Text type="body" weight="medium">
            {i.senderBank || '-'} {i.senderAccount ? `(${i.senderAccount})` : ''}
          </Text>
          {i.senderName && (
            <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
              a.n. {i.senderName}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: 'proofUrl',
      header: 'Bukti Transfer',
      width: pixel(130),
      renderCell: (i) => {
        if (!i.proofUrl) {
          return <Text type="supporting" color="secondary">Tanpa bukti</Text>;
        }
        return (
          <a
            href={i.proofUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--color-primary-600, #2563eb)',
              textDecoration: 'underline',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Lihat Bukti ↗
          </a>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(120),
      renderCell: (i) => {
        let variant: 'success' | 'warning' | 'critical' | 'neutral' = 'neutral';
        if (i.status === 'Menunggu') variant = 'warning';
        else if (i.status === 'Diverifikasi') variant = 'success';
        else if (i.status === 'Ditolak') variant = 'critical';
        return <Badge variant={variant} label={i.status} />;
      },
    },
    {
      key: 'notes',
      header: 'Keterangan',
      width: proportional(1.5),
      renderCell: (i) => {
        if (i.status === 'Ditolak' && i.rejectionReason) {
          return (
            <Text type="supporting" color="critical">
              Alasan ditolak: {i.rejectionReason}
            </Text>
          );
        }
        if (i.status === 'Diverifikasi' && i.verifiedAt) {
          return (
            <Text type="supporting" color="success">
              Diverifikasi pada {new Date(i.verifiedAt).toLocaleDateString('id-ID')}
            </Text>
          );
        }
        return <Text type="supporting" color="secondary">{i.notes || '-'}</Text>;
      },
    },
  ];

  const loanCols: TableColumn<PortalLoan>[] = [
    {
      key: 'createdAt',
      header: 'Tgl Pengajuan',
      width: pixel(120),
      renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID'),
    },
    { key: 'purpose', header: 'Keperluan', width: proportional(1) },
    {
      key: 'amount',
      header: 'Pokok',
      width: pixel(120),
      renderCell: (i) => formatRp(i.amount),
    },
    {
      key: 'status',
      header: 'Status',
      width: pixel(100),
      renderCell: (i) => {
        const statusMap: Record<string, { variant: 'success' | 'warning' | 'critical' | 'neutral'; label: string }> = {
          Disetujui: { variant: 'success', label: 'Disetujui' },
          Lunas: { variant: 'success', label: 'Lunas' },
          Menunggu: { variant: 'warning', label: 'Menunggu' },
          Ditolak: { variant: 'critical', label: 'Ditolak' },
          Macet: { variant: 'critical', label: 'Macet' },
        };
        const s = statusMap[i.status] || { variant: 'neutral', label: i.status };
        return <Badge variant={s.variant} label={s.label} />;
      },
    },
    {
      key: 'attachment',
      header: 'Lampiran',
      width: pixel(110),
      renderCell: (i) => i.attachmentUrl ? (
        <Button
          label="📎 Buka"
          size="sm"
          variant="secondary"
          onClick={() => window.open(i.attachmentUrl!, '_blank')}
        />
      ) : (
        <Text type="supporting" color="secondary">—</Text>
      ),
    },
    {
      key: 'actions',
      header: 'Aksi',
      width: pixel(120),
      renderCell: (i) => (
        <Button
          label={selectedLoan?.id === i.id ? 'Tutup' : 'Jadwal'}
          size="sm"
          variant={selectedLoan?.id === i.id ? 'secondary' : 'primary'}
          onClick={() => {
            if (selectedLoan?.id === i.id) {
              setSelectedLoan(null);
              setSchedule([]);
            } else {
              loadSchedule(i);
            }
          }}
        />
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background-subtle)' }}>
      <Layout
        header={
          <LayoutHeader hasDivider style={{ backgroundColor: 'var(--color-background-primary)', borderBottom: '1px solid var(--color-border-primary)' }}>
            <div style={{ padding: '16px 24px', width: '100%', boxSizing: 'border-box' }}>
              <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3} style={{ width: '100%' }}>
                <VStack gap={1}>
                  <Heading level={2} style={{ margin: 0, color: 'var(--color-text-primary)' }}>
                    Selamat Datang, {profile?.name}
                  </Heading>
                  <Text type="supporting" color="secondary">
                    {profile?.memberId ? `No. Anggota: ${profile.memberId}` : 'Portal Layanan Mandiri Anggota'}
                  </Text>
                </VStack>
                <HStack gap={2} vAlign="center">
                  <IconButton
                    label={isDark ? "Mode Terang" : "Mode Gelap"}
                    icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
                    variant="ghost"
                    onClick={() => setMode(isDark ? 'light' : 'dark')}
                  />
                  <Button
                    label={isPreview ? 'Tutup pratinjau' : 'Keluar'}
                    onClick={handleLogout}
                    variant="secondary"
                  />
                </HStack>
              </HStack>
            </div>
          </LayoutHeader>
        }
      >
        <LayoutContent padding={4}>
          <VStack gap={6}>
            {isPreview && (
              <Card
                style={{
                  padding: 16,
                  backgroundColor: 'var(--color-background-secondary)',
                  border: '1px solid var(--color-warning-500, #f59e0b)',
                }}
              >
                <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                  <VStack gap={1}>
                    <Text type="body" weight="bold">
                      Mode pratinjau admin
                    </Text>
                    <Text type="supporting" color="secondary">
                      Anda melihat portal sebagai {previewName || profile?.name || 'anggota'}.
                      Perubahan tidak disimpan ke sesi anggota. Token pratinjau berlaku ~15 menit.
                    </Text>
                  </VStack>
                  <Button label="Kembali ke Admin" variant="primary" onClick={exitPreview} />
                </HStack>
              </Card>
            )}

          {error ? (
            <Text type="supporting" color="critical">
              {error}
            </Text>
          ) : null}

          {profile?.isCoopMember !== false ? (
            <Grid gap={4}>
              <Card>
                <VStack gap={2}>
                  <Text type="supporting">Total Simpanan</Text>
                  <Heading level={2} color="primary">
                    {formatRp(profile?.totalSavings || 0)}
                  </Heading>
                </VStack>
              </Card>
              <Card>
                <VStack gap={2}>
                  <Text type="supporting">Pokok</Text>
                  <Heading level={3}>{formatRp(profile?.simpananPokok || 0)}</Heading>
                </VStack>
              </Card>
              <Card>
                <VStack gap={2}>
                  <Text type="supporting">Wajib</Text>
                  <Heading level={3}>{formatRp(profile?.simpananWajib || 0)}</Heading>
                </VStack>
              </Card>
              <Card>
                <VStack gap={2}>
                  <HStack justify="space-between" vAlign="center">
                    <Text type="supporting">Sukarela</Text>
                    {(profile?.simpananSukarela || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('savings');
                          setShowWithdrawForm(true);
                          setWithdrawError('');
                          setWithdrawSuccess('');
                        }}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--color-primary-600, #2563eb)',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        + Tarik Dana
                      </button>
                    )}
                  </HStack>
                  <Heading level={3}>{formatRp(profile?.simpananSukarela || 0)}</Heading>
                </VStack>
              </Card>
            </Grid>
          ) : (
            <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-primary-500, #3b82f6)' }}>
              <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                <VStack gap={1}>
                  <HStack gap={2} vAlign="center">
                    <Badge variant="info" label="Karyawan Perusahaan Induk" />
                    <Badge variant="neutral" label="Non-Anggota Koperasi" />
                  </HStack>
                  <Heading level={3} style={{ margin: 0 }}>
                    Fasilitas Akses Gaji Awal (EWA)
                  </Heading>
                  <Text type="supporting" color="secondary">
                    Fasilitas kasbon penarikan gaji lebih awal untuk karyawan aktif • Plafon Maks. Sebulan: {formatRp(ewaQuota?.maxMonthlyLimit || 0)}
                  </Text>
                </VStack>
                <Card style={{ padding: '8px 16px', backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
                  <VStack gap={0} hAlign="center">
                    <Text type="supporting" size="sm">Sisa Kuota Tarik Bulan Ini</Text>
                    <Heading level={3} color="primary">{formatRp(ewaQuota?.remainingQuota || 0)}</Heading>
                  </VStack>
                </Card>
              </HStack>
            </Card>
          )}

          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              backgroundColor: 'var(--color-background-secondary)',
              borderRadius: 'var(--radius-lg, 8px)',
              border: '1px solid var(--color-border-primary)',
              gap: 4,
              width: 'fit-content',
              flexWrap: 'wrap',
            }}
          >
            {[
              ...(profile?.isCoopMember !== false
                ? [
                    { id: 'savings' as const, label: 'Simpanan', icon: BanknotesIcon },
                    { id: 'loans' as const, label: 'Pinjaman', icon: ClipboardDocumentCheckIcon },
                  ]
                : []),
              { id: 'ewa' as const, label: 'Gaji Awal (EWA)', icon: BanknotesIcon },
              ...(profile?.isCoopMember !== false
                ? [
                    { id: 'reports' as const, label: 'Laporan Keuangan', icon: ChartBarIcon },
                  ]
                : []),
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === 'savings') setSelectedLoan(null);
                    if (tab.id === 'reports' && (!incomeData || !balanceData)) {
                      loadReports();
                    }
                    if (tab.id === 'ewa' && !ewaQuota) {
                      loadEwaData();
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isActive
                      ? 'var(--color-background-primary)'
                      : 'transparent',
                    color: isActive
                      ? 'var(--color-primary-500, var(--color-text-primary))'
                      : 'var(--color-text-secondary)',
                    boxShadow: isActive
                      ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                      : 'none',
                  }}
                >
                  <tab.icon style={{ width: 18, height: 18, color: 'currentColor' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <Card>
            <VStack gap={4}>
              <HStack justify="space-between" vAlign="center">
                <Heading level={4}>
                  {activeTab === 'savings'
                    ? 'Riwayat Simpanan'
                    : activeTab === 'loans'
                    ? 'Daftar Pinjaman'
                    : activeTab === 'ewa'
                    ? 'Layanan Gaji Awal (EWA)'
                    : 'Ringkasan Laporan Keuangan Koperasi'}
                </Heading>
                {activeTab === 'loans' && (
                  <Button
                    label={showApplyForm ? 'Tutup Formulir' : '+ Ajukan Pinjaman Baru'}
                    variant={showApplyForm ? 'ghost' : 'primary'}
                    onClick={() => {
                      setShowApplyForm(!showApplyForm);
                      setApplyError('');
                      setApplySuccess('');
                    }}
                  />
                )}
                {activeTab === 'savings' && (
                  <HStack gap={2} wrap="wrap">
                    <Button
                      label={showDepositForm ? 'Tutup Form Setoran' : '+ Konfirmasi Setoran Transfer'}
                      variant={showDepositForm ? 'ghost' : 'primary'}
                      onClick={() => {
                        setShowDepositForm(!showDepositForm);
                        setShowWithdrawForm(false);
                        setDepositError('');
                        setDepositSuccess('');
                      }}
                    />
                    <Button
                      label={showWithdrawForm ? 'Tutup Form Penarikan' : 'Tarik Simpanan Sukarela'}
                      variant={showWithdrawForm ? 'ghost' : 'secondary'}
                      onClick={() => {
                        setShowWithdrawForm(!showWithdrawForm);
                        setShowDepositForm(false);
                        setWithdrawError('');
                        setWithdrawSuccess('');
                      }}
                      isDisabled={(profile?.simpananSukarela || 0) <= 0}
                    />
                  </HStack>
                )}
              </HStack>

              {activeTab === 'loans' && showApplyForm && (
                <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
                  <form onSubmit={handleApplyLoan} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Heading level={4}>Formulir Pengajuan Pinjaman Baru</Heading>

                    {applyError ? (
                      <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>
                        ⚠️ {applyError}
                      </Text>
                    ) : null}

                    {applySuccess ? (
                      <Text type="supporting" color="success" style={{ fontWeight: 600 }}>
                        ✅ {applySuccess}
                      </Text>
                    ) : null}

                    <Grid gap={4}>
                      <VStack gap={2}>
                        <Text type="supporting">Nominal Pinjaman (Rp)</Text>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Contoh: 5.000.000"
                          value={applyAmount}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setApplyAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
                          }}
                          style={inputStyle}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting">Tenor (Bulan)</Text>
                        <select
                          value={applyTenor}
                          onChange={(e) => setApplyTenor(e.target.value)}
                          style={inputStyle}
                          required
                        >
                          {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={String(m)}>
                              {m} Bulan{m === 12 ? ' (1 Tahun)' : m === 24 ? ' (2 Tahun)' : ''}
                            </option>
                          ))}
                        </select>
                      </VStack>
                    </Grid>

                    <VStack gap={2}>
                      <Text type="supporting">Keperluan / Tujuan Pinjaman</Text>
                      <textarea
                        rows={3}
                        placeholder="Jelaskan keperluan pengajuan pinjaman (contoh: Biaya pendidikan, Renovasi rumah, Modal usaha)"
                        value={applyPurpose}
                        onChange={(e) => setApplyPurpose(e.target.value)}
                        style={inputStyle}
                        required
                      />
                    </VStack>

                    {/* Lampiran Dokumen Pendukung */}
                    <VStack gap={2}>
                      <HStack justify="space-between" vAlign="center">
                        <Text type="supporting">Lampiran Dokumen Pendukung (Opsional)</Text>
                        <Text type="supporting" size="sm" color="secondary">
                          PDF, JPG, PNG (Maks. 10 MB)
                        </Text>
                      </HStack>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="loan-attachment-input"
                      />

                      {!attachmentUrl ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            border: '2px dashed var(--color-border-primary)',
                            borderRadius: '8px',
                            padding: '16px',
                            textAlign: 'center',
                            cursor: uploadingAttachment ? 'wait' : 'pointer',
                            backgroundColor: 'var(--color-background-primary)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <VStack gap={1} vAlign="center">
                            <Text type="body" weight="semibold">
                              {uploadingAttachment ? '⏳ Sedang mengunggah file...' : '📎 Klik untuk Unggah Dokumen / Foto Pendukung'}
                            </Text>
                            <Text type="supporting" size="sm" color="secondary">
                              Contoh: Slip Gaji, Foto KTP, Invoice / Rencana Anggaran Biaya, Surat Permohonan
                            </Text>
                          </VStack>
                        </div>
                      ) : (
                        <Card style={{ padding: 12, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
                          <HStack justify="space-between" vAlign="center" wrap="wrap" gap={2}>
                            <HStack vAlign="center" gap={2}>
                              <span style={{ fontSize: '24px' }}>
                                {attachmentName.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                              </span>
                              <VStack gap={0}>
                                <Text type="body" weight="bold">{attachmentName}</Text>
                                <Text type="supporting" size="sm" color="secondary">
                                  {attachmentSize ? `${(attachmentSize / (1024 * 1024)).toFixed(2)} MB • ` : ''}
                                  Lampiran siap dikirim
                                </Text>
                              </VStack>
                            </HStack>
                            <HStack gap={2}>
                              <Button
                                label="Lihat File"
                                size="sm"
                                variant="secondary"
                                type="button"
                                onClick={() => window.open(attachmentUrl, '_blank')}
                              />
                              <Button
                                label="Hapus"
                                size="sm"
                                variant="ghost"
                                type="button"
                                onClick={() => {
                                  setAttachmentUrl('');
                                  setAttachmentName('');
                                  setAttachmentSize(0);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                              />
                            </HStack>
                          </HStack>
                        </Card>
                      )}

                      {attachmentError && (
                        <Text type="supporting" color="critical" style={{ fontWeight: 500 }}>
                          ⚠️ {attachmentError}
                        </Text>
                      )}
                    </VStack>

                    {/* Estimasi Simulasi */}
                    {parseFloat(applyAmount.replace(/\D/g, '')) > 0 && (
                      <Card style={{ padding: 16, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
                        <VStack gap={2}>
                          <HStack justify="space-between" vAlign="center" wrap="wrap" gap={2}>
                            <Text type="supporting" color="secondary">
                              Estimasi Angsuran Per Bulan
                            </Text>
                          </HStack>
                          <HStack justify="space-between" vAlign="baseline" wrap="wrap" gap={2}>
                            <VStack gap={0}>
                              <Heading level={3} color="primary">
                                {(() => {
                                  const P = parseFloat(applyAmount.replace(/\D/g, '')) || 0;
                                  const n = parseInt(applyTenor, 10) || 12;
                                  const annualRate = Number(profile?.loanInterestRate ?? 9.1);
                                  if (annualRate <= 0) return formatRp(Math.ceil(P / n));
                                  const i = annualRate / 1200;
                                  const power = Math.pow(1 + i, n);
                                  const pmt = Math.ceil((P * (i * power)) / (power - 1));
                                  return formatRp(pmt);
                                })()}
                                <Text type="supporting" color="secondary" style={{ display: 'inline', marginLeft: 6 }}>/ bulan</Text>
                              </Heading>
                            </VStack>
                            <Text type="supporting" size="sm" color="secondary">
                              Total Pengembalian: {(() => {
                                const P = parseFloat(applyAmount.replace(/\D/g, '')) || 0;
                                const n = parseInt(applyTenor, 10) || 12;
                                const annualRate = Number(profile?.loanInterestRate ?? 9.1);
                                if (annualRate <= 0) return formatRp(P);
                                const i = annualRate / 1200;
                                const power = Math.pow(1 + i, n);
                                const pmt = Math.ceil((P * (i * power)) / (power - 1));
                                return formatRp(pmt * n);
                              })()} (Tenor {applyTenor} Bulan)
                            </Text>
                          </HStack>
                        </VStack>
                      </Card>
                    )}

                    <HStack gap={3} justify="end">
                      <Button
                        label="Batal"
                        variant="ghost"
                        type="button"
                        onClick={() => setShowApplyForm(false)}
                        isDisabled={applyLoading}
                      />
                      <Button
                        label={applyLoading ? 'Mengirim...' : 'Kirim Pengajuan'}
                        variant="primary"
                        type="submit"
                        isDisabled={applyLoading}
                      />
                    </HStack>
                  </form>
                </Card>
              )}

              {activeTab === 'savings' && showDepositForm && (
                <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
                  <form onSubmit={handleApplyDeposit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <VStack gap={1}>
                      <Heading level={4}>Konfirmasi Setoran Simpanan (Transfer Bank)</Heading>
                      <Text type="supporting" color="secondary">
                        Gunakan formulir ini untuk mengonfirmasi setoran yang telah Anda transfer ke rekening {profile?.coopBank?.bankName || 'Bank Mandiri'} resmi koperasi ({profile?.coopBank?.accountNumber || '1060022716008'}). Setoran akan diverifikasi oleh bendahara dan otomatis dibukukan ke saldo simpanan Anda.
                      </Text>
                    </VStack>

                    {depositError && (
                      <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>
                        ⚠️ {depositError}
                      </Text>
                    )}

                    {depositSuccess && (
                      <Text type="supporting" color="success" style={{ fontWeight: 600 }}>
                        ✅ {depositSuccess}
                      </Text>
                    )}

                    {/* Info Rekening Bank Resmi Koperasi */}
                    <Card style={{ padding: 14, backgroundColor: 'rgba(37, 99, 235, 0.05)', border: '1px solid var(--color-primary-200, #bfdbfe)' }}>
                      <VStack gap={2}>
                        <Text type="supporting" weight="bold" color="primary">
                          🏦 Rekening Tujuan Transfer Koperasi:
                        </Text>
                        <HStack justify="space-between" vAlign="center" wrap="wrap" gap={2}>
                          <VStack gap={0}>
                            <Text type="body" weight="bold">
                              {profile?.coopBank?.bankName || 'Bank Mandiri'}: {profile?.coopBank?.accountNumber || '1060022716008'}
                            </Text>
                            <Text type="supporting" color="secondary">
                              a.n. {profile?.coopBank?.accountName || 'Koperasi Jasa Nusa Sejahtera Prima'}
                            </Text>
                          </VStack>
                          <Text type="supporting" size="sm" color="secondary">
                            Pastikan nominal transfer sesuai dengan mutasi rekening.
                          </Text>
                        </HStack>
                      </VStack>
                    </Card>

                    <Grid gap={4}>
                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Jenis Simpanan:</Text>
                        <select
                          value={depositSavingsType}
                          onChange={(e) => setDepositSavingsType(e.target.value as any)}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          <option
                            value="pokok"
                            disabled={(profile?.simpananPokok || 0) >= 500000}
                          >
                            Simpanan Pokok {(profile?.simpananPokok || 0) >= 500000 ? '(Sudah Lunas Rp 500.000)' : `(Sisa: ${formatRp(500000 - (profile?.simpananPokok || 0))})`}
                          </option>
                          <option value="wajib">Simpanan Wajib</option>
                          <option value="sukarela">Simpanan Sukarela</option>
                        </select>
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nominal Setoran (Rp):</Text>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Contoh: 100.000"
                          value={depositAmount}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setDepositAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
                          }}
                          style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Tanggal Transfer:</Text>
                        <input
                          type="date"
                          value={depositTransferDate}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setDepositTransferDate(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Bank Pengirim (Opsional):</Text>
                        <input
                          type="text"
                          placeholder="Contoh: Bank Mandiri / BCA / BRI"
                          value={depositSenderBank}
                          onChange={(e) => setDepositSenderBank(e.target.value)}
                          style={inputStyle}
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nomor Rekening Pengirim (Opsional):</Text>
                        <input
                          type="text"
                          placeholder="Contoh: 1234567890"
                          value={depositSenderAccount}
                          onChange={(e) => setDepositSenderAccount(e.target.value)}
                          style={inputStyle}
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nama Pemilik Rekening Pengirim (Opsional):</Text>
                        <input
                          type="text"
                          placeholder="Nama pengirim sesuai rekening"
                          value={depositSenderName}
                          onChange={(e) => setDepositSenderName(e.target.value)}
                          style={inputStyle}
                        />
                      </VStack>
                    </Grid>

                    {/* Bukti Transfer (Opsional) */}
                    <VStack gap={2}>
                      <Text type="supporting" weight="semibold">
                        Unggah Bukti Transfer / Resi ATM / Tangkapan Layar (Opsional):
                      </Text>
                      <HStack gap={3} vAlign="center" wrap="wrap">
                        <input
                          type="file"
                          id="deposit-proof-file"
                          accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                          onChange={handleUploadDepositProof}
                          disabled={depositUploadingProof}
                          style={{ fontSize: 14 }}
                        />
                        {depositUploadingProof && (
                          <HStack gap={1} vAlign="center">
                            <Spinner size="sm" />
                            <Text type="supporting" color="secondary">Mengunggah file...</Text>
                          </HStack>
                        )}
                        {depositProofUrl && !depositUploadingProof && (
                          <HStack gap={2} vAlign="center">
                            <Text type="supporting" color="success" weight="medium">
                              ✓ Bukti terunggah: {depositProofName}
                            </Text>
                            <button
                              type="button"
                              onClick={() => {
                                setDepositProofUrl('');
                                setDepositProofName('');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-critical-500, #ef4444)',
                                cursor: 'pointer',
                                fontSize: 12,
                                textDecoration: 'underline',
                              }}
                            >
                              Hapus
                            </button>
                          </HStack>
                        )}
                      </HStack>
                      <Text type="supporting" size="sm" color="secondary">
                        Format: JPG, PNG, WEBP, atau PDF. Maksimal 5MB. Unggah bukti bersifat opsional namun membantu mempercepat verifikasi bendahara.
                      </Text>
                    </VStack>

                    <VStack gap={2}>
                      <Text type="supporting">Catatan Tambahan (Opsional):</Text>
                      <input
                        type="text"
                        placeholder="Contoh: Setoran simpanan wajib bulan September 2026"
                        value={depositNotes}
                        onChange={(e) => setDepositNotes(e.target.value)}
                        style={inputStyle}
                      />
                    </VStack>

                    <HStack justify="flex-end" gap={2}>
                      <Button
                        label="Batal"
                        variant="ghost"
                        onClick={() => setShowDepositForm(false)}
                        isDisabled={depositLoading || depositUploadingProof}
                      />
                      <Button
                        label={depositLoading ? 'Mengirim Konfirmasi...' : 'Kirim Konfirmasi Setoran'}
                        variant="primary"
                        type="submit"
                        isDisabled={depositLoading || depositUploadingProof}
                      />
                    </HStack>
                  </form>
                </Card>
              )}

              {activeTab === 'savings' && showWithdrawForm && (
                <Card style={{ padding: 20, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
                  <form onSubmit={handleApplyWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <VStack gap={1}>
                      <Heading level={4}>Formulir Pengajuan Penarikan Simpanan Sukarela</Heading>
                      <Text type="supporting" color="secondary">
                        Simpanan sukarela dapat ditarik sewaktu-waktu sesuai saldo yang tersedia. Dana yang disetujui akan ditransfer langsung ke rekening bank tujuan Anda oleh bagian kasir/keuangan koperasi.
                      </Text>
                    </VStack>

                    {withdrawError && (
                      <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>
                        ⚠️ {withdrawError}
                      </Text>
                    )}

                    {withdrawSuccess && (
                      <Text type="supporting" color="success" style={{ fontWeight: 600 }}>
                        ✅ {withdrawSuccess}
                      </Text>
                    )}

                    {/* Saldo Sukarela Card & Quick Percentage Presets */}
                    <Card style={{ padding: 12, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
                      <HStack justify="space-between" vAlign="center" wrap="wrap" gap={2}>
                        <VStack gap={0}>
                          <Text type="supporting" color="secondary" style={{ fontSize: 12 }}>
                            Saldo Simpanan Sukarela Tersedia:
                          </Text>
                          <Heading level={3} color="primary">
                            {formatRp(profile?.simpananSukarela || 0)}
                          </Heading>
                        </VStack>
                        <HStack gap={1} wrap="wrap">
                          {[
                            { label: '25%', ratio: 0.25 },
                            { label: '50%', ratio: 0.5 },
                            { label: '75%', ratio: 0.75 },
                            { label: 'Tarik Semua (100%)', ratio: 1.0 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const current = Number(profile?.simpananSukarela || 0);
                                const val = Math.floor(current * preset.ratio);
                                setWithdrawAmount(val > 0 ? val.toLocaleString('id-ID') : '');
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 4,
                                border: '1px solid var(--color-border-primary, #d1d5db)',
                                backgroundColor: 'var(--color-background-secondary, #f3f4f6)',
                                cursor: 'pointer',
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </HStack>
                      </HStack>
                    </Card>

                    <Grid gap={4}>
                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nominal Penarikan (Rp):</Text>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Contoh: 500.000"
                          value={withdrawAmount}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setWithdrawAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
                          }}
                          style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nama Bank Tujuan:</Text>
                        <input
                          type="text"
                          placeholder="Contoh: Bank Mandiri / BCA / BRI"
                          value={withdrawBank}
                          onChange={(e) => setWithdrawBank(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nomor Rekening Tujuan:</Text>
                        <input
                          type="text"
                          placeholder="Contoh: 1234567890"
                          value={withdrawAccount}
                          onChange={(e) => setWithdrawAccount(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>

                      <VStack gap={2}>
                        <Text type="supporting" weight="semibold">Nama Pemilik Rekening:</Text>
                        <input
                          type="text"
                          placeholder="Nama lengkap sesuai buku tabungan"
                          value={withdrawName}
                          onChange={(e) => setWithdrawName(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </VStack>
                    </Grid>

                    <VStack gap={2}>
                      <Text type="supporting">Catatan / Keperluan (Opsional):</Text>
                      <input
                        type="text"
                        placeholder="Contoh: Kebutuhan keluarga mendesak"
                        value={withdrawNotes}
                        onChange={(e) => setWithdrawNotes(e.target.value)}
                        style={inputStyle}
                      />
                    </VStack>

                    <HStack justify="flex-end" gap={2}>
                      <Button
                        label="Batal"
                        variant="ghost"
                        onClick={() => setShowWithdrawForm(false)}
                        isDisabled={withdrawLoading}
                      />
                      <Button
                        label={withdrawLoading ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Penarikan'}
                        variant="primary"
                        type="submit"
                        isDisabled={withdrawLoading}
                      />
                    </HStack>
                  </form>
                </Card>
              )}

              {activeTab === 'savings' ? (
                <VStack gap={5}>
                  {/* Status Konfirmasi Setoran Simpanan (Transfer Masuk) */}
                  {savingsDeposits.length > 0 && (
                    <VStack gap={2}>
                      <HStack justify="space-between" vAlign="center">
                        <Text type="body" weight="bold">
                          Riwayat Konfirmasi Setoran Simpanan (Transfer Bank)
                        </Text>
                        <Badge
                          variant={savingsDeposits.some((d) => d.status === 'Menunggu') ? 'warning' : 'neutral'}
                          label={`${savingsDeposits.filter((d) => d.status === 'Menunggu').length} Menunggu`}
                        />
                      </HStack>
                      <Table data={savingsDeposits} columns={depositCols} idKey="id" density="balanced" />
                    </VStack>
                  )}

                  {/* Status Permohonan Penarikan Sukarela */}
                  {savingsWithdrawals.length > 0 && (
                    <VStack gap={2}>
                      <HStack justify="space-between" vAlign="center">
                        <Text type="body" weight="bold">
                          Riwayat Pengajuan Penarikan Simpanan Sukarela
                        </Text>
                        <Badge
                          variant={savingsWithdrawals.some((w) => w.status === 'Menunggu') ? 'warning' : 'neutral'}
                          label={`${savingsWithdrawals.filter((w) => w.status === 'Menunggu').length} Menunggu`}
                        />
                      </HStack>
                      <Table data={savingsWithdrawals} columns={withdrawalCols} idKey="id" density="balanced" />
                    </VStack>
                  )}

                  {/* Mutasi Simpanan */}
                  <VStack gap={2}>
                    <Text type="body" weight="bold">
                      Buku Mutasi Simpanan
                    </Text>
                    {transactions.length > 0 ? (
                      <Table data={transactions} columns={txCols} idKey="id" density="balanced" />
                    ) : (
                      <Text type="supporting">Belum ada transaksi</Text>
                    )}
                  </VStack>
                </VStack>
              ) : activeTab === 'ewa' ? (
                ewaLoading ? (
                  <Spinner size="md" />
                ) : (
                  <VStack gap={6}>
                    {/* EWA Header Info & Non-Member Conversion Banner */}
                    {!profile?.isCoopMember && (
                      <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-warning-500, #f59e0b)' }}>
                        <HStack justify="space-between" vAlign="center" wrap="wrap" gap={3}>
                          <VStack gap={1}>
                            <Text type="body" weight="bold">
                              💡 Hemat Biaya Layanan & Dapatkan SHU!
                            </Text>
                            <Text type="supporting" color="secondary">
                              Tarif biaya admin EWA untuk Anggota Koperasi lebih hemat (mulai dari Rp 10.000 flat) dibandingkan bukan anggota. Bergabunglah menjadi Anggota Koperasi untuk menikmati tarif hemat serta pembagian Sisa Hasil Usaha (SHU) setiap tahun.
                            </Text>
                          </VStack>
                          <Button
                            label="Hubungi Pengurus Koperasi"
                            variant="secondary"
                            onClick={() => alert('Silakan hubungi bagian HRD / Pengurus Koperasi untuk formulir pendaftaran anggota baru.')}
                          />
                        </HStack>
                      </Card>
                    )}

                    {/* Alert jika Kontrak Berakhir / Tidak Eligible */}
                    {ewaQuota?.isEligible === false && (
                      <Card style={{ padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444' }}>
                        <HStack gap={3} vAlign="center">
                          <VStack gap={1}>
                            <Text type="body" weight="bold" color="critical">
                              ⚠️ Pengajuan EWA Tidak Tersedia
                            </Text>
                            <Text type="supporting" color="critical">
                              {ewaQuota?.ineligibilityReason || 'Masa kontrak kerja Anda telah berakhir atau status kepegawaian tidak aktif.'}
                            </Text>
                          </VStack>
                        </HStack>
                      </Card>
                    )}

                    {/* Kuota Grid */}
                    <Grid gap={4}>
                      <Card style={{ padding: 16 }}>
                        <VStack gap={1}>
                          <Text type="supporting">
                            Plafon Hari Ini (Hari {ewaQuota?.currentDayInCycle || 1}/{ewaQuota?.totalDaysInCycle || 31})
                          </Text>
                          <Heading level={3}>{formatRp(ewaQuota?.dailyAccumulatedLimit ?? ewaQuota?.maxMonthlyLimit ?? 0)}</Heading>
                          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                            {ewaQuota?.cycleStartDate && ewaQuota?.cycleEndDate
                              ? `Siklus: ${ewaQuota.cycleStartDate} s/d ${ewaQuota.cycleEndDate}`
                              : `Plafon Maks Sebulan: ${formatRp(ewaQuota?.maxMonthlyLimit || 0)}`}
                          </Text>
                        </VStack>
                      </Card>
                      <Card style={{ padding: 16 }}>
                        <VStack gap={1}>
                          <Text type="supporting">Sudah Ditarik Siklus Ini</Text>
                          <Heading level={3}>{formatRp(ewaQuota?.totalUsedThisMonth || 0)}</Heading>
                          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                            Total penarikan periode aktif
                          </Text>
                        </VStack>
                      </Card>
                      <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)' }}>
                        <VStack gap={1}>
                          <Text type="supporting">Sisa Kuota Hari Ini</Text>
                          <Heading level={3} color="primary">{formatRp(ewaQuota?.remainingQuota || 0)}</Heading>
                          <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>
                            Maksimal penarikan hari ini
                          </Text>
                        </VStack>
                      </Card>
                    </Grid>

                    {/* Form Pengajuan EWA */}
                    <Card style={{ padding: 20, border: '1px solid var(--color-border-primary)' }}>
                      <form onSubmit={handleApplyEwa} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <VStack gap={1}>
                          <Heading level={4}>Formulir Tarik Gaji Lebih Awal (Kasbon)</Heading>
                          <Text type="supporting" color="secondary">
                            Dana yang ditarik akan langsung ditransfer ke rekening bank Anda dan dipotong otomatis pada payroll gajian berikutnya. Limit bertambah secara progresif setiap hari seiring berjalannya hari kerja.
                          </Text>
                        </VStack>

                        {ewaError && (
                          <Text type="supporting" color="critical" style={{ fontWeight: 600 }}>
                            ⚠️ {ewaError}
                          </Text>
                        )}
                        {ewaSuccess && (
                          <Text type="supporting" color="success" style={{ fontWeight: 600 }}>
                            ✅ {ewaSuccess}
                          </Text>
                        )}

                        {/* Input Nominal Penarikan */}
                        <VStack gap={2}>
                          <Text type="supporting" weight="semibold">Nominal Penarikan (Rp):</Text>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Contoh: 500.000"
                            value={ewaAmount}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              setEwaAmount(digits ? Number(digits).toLocaleString('id-ID') : '');
                            }}
                            style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
                            required
                          />
                          <Text type="supporting" size="sm" color="secondary">
                            Maksimal penarikan hari ini: <b>{formatRp(ewaQuota?.remainingQuota || 0)}</b> ({ewaQuota?.cycleStartDate && ewaQuota?.cycleEndDate ? `Siklus ${ewaQuota.cycleStartDate} s/d ${ewaQuota.cycleEndDate}` : ''})
                          </Text>
                        </VStack>

                        {/* Info Rekening Payroll Tujuan Pencairan */}
                        <Card style={{ padding: 14, backgroundColor: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}>
                          <VStack gap={2}>
                            <HStack justify="space-between" vAlign="center" wrap="wrap" gap={2}>
                              <Text type="supporting" weight="semibold">Rekening Payroll Tujuan Pencairan:</Text>
                              <Badge variant="neutral" size="sm" label="Rekening Resmi Payroll" />
                            </HStack>
                            <HStack gap={4} wrap="wrap">
                              <VStack gap={0}>
                                <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>Bank</Text>
                                <Text type="body" weight="medium">{ewaQuota?.employee?.bankName || 'Bank Mandiri'}</Text>
                              </VStack>
                              <VStack gap={0}>
                                <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>Nomor Rekening</Text>
                                <Text type="body" weight="semibold">{ewaQuota?.employee?.bankAccountNumber || '-'}</Text>
                              </VStack>
                              <VStack gap={0}>
                                <Text type="supporting" color="secondary" style={{ fontSize: 11 }}>Nama Pemilik Rekening</Text>
                                <Text type="body" weight="medium">{ewaQuota?.employee?.bankAccountName || ewaQuota?.employee?.name || profile?.name || '-'}</Text>
                              </VStack>
                            </HStack>
                          </VStack>
                        </Card>

                        {/* Simulasi Live Fee & Potongan */}
                        {parseFloat(ewaAmount.replace(/\D/g, '')) > 0 && (() => {
                          const numericAmount = parseFloat(ewaAmount.replace(/\D/g, '')) || 0;
                          const isMember = Boolean(ewaQuota?.isMember ?? profile?.isCoopMember);
                          const matchedTier = feeTiers.find((t) => {
                            if (numericAmount < t.minAmount) return false;
                            if (t.maxAmount != null && numericAmount > t.maxAmount) return false;
                            return true;
                          });

                          const feeAmount = matchedTier
                            ? (isMember ? matchedTier.memberFee : matchedTier.nonMemberFee)
                            : Math.round((numericAmount * (isMember ? 2 : 3.5)) / 100);

                          const tierLabel = matchedTier
                            ? `Tier ${matchedTier.tierOrder} (${formatRp(matchedTier.minAmount)} s/d ${matchedTier.maxAmount != null ? formatRp(matchedTier.maxAmount) : 'Diatasnya'})`
                            : `${isMember ? '2.0%' : '3.5%'}`;

                          const totalDeduction = numericAmount + feeAmount;

                          return (
                            <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)' }}>
                              <VStack gap={2}>
                                <Text type="body" weight="bold">Rincian & Simulasi Potongan Gaji</Text>
                                <HStack justify="space-between" wrap="wrap" gap={2}>
                                  <Text type="supporting">Nominal Dana Yang Diterima:</Text>
                                  <Text type="body" weight="semibold" color="success">+{formatRp(numericAmount)}</Text>
                                </HStack>
                                <HStack justify="space-between" wrap="wrap" gap={2}>
                                  <Text type="supporting">Biaya Admin ({tierLabel}):</Text>
                                  <Text type="supporting">{formatRp(feeAmount)}</Text>
                                </HStack>
                                <HStack justify="space-between" wrap="wrap" gap={2} style={{ paddingTop: 6, borderTop: '1px solid var(--color-border-primary)' }}>
                                  <Text type="body" weight="bold">Total Potongan Gaji Saat Payroll:</Text>
                                  <Text type="body" weight="bold" color="primary">
                                    {formatRp(totalDeduction)}
                                  </Text>
                                </HStack>
                              </VStack>
                            </Card>
                          );
                        })()}

                        <HStack justify="end" gap={3}>
                          <Button
                            label={ewaSubmitLoading ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Tarik Gaji'}
                            variant="primary"
                            type="submit"
                            isDisabled={
                              ewaSubmitLoading ||
                              ewaQuota?.isEligible === false ||
                              !parseFloat(ewaAmount.replace(/\D/g, '')) ||
                              parseFloat(ewaAmount.replace(/\D/g, '')) > (ewaQuota?.remainingQuota || 0)
                            }
                          />
                        </HStack>
                      </form>
                    </Card>

                    {/* Riwayat Penarikan EWA */}
                    <VStack gap={3}>
                      <Heading level={4}>Riwayat Penarikan Gaji Awal Anda</Heading>
                      {ewaHistory.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid var(--color-border-primary)' }}>
                                <th style={{ padding: '10px 12px' }}>Tanggal</th>
                                <th style={{ padding: '10px 12px' }}>Rekening Tujuan</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Nominal Cair</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Fee Layanan</th>
                                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Potong Payroll</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ewaHistory.map((h: any) => (
                                <tr key={h.id} style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                                  <td style={{ padding: '10px 12px' }}>
                                    {new Date(h.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>{h.destinationBank} ({h.destinationAccount})</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary-500)' }}>
                                    {formatRp(h.disbursedAmount)}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatRp(h.feeAmount)} ({h.feePercentage}%)</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                                    {formatRp(h.totalPayrollDeduction)}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    {(() => {
                                      const statusMap: Record<string, { label: string; variant: 'info' | 'success' | 'critical' | 'warning' }> = {
                                        PENDING: { label: 'Menunggu Cair', variant: 'warning' },
                                        DISBURSED: { label: 'Sudah Cair', variant: 'info' },
                                        PAID_SETTLED: { label: 'Lunas Payroll', variant: 'success' },
                                        REJECTED: { label: 'Ditolak', variant: 'critical' },
                                      };
                                      const st = statusMap[h.status] || { label: h.status, variant: 'neutral' as const };
                                      return (
                                        <VStack gap={1} hAlign="center">
                                          <Badge variant={st.variant} label={st.label} size="sm" />
                                          {h.status === 'REJECTED' && h.rejectionReason && (
                                            <Text type="supporting" color="critical" style={{ fontSize: 11 }}>
                                              Alasan: {h.rejectionReason}
                                            </Text>
                                          )}
                                        </VStack>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Text type="supporting" color="secondary">Belum ada riwayat penarikan EWA</Text>
                      )}
                    </VStack>
                  </VStack>
                )
              ) : activeTab === 'reports' ? (
                reportsLoading ? (
                  <Spinner size="md" />
                ) : (
                  <VStack gap={6}>
                    {/* Laporan Laba Rugi */}
                    <VStack gap={3}>
                      <Heading level={4}>1. Laporan Laba Rugi (Income Statement)</Heading>
                      <Grid gap={4}>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Pendapatan</Text>
                            <Heading level={3} color="primary">{formatRp(incomeData?.totalRevenue || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Beban Operasional</Text>
                            <Heading level={3}>{formatRp(incomeData?.totalExpense || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">SHU / Laba Bersih Tahun Berjalan</Text>
                            <Heading level={3} color="primary">{formatRp(incomeData?.netIncome || 0)}</Heading>
                          </VStack>
                        </Card>
                      </Grid>
                    </VStack>

                    {/* Laporan Neraca */}
                    <VStack gap={3}>
                      <Heading level={4}>2. Laporan Neraca Koperasi (Balance Sheet)</Heading>
                      <Grid gap={4}>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Aset Koperasi</Text>
                            <Heading level={3} color="primary">{formatRp(balanceData?.totalAssets || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Kewajiban / Liabilitas</Text>
                            <Heading level={3}>{formatRp(balanceData?.totalLiabilities || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Ekuitas / Modal</Text>
                            <Heading level={3}>{formatRp(balanceData?.totalEquity || 0)}</Heading>
                          </VStack>
                        </Card>
                      </Grid>

                      {/* Ringkasan Neraca */}
                      <Card style={{ padding: 16, backgroundColor: 'var(--color-background-secondary)', border: '1px solid var(--color-border-primary)' }}>
                        <VStack gap={2}>
                          <Text type="body" weight="bold">Keseimbangan Neraca (Aset = Kewajiban + Ekuitas)</Text>
                          <HStack justify="space-between" wrap="wrap" gap={2}>
                            <Text type="supporting">Total Aset: {formatRp(balanceData?.totalAssets || 0)}</Text>
                            <Text type="body" weight="semibold">
                              Total Pasiva: {formatRp((balanceData?.totalLiabilities || 0) + (balanceData?.totalEquity || 0))}
                            </Text>
                          </HStack>
                        </VStack>
                      </Card>
                    </VStack>

                    {/* Laporan Arus Kas */}
                    <VStack gap={3}>
                      <Heading level={4}>3. Laporan Arus Kas Periode (Cash Flow Statement)</Heading>
                      <Grid gap={4}>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Kas Masuk (Inflow)</Text>
                            <Heading level={3} color="success">{formatRp(cashflowData?.totalInflow || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Total Kas Keluar (Outflow)</Text>
                            <Heading level={3} color="error">{formatRp(cashflowData?.totalOutflow || 0)}</Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Arus Kas Bersih (Net Cash)</Text>
                            <Heading level={3} color={(cashflowData?.netCashFlow || 0) >= 0 ? "success" : "error"}>
                              {formatRp(cashflowData?.netCashFlow || 0)}
                            </Heading>
                          </VStack>
                        </Card>
                        <Card style={{ padding: 16 }}>
                          <VStack gap={1}>
                            <Text type="supporting">Saldo Kas & Bank Akhir</Text>
                            <Heading level={3} color="primary">{formatRp(cashflowData?.totalCashBalance || 0)}</Heading>
                          </VStack>
                        </Card>
                      </Grid>

                      {/* Rincian Arus Kas */}
                      <Card style={{ padding: 16, border: '1px solid var(--color-border-primary)' }}>
                        <VStack gap={3}>
                          <Text type="body" weight="bold">Rincian Arus Kas Riil</Text>
                          <Grid gap={4}>
                            {/* Inflow List */}
                            <VStack gap={2}>
                              <Text type="supporting" weight="semibold" color="success">Penerimaan Kas (Inflow):</Text>
                              {cashflowData?.inflows?.length > 0 ? (
                                cashflowData.inflows.map((item: any, idx: number) => (
                                  <HStack key={idx} justify="space-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-primary)' }}>
                                    <Text type="supporting">{item.label}</Text>
                                    <Text type="body" weight="medium" color="success">+{formatRp(item.total)}</Text>
                                  </HStack>
                                ))
                              ) : (
                                <Text type="supporting" color="secondary">Tidak ada kas masuk</Text>
                              )}
                            </VStack>

                            {/* Outflow List */}
                            <VStack gap={2}>
                              <Text type="supporting" weight="semibold" color="error">Pengeluaran Kas (Outflow):</Text>
                              {cashflowData?.outflows?.length > 0 ? (
                                cashflowData.outflows.map((item: any, idx: number) => (
                                  <HStack key={idx} justify="space-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-primary)' }}>
                                    <Text type="supporting">{item.label}</Text>
                                    <Text type="body" weight="medium" color="error">-{formatRp(item.total)}</Text>
                                  </HStack>
                                ))
                              ) : (
                                <Text type="supporting" color="secondary">Tidak ada kas keluar</Text>
                              )}
                            </VStack>
                          </Grid>
                        </VStack>
                      </Card>
                    </VStack>
                  </VStack>
                )
              ) : loans.length > 0 ? (
                <VStack gap={4}>
                  <Table data={loans} columns={loanCols} idKey="id" density="balanced" />

                  {selectedLoan && (
                    <VStack gap={4}>
                      <VStack gap={2}>
                        <Heading level={4}>
                          Detail Pinjaman — {selectedLoan.purpose || 'Pinjaman'}
                        </Heading>
                        <HStack gap={4} wrap="wrap">
                          <Text type="supporting">
                            Pokok: <Text type="body" weight="semibold">{formatRp(selectedLoan.amount)}</Text>
                          </Text>
                          <Text type="supporting">
                            Total tagihan:{' '}
                            <Text type="body" weight="semibold">
                              {formatRp(selectedLoan.totalAmount || selectedLoan.amount)}
                            </Text>
                          </Text>
                          {selectedLoan.monthlyPayment != null && (
                            <Text type="supporting">
                              Angsuran/bulan:{' '}
                              <Text type="body" weight="semibold">
                                {formatRp(selectedLoan.monthlyPayment)}
                              </Text>
                            </Text>
                          )}
                          <Text type="supporting">
                            Sisa dari jadwal:{' '}
                            <Text type="body" weight="semibold">
                              {formatRp(remainingOnSchedule)}
                            </Text>
                          </Text>
                        </HStack>
                      </VStack>

                      {/* Riwayat Pembayaran Masuk */}
                      <VStack gap={2}>
                        <HStack hAlign="space-between" vAlign="center">
                          <Heading level={5}>Riwayat Pembayaran Masuk</Heading>
                          {payments.length > 0 && (
                            <Text type="supporting" color="secondary">
                              {payments.length} kali pembayaran (Total: {formatRp(payments.reduce((s, p) => s + Number(p.amount || 0), 0))})
                            </Text>
                          )}
                        </HStack>
                        {paymentsLoading ? (
                          <Spinner size="md" />
                        ) : payments.length > 0 ? (
                          <Table data={payments} columns={paymentCols} idKey="id" density="balanced" />
                        ) : (
                          <Text type="supporting" color="secondary">
                            Belum ada riwayat pembayaran yang tercatat.
                          </Text>
                        )}
                      </VStack>

                      {/* Jadwal Angsuran */}
                      <VStack gap={2}>
                        <Heading level={5}>Jadwal Angsuran</Heading>
                        {scheduleLoading ? (
                          <Spinner size="md" />
                        ) : schedule.length > 0 ? (
                          <Table data={schedule} columns={scheduleCols} idKey="id" density="balanced" />
                        ) : (
                          <Text type="supporting">
                            Jadwal angsuran belum tersedia (pinjaman mungkin belum disetujui).
                          </Text>
                        )}
                      </VStack>
                    </VStack>
                  )}
                </VStack>
              ) : (
                <Text type="supporting">Belum ada pinjaman</Text>
              )}
            </VStack>
          </Card>
        </VStack>
      </LayoutContent>
    </Layout>
  </div>
  );
}

const Grid = ({ children, gap = 4 }: { children: React.ReactNode; gap?: number }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: `var(--spacing-${gap}, ${gap * 4}px)`,
    }}
  >
    {children}
  </div>
);
