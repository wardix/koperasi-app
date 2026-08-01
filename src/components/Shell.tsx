// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {AppShell} from '@astryxdesign/core/AppShell';
import {VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TopNav, TopNavHeading, TopNavItem} from '@astryxdesign/core/TopNav';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {SideNav, SideNavItem, SideNavSection} from '@astryxdesign/core/SideNav';
import {
  ChartBarIcon,
  FolderIcon,
  UsersIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import {HomeIcon} from '@heroicons/react/24/solid';
import {CubeIcon} from '@heroicons/react/24/outline';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import React, { Suspense, type ReactNode } from 'react';
import { Spinner } from '@astryxdesign/core/Spinner';
import { useAuth } from '../hooks/useAuth';
import type { Permission } from '../../shared/permissions';
import type { SettingsData } from '../../shared/types';
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
const Expenses = React.lazy(() => import('../pages/Expenses'));
const NPL = React.lazy(() => import('../pages/NPL'));
const Reports = React.lazy(() => import('../pages/Reports'));
const AuditLog = React.lazy(() => import('../pages/AuditLog'));
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
                <NavIcon
                  icon={<CubeIcon style={{width: 16, height: 16}} />}
                />
              }
            />
          }
          startContent={
            <>
              <TopNavItem label="Dasbor" isSelected={path === '/dashboard' || path === '/'} onClick={() => navigate('/')} />
              <TopNavItem label="Layanan" />
              <TopNavItem label="Pengaturan" isSelected={path === '/settings'} onClick={() => navigate('/settings')} />
            </>
          }
          endContent={
            <IconButton
              label={isDark ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
              icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
              variant="ghost"
              onClick={() => setMode(isDark ? 'light' : 'dark')}
            />
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
            />
            <SideNavItem 
              label="Pinjaman" 
              icon={FolderIcon} 
              isSelected={path === '/loans-tx'}
              onClick={() => navigate('/loans-tx')}
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
            {hasPermission('read:expenses') && (
              <SideNavItem
                label="Pengeluaran"
                icon={BanknotesIcon}
                isSelected={path === '/expenses'}
                onClick={() => navigate('/expenses')}
              />
            )}
          </SideNavSection>
          <SideNavSection title="Kredit & Persetujuan">
            <SideNavItem 
              label="Persetujuan Pinjaman" 
              icon={ClipboardDocumentCheckIcon} 
              isSelected={path === '/loans'}
              onClick={() => navigate('/loans')}
            />
            {hasPermission('read:npl') && (
              <SideNavItem
                label="Kredit Macet (NPL)"
                icon={ExclamationTriangleIcon}
                isSelected={path === '/npl'}
                onClick={() => navigate('/npl')}
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
          <Route path="/settings" element={<Settings />} />
          <Route path="/shu" element={<SHU />} />
          
          {/* Coming Soon Routes */}
          <Route path="/reports" element={<ProtectedRoute permission="read:reports"><Reports /></ProtectedRoute>} />
          <Route path="/report" element={<Navigate to="/reports" replace />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/loans-tx" element={<LoansTx />} />
          <Route path="/cashflow" element={<ProtectedRoute permission="read:cashflow"><Cashflow /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute permission="read:expenses"><Expenses /></ProtectedRoute>} />
          <Route path="/npl" element={<ProtectedRoute permission="read:npl"><NPL /></ProtectedRoute>} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/audit-log" element={<AuditLog />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
