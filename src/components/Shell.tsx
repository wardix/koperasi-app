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
} from '@heroicons/react/24/outline';
import {HomeIcon} from '@heroicons/react/24/solid';
import {CubeIcon} from '@heroicons/react/24/outline';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import React, { Suspense } from 'react';
import { Spinner } from '@astryxdesign/core/Spinner';
import { useAuth } from '../hooks/useAuth';

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
const ComingSoon = React.lazy(() => import('./ComingSoon.tsx'));

export default function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, logout } = useAuth();

  const path = location.pathname;
  return (
    <AppShell
      contentPadding={6}
      style={{height: '100%', minHeight: 0}}
      topNav={
        <TopNav
          label="Main navigation"
          heading={
              <TopNavHeading
              heading="Koperasi Maju Bersama"
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
            <SideNavItem 
              label="Laporan" 
              icon={ChartBarIcon} 
              isSelected={path === '/reports'}
              onClick={() => navigate('/reports')}
            />
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
            <SideNavItem 
              label="Arus Kas" 
              icon={BanknotesIcon} 
              isSelected={path === '/cashflow'}
              onClick={() => navigate('/cashflow')}
            />
          </SideNavSection>
          <SideNavSection title="Kredit & Persetujuan">
            <SideNavItem 
              label="Persetujuan Pinjaman" 
              icon={ClipboardDocumentCheckIcon} 
              isSelected={path === '/loans'}
              onClick={() => navigate('/loans')}
            />
            <SideNavItem 
              label="Kredit Macet (NPL)" 
              icon={ExclamationTriangleIcon} 
              isSelected={path === '/npl'}
              onClick={() => navigate('/npl')}
            />
          </SideNavSection>
          <SideNavSection title="Pengaturan">
            <SideNavItem 
              label="Konfigurasi Koperasi" 
              icon={Cog6ToothIcon} 
              isSelected={path === '/settings'}
              onClick={() => navigate('/settings')}
            />
            {hasPermission('manage:users') && (
              <SideNavItem 
                label="Hak Akses" 
                icon={UsersIcon} 
                isSelected={path === '/roles'}
                onClick={() => navigate('/roles')}
              />
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
          <Route path="/reports" element={<ComingSoon title="Laporan Koperasi" description="Modul pelaporan keuangan dan aktivitas koperasi sedang dalam tahap pengembangan." />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/loans-tx" element={<LoansTx />} />
          <Route path="/cashflow" element={<Cashflow />} />
          <Route path="/npl" element={<NPL />} />
          <Route path="/roles" element={<Roles />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
