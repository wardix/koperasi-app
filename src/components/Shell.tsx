// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {AppShell} from '@astryxdesign/core/AppShell';
import {VStack, HStack} from '@astryxdesign/core/Stack';
import {TopNav, TopNavHeading} from '@astryxdesign/core/TopNav';
import {SideNav, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import { NotificationBell } from './NotificationBell';
import {
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import {HomeIcon} from '@heroicons/react/24/solid';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import React, { Suspense, type ReactNode } from 'react';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Badge } from '@astryxdesign/core/Badge';
import { useAuth } from '../hooks/useAuth';
import type { Permission } from '../../shared/permissions';
import type { SettingsData, PendingActionsData } from '../../shared/types';
import { useThemeMode } from '../contexts/ThemeContext';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { useApiQuery } from '../hooks/useApiQuery';

const App = React.lazy(() => import('../App'));
const Members = React.lazy(() => import('../pages/Members'));
const Loans = React.lazy(() => import('../pages/Loans'));
const Settings = React.lazy(() => import('../pages/Settings'));
const SHU = React.lazy(() => import('../pages/SHU'));
const Roles = React.lazy(() => import('../pages/Roles'));
const Savings = React.lazy(() => import('../pages/Savings'));
const LoansTx = React.lazy(() => import('../pages/LoansTx'));
const Cashflow = React.lazy(() => import('../pages/Cashflow'));
const NPL = React.lazy(() => import('../pages/NPL'));
const Reports = React.lazy(() => import('../pages/Reports'));
const AuditLog = React.lazy(() => import('../pages/AuditLog'));
const Accounting = React.lazy(() => import('../pages/Accounting'));
const Ledger = React.lazy(() => import('../pages/Ledger'));
const EWA = React.lazy(() => import('../pages/EWA'));
const Letters = React.lazy(() => import('../pages/Letters'));
const Feedbacks = React.lazy(() => import('../pages/Feedbacks'));
const ComingSoon = React.lazy(() => import('./ComingSoon.tsx'));

function ProtectedRoute({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

const DEFAULT_KOPERASI_NAME = 'Koperasi';
const SETTINGS_CHANGED_EVENT = 'app-settings-changed';

export default function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, logout } = useAuth();
  const { mode, setMode } = useThemeMode();
  const { data: settings, refetch: refetchSettings } = useApiQuery<SettingsData>('/api/settings');
  const { data: pendingActions, refetch: refetchPendingActions } = useApiQuery<PendingActionsData>('/api/v1/stats/pending-actions');

  const path = location.pathname;
  const isDark = mode === 'dark';
  const koperasiName = settings?.koperasiName?.trim() || DEFAULT_KOPERASI_NAME;

  React.useEffect(() => {
    document.title = koperasiName;
  }, [koperasiName]);

  React.useEffect(() => {
    const onSettingsChanged = () => {
      refetchSettings();
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, [refetchSettings]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      refetchPendingActions();
    }, 60000);
    return () => clearInterval(interval);
  }, [refetchPendingActions]);

  const pendingSavingsCount = (pendingActions?.pendingSavingsDeposits ?? 0) + (pendingActions?.pendingSavingsWithdrawals ?? 0);
  const pendingEwaCount = pendingActions?.pendingEwa ?? 0;
  const pendingLoansCount = pendingActions?.pendingLoans ?? 0;
  const openFeedbacksCount = pendingActions?.openFeedbacks ?? 0;
  const overdueLoansCount = pendingActions?.overdueLoansCount ?? 0;

  return (
    <AppShell
      contentPadding={6}
      style={{height: '100%', minHeight: 0}}
      topNav={
        <TopNav
          label="Main navigation"
          heading={
            <TopNavHeading
              heading={koperasiName}
              logo={
                <img
                  src="/nsp.png"
                  alt={koperasiName}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              }
            />
          }
          endContent={
            <HStack gap={2} vAlign="center">
              <NotificationBell
                pendingActions={pendingActions}
                onNavigate={(route) => navigate(route)}
                onRefresh={refetchPendingActions}
              />
              <IconButton
                label={isDark ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
                variant="ghost"
                onClick={() => setMode(isDark ? 'light' : 'dark')}
              />
            </HStack>
          }
        />
      }
      sideNav={
        <SideNav>
          <SideNavSection title="Menu Utama" isHeaderHidden>
            <SideNavItem
              label="Dasbor"
              icon={HomeIcon}
              isSelected={path === '/dashboard' || path === '/'}
              onClick={() => navigate('/')}
            />
            <SideNavItem 
              label="Data Anggota" 
              icon={UsersIcon} 
              isSelected={path === '/members'}
              onClick={() => navigate('/members')}
            />
            {hasPermission('read:reports') && (
              <SideNavItem
                label="Laporan"
                icon={ChartBarIcon}
                isSelected={path === '/reports'}
                onClick={() => navigate('/reports')}
              />
            )}
          </SideNavSection>
          <SideNavSection title="Transaksi">
            <SideNavItem 
              label="Simpanan" 
              icon={FolderIcon} 
              isSelected={path === '/savings'}
              onClick={() => navigate('/savings')}
              endContent={pendingSavingsCount > 0 ? (
                <Badge variant="warning" size="sm" label={String(pendingSavingsCount)} />
              ) : undefined}
            />
            <SideNavItem 
              label="Pinjaman" 
              icon={FolderIcon} 
              isSelected={path === '/loans-tx'}
              onClick={() => navigate('/loans-tx')}
            />
            <SideNavItem 
              label="Gaji Awal (EWA)" 
              icon={BanknotesIcon} 
              isSelected={path === '/ewa'}
              onClick={() => navigate('/ewa')}
              endContent={pendingEwaCount > 0 ? (
                <Badge variant="warning" size="sm" label={String(pendingEwaCount)} />
              ) : undefined}
            />
          </SideNavSection>
          <SideNavSection title="Keuangan">
            <SideNavItem 
              label="Sisa Hasil Usaha (SHU)" 
              icon={BanknotesIcon} 
              isSelected={path === '/shu'}
              onClick={() => navigate('/shu')}
            />
            {hasPermission('read:cashflow') && (
              <SideNavItem
                label="Arus Kas"
                icon={BanknotesIcon}
                isSelected={path === '/cashflow'}
                onClick={() => navigate('/cashflow')}
              />
            )}

            <SideNavItem
              label="Jurnal Umum"
              icon={BanknotesIcon}
              isSelected={path === '/accounting'}
              onClick={() => navigate('/accounting')}
            />
            <SideNavItem
              label="Buku Besar"
              icon={BanknotesIcon}
              isSelected={path === '/ledger'}
              onClick={() => navigate('/ledger')}
            />
          </SideNavSection>
          <SideNavSection title="Kredit & Persetujuan">
            <SideNavItem 
              label="Persetujuan Pinjaman" 
              icon={ClipboardDocumentCheckIcon} 
              isSelected={path === '/loans'}
              onClick={() => navigate('/loans')}
              endContent={pendingLoansCount > 0 ? (
                <Badge variant="critical" size="sm" label={String(pendingLoansCount)} />
              ) : undefined}
            />
            <SideNavItem
              label="Buku Agenda Surat"
              icon={DocumentTextIcon}
              isSelected={path === '/letters'}
              onClick={() => navigate('/letters')}
            />
            {hasPermission('read:npl') && (
              <SideNavItem
                label="Kredit Macet (NPL)"
                icon={ExclamationTriangleIcon}
                isSelected={path === '/npl'}
                onClick={() => navigate('/npl')}
                endContent={overdueLoansCount > 0 ? (
                  <Badge variant="critical" size="sm" label={String(overdueLoansCount)} />
                ) : undefined}
              />
            )}
          </SideNavSection>
          <SideNavSection title="Pengaturan">
            <SideNavItem
              label="Konfigurasi Koperasi"
              icon={Cog6ToothIcon}
              isSelected={path === '/settings'}
              onClick={() => navigate('/settings')}
            />
            {hasPermission('manage:users') && (
              <>
                <SideNavItem
                  label="Hak Akses"
                  icon={UsersIcon}
                  isSelected={path === '/roles'}
                  onClick={() => navigate('/roles')}
                />
                <SideNavItem
                  label="Log Audit"
                  icon={ClipboardDocumentCheckIcon}
                  isSelected={path === '/audit-log'}
                  onClick={() => navigate('/audit-log')}
                />
              </>
            )}
            <SideNavItem
              label="Kotak Masukan & Bug"
              icon={ChatBubbleLeftRightIcon}
              isSelected={path === '/feedbacks' || path === '/feedback'}
              onClick={() => navigate('/feedbacks')}
              endContent={openFeedbacksCount > 0 ? (
                <Badge variant="info" size="sm" label={String(openFeedbacksCount)} />
              ) : undefined}
            />
            <SideNavItem label="Keluar" icon={ArrowRightOnRectangleIcon} onClick={logout} />
          </SideNavSection>
        </SideNav>
      }>
      <Suspense fallback={<Spinner size="lg" />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dashboard" element={<App />} />
          <Route path="/members" element={<Members />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/letters" element={<Letters />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/shu" element={<SHU />} />
          
          {/* Coming Soon Routes */}
          <Route path="/reports" element={<ProtectedRoute permission="read:reports"><Reports /></ProtectedRoute>} />
          <Route path="/report" element={<Navigate to="/reports" replace />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/loans-tx" element={<LoansTx />} />
          <Route path="/ewa" element={<EWA />} />
          <Route path="/cashflow" element={<ProtectedRoute permission="read:cashflow"><Cashflow /></ProtectedRoute>} />

          <Route path="/npl" element={<ProtectedRoute permission="read:npl"><NPL /></ProtectedRoute>} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/feedbacks" element={<Feedbacks />} />
          <Route path="/feedback" element={<Navigate to="/feedbacks" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
