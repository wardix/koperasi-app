'use client';

import {useState, useEffect} from 'react';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {apiUrl} from './config';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
} from '@astryxdesign/core/Layout';
import {Grid} from '@astryxdesign/core/Grid';
import {List, ListItem} from '@astryxdesign/core/List';
import {TabList, Tab} from '@astryxdesign/core/TabList';
import {Text, Heading} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Typeahead} from '@astryxdesign/core/Typeahead';
import {MagnifyingGlassIcon} from '@heroicons/react/24/outline';
import type {SearchableItem, SearchSource} from '@astryxdesign/core/Typeahead';

const NAV_ITEMS = [
  'Profil Koperasi',
  'Parameter Bunga',
  'Hak Akses',
  'Keamanan',
];

const SETTINGS_ITEMS: SearchableItem[] = [
  {id: '1', label: 'Nama Koperasi'},
  {id: '2', label: 'Alamat'},
  {id: '3', label: 'No. Telepon'},
  {id: '4', label: 'Email'},
  {id: '5', label: 'Bunga Pinjaman (%)'},
  {id: '6', label: 'Bunga Simpanan (%)'},
  {id: '7', label: 'Denda Keterlambatan'},
  {id: '8', label: 'Izinkan Anggota Melihat Laporan'},
];

const settingsSearchSource: SearchSource<SearchableItem> = {
  search: (query: string) =>
    SETTINGS_ITEMS.filter(item =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    ),
  bootstrap: () => SETTINGS_ITEMS,
};

export default function SettingsTemplate() {
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const [activeNav, setActiveNav] = useState('Profil Koperasi');
  
  const [koperasiName, setKoperasiName] = useState('Koperasi Maju Bersama');
  const [alamat, setAlamat] = useState('Jl. Jend. Sudirman No. 123, Jakarta');
  const [telepon, setTelepon] = useState('021-555-0192');
  const [email, setEmail] = useState('info@majubersama.co.id');
  
  const [bungaPinjaman, setBungaPinjaman] = useState('1.5');
  const [bungaSimpanan, setBungaSimpanan] = useState('4.0');
  const [denda, setDenda] = useState('0.5');
  
  const [viewReports, setViewReports] = useState(false);
  const [selfRegister, setSelfRegister] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  
  const [searchValue, setSearchValue] = useState<SearchableItem | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/settings'))
      .then(res => res.json())
      .then(data => {
        if (data.koperasiName) setKoperasiName(data.koperasiName);
        if (data.alamat) setAlamat(data.alamat);
        if (data.telepon) setTelepon(data.telepon);
        if (data.email) setEmail(data.email);
        if (data.bungaPinjaman) setBungaPinjaman(data.bungaPinjaman);
        if (data.bungaSimpanan) setBungaSimpanan(data.bungaSimpanan);
        if (data.denda) setDenda(data.denda);
        if (data.viewReports) setViewReports(data.viewReports === 'true');
        if (data.selfRegister) setSelfRegister(data.selfRegister === 'true');
        if (data.twoFactor) setTwoFactor(data.twoFactor === 'true');
      });
  }, []);

  const saveSettings = async () => {
    await fetch(apiUrl('/api/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        koperasiName, alamat, telepon, email,
        bungaPinjaman, bungaSimpanan, denda,
        viewReports, selfRegister, twoFactor
      })
    });
    alert('Pengaturan berhasil disimpan!');
  };

  return (
    <Layout
      height="auto"
      contentWidth={1440}
      header={
        <LayoutHeader hasDivider>
          <HStack vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Konfigurasi Koperasi</Heading>
            </StackItem>
            <Typeahead
              label="Pencarian"
              isLabelHidden
              placeholder="Cari pengaturan..."
              searchSource={settingsSearchSource}
              value={searchValue}
              onChange={setSearchValue}
              hasEntriesOnFocus
              startIcon={MagnifyingGlassIcon}
            />
          </HStack>
        </LayoutHeader>
      }
      start={
        isNarrow ? undefined : (
          <LayoutPanel hasDivider={false} width={260} padding={2}>
            <List density="balanced">
              {NAV_ITEMS.map(item => (
                <ListItem
                  key={item}
                  label={item}
                  isSelected={activeNav === item}
                  onClick={() => setActiveNav(item)}
                />
              ))}
            </List>
          </LayoutPanel>
        )
      }
      content={
        <LayoutContent padding={4}>
          <VStack gap={4}>
            {isNarrow && (
              <VStack hAlign="center">
                <TabList value={activeNav} onChange={setActiveNav}>
                  {NAV_ITEMS.map(item => (
                    <Tab key={item} value={item} label={item} />
                  ))}
                </TabList>
              </VStack>
            )}
            
            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Informasi Koperasi</Heading>
                <Text type="supporting" color="secondary">
                  Perbarui detail dan identitas koperasi Anda.
                </Text>
              </VStack>
              <VStack gap={4}>
                <TextInput
                  label="Nama Koperasi"
                  value={koperasiName}
                  onChange={setKoperasiName}
                />
                <TextInput
                  label="Alamat"
                  value={alamat}
                  onChange={setAlamat}
                />
                <TextInput
                  label="No. Telepon"
                  value={telepon}
                  onChange={setTelepon}
                />
                <TextInput
                  label="Email Resmi"
                  value={email}
                  onChange={setEmail}
                />
                <HStack>
                  <Button label="Simpan Perubahan" variant="primary" onClick={saveSettings} />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Parameter Bunga</Heading>
                <Text type="supporting" color="secondary">
                  Atur besaran persentase bunga untuk pinjaman, simpanan, dan denda.
                </Text>
              </VStack>
              <VStack gap={4}>
                <TextInput
                  label="Bunga Pinjaman per Bulan (%)"
                  type="number"
                  value={bungaPinjaman}
                  onChange={setBungaPinjaman}
                />
                <TextInput
                  label="Bunga Simpanan per Tahun (%)"
                  type="number"
                  value={bungaSimpanan}
                  onChange={setBungaSimpanan}
                />
                <TextInput
                  label="Denda Keterlambatan (%)"
                  type="number"
                  value={denda}
                  onChange={setDenda}
                />
                <HStack>
                  <Button label="Simpan Parameter" variant="primary" onClick={saveSettings} />
                </HStack>
              </VStack>
            </Grid>

            <Divider />

            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Hak Akses & Keamanan</Heading>
                <Text type="supporting" color="secondary">
                  Konfigurasikan preferensi sistem dan kebijakan anggota.
                </Text>
              </VStack>
              <VStack gap={5}>
                <CheckboxInput
                  label="Izinkan Anggota Melihat Laporan"
                  description="Anggota biasa dapat mengunduh laporan neraca tahunan."
                  value={viewReports}
                  onChange={setViewReports}
                />
                <CheckboxInput
                  label="Aktifkan Pendaftaran Mandiri"
                  description="Calon anggota dapat mendaftar sendiri melalui aplikasi web."
                  value={selfRegister}
                  onChange={setSelfRegister}
                />
                <CheckboxInput
                  label="Otentikasi Dua Langkah (2FA)"
                  description="Wajibkan 2FA untuk pengurus koperasi (Ketua, Bendahara)."
                  value={twoFactor}
                  onChange={setTwoFactor}
                />
                <HStack>
                  <Button label="Simpan Hak Akses" variant="primary" onClick={saveSettings} />
                </HStack>
              </VStack>
            </Grid>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
