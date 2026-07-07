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
import {useState} from 'react';
import App from './App.tsx';
import Members from './Members.tsx';
import Loans from './Loans.tsx';
import Settings from './Settings.tsx';

export default function Shell({ onLogout }: { onLogout: () => void }) {
  const [currentPage, setCurrentPage] = useState('dashboard');
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
              <TopNavItem label="Dasbor" isSelected={currentPage === 'dashboard'} onClick={() => setCurrentPage('dashboard')} />
              <TopNavItem label="Layanan" />
              <TopNavItem label="Pengaturan" isSelected={currentPage === 'settings'} onClick={() => setCurrentPage('settings')} />
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
              isSelected={currentPage === 'dashboard'}
              onClick={() => setCurrentPage('dashboard')}
            />
            <SideNavItem 
              label="Data Anggota" 
              icon={UsersIcon} 
              isSelected={currentPage === 'members'}
              onClick={() => setCurrentPage('members')}
            />
            <SideNavItem label="Laporan" icon={ChartBarIcon} />
          </SideNavSection>
          <SideNavSection title="Transaksi">
            <SideNavItem label="Simpanan" icon={FolderIcon} />
            <SideNavItem label="Pinjaman" icon={FolderIcon} />
          </SideNavSection>
          <SideNavSection title="Keuangan">
            <SideNavItem label="Sisa Hasil Usaha (SHU)" icon={BanknotesIcon} href="#" />
            <SideNavItem label="Arus Kas" icon={BanknotesIcon} href="#" />
          </SideNavSection>
          <SideNavSection title="Kredit & Persetujuan">
            <SideNavItem 
              label="Persetujuan Pinjaman" 
              icon={ClipboardDocumentCheckIcon} 
              isSelected={currentPage === 'loans'}
              onClick={() => setCurrentPage('loans')}
            />
            <SideNavItem label="Kredit Macet (NPL)" icon={ExclamationTriangleIcon} href="#" />
          </SideNavSection>
          <SideNavSection title="Pengaturan">
            <SideNavItem 
              label="Konfigurasi Koperasi" 
              icon={Cog6ToothIcon} 
              isSelected={currentPage === 'settings'}
              onClick={() => setCurrentPage('settings')}
            />
            <SideNavItem label="Hak Akses" icon={UsersIcon} href="#" />
            <SideNavItem label="Keluar" icon={ArrowRightOnRectangleIcon} onClick={onLogout} />
          </SideNavSection>
        </SideNav>
      }>
      {currentPage === 'dashboard' ? (
        <App />
      ) : currentPage === 'members' ? (
        <Members />
      ) : currentPage === 'loans' ? (
        <Loans />
      ) : (
        <Settings />
      )}
    </AppShell>
  );
}
