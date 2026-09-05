'use client';

import {useState, useEffect} from 'react';
import {useMediaQuery} from '@astryxdesign/core/hooks';
import {api} from '../services/api';
import {useApiQuery} from '../hooks/useApiQuery';
import {useAuth} from '../hooks/useAuth';
import {useApiAction} from '../hooks/useApiAction';
import {DataStateView} from '../components/DataStateView';
import type {SettingsData} from '../shared/types';
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,

} from '@astryxdesign/core/Layout';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Center} from '@astryxdesign/core/Center';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {ExclamationCircleIcon} from '@heroicons/react/24/outline';
import {useToast} from '@astryxdesign/core/Toast';
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
import {ProfileSettings} from '../components/settings/ProfileSettings';
import {ParameterSettings} from '../components/settings/ParameterSettings';
import {TwoFactorSettings} from '../components/settings/TwoFactorSettings';
import {WaNotificationSettings} from '../components/settings/WaNotificationSettings';

const NAV_ITEMS = [
  'Profil Koperasi',
  'Parameter Bunga',
  'Notifikasi WhatsApp',
  'Hak Akses',
  'Keamanan',
];

const SETTINGS_ITEMS: SearchableItem[] = [
  {id: '1', label: 'Nama Koperasi'},
  {id: '2', label: 'Alamat'},
  {id: '3', label: 'No. Telepon'},
  {id: '4', label: 'Email'},
  {id: '5', label: 'Bunga Pinjaman (% per Tahun)'},
  {id: '6', label: 'Bunga Simpanan (%)'},
  {id: '7', label: 'Denda Keterlambatan'},
  {id: '8', label: 'Izinkan Anggota Melihat Laporan'},
  {id: '9', label: 'Notifikasi WhatsApp'},
  {id: '10', label: 'URL Webhook Gateway'},
  {id: '11', label: 'Nomor WhatsApp Pengurus'},
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
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();
  
  const [koperasiName, setKoperasiName] = useState('Koperasi Maju Bersama');
  const [alamat, setAlamat] = useState('Jl. Jend. Sudirman No. 123, Jakarta');
  const [telepon, setTelepon] = useState('021-555-0192');
  const [email, setEmail] = useState('info@majubersama.co.id');
  const [coopBankName, setCoopBankName] = useState('Bank Mandiri');
  const [coopBankAccountNumber, setCoopBankAccountNumber] = useState('1060022716008');
  const [coopBankAccountName, setCoopBankAccountName] = useState('Koperasi Jasa Nusa Sejahtera Prima');
  
  const [bungaPinjaman, setBungaPinjaman] = useState('1.5');
  const [bungaSimpanan, setBungaSimpanan] = useState('4.0');
  const [denda, setDenda] = useState('0.5');
  
  const [viewReports, setViewReports] = useState(false);
  const [selfRegister, setSelfRegister] = useState(true);
  const [ssoAutoRegister, setSsoAutoRegister] = useState(true);

  // WhatsApp notification settings
  const [waNotificationEnabled, setWaNotificationEnabled] = useState(false);
  const [waWebhookUrl, setWaWebhookUrl] = useState('');
  const [waWebhookToken, setWaWebhookToken] = useState('');
  const [waNotificationTarget, setWaNotificationTarget] = useState('');

  // 2FA state (per-user, not org-wide)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [_totpSecret, setTotpSecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [step, setStep] = useState<'setup' | 'verify'>('setup');

  const [searchValue, setSearchValue] = useState<SearchableItem | null>(null);

  const { data: settingsData, isLoading, error, refetch: fetchSettings } = useApiQuery<SettingsData>('/api/settings');
  const { data: totpStatus, refetch: fetchTotpStatus } = useApiQuery<{ twoFactorEnabled: boolean }>('/api/auth/totp/status');

  useEffect(() => {
    if (settingsData) {
      if (settingsData.koperasiName) setKoperasiName(settingsData.koperasiName);
      if (settingsData.alamat) setAlamat(settingsData.alamat);
      if (settingsData.telepon) setTelepon(settingsData.telepon);
      if (settingsData.email) setEmail(settingsData.email);
      if (settingsData.coopBankName) setCoopBankName(settingsData.coopBankName);
      if (settingsData.coopBankAccountNumber) setCoopBankAccountNumber(settingsData.coopBankAccountNumber);
      if (settingsData.coopBankAccountName) setCoopBankAccountName(settingsData.coopBankAccountName);
      if (settingsData.bungaPinjaman) setBungaPinjaman(settingsData.bungaPinjaman);
      if (settingsData.bungaSimpanan) setBungaSimpanan(settingsData.bungaSimpanan);
      if (settingsData.denda) setDenda(settingsData.denda);
      if (settingsData.viewReports !== undefined) setViewReports(settingsData.viewReports === 'true' || settingsData.viewReports === true);
      if (settingsData.selfRegister !== undefined) setSelfRegister(settingsData.selfRegister === 'true' || settingsData.selfRegister === true);
      if (settingsData.ssoAutoRegister !== undefined) setSsoAutoRegister(settingsData.ssoAutoRegister === 'true' || settingsData.ssoAutoRegister === true);
      if (settingsData.waNotificationEnabled !== undefined) {
        setWaNotificationEnabled(settingsData.waNotificationEnabled === 'true' || settingsData.waNotificationEnabled === true);
      }
      if (settingsData.waWebhookUrl) setWaWebhookUrl(settingsData.waWebhookUrl);
      if (settingsData.waWebhookToken) setWaWebhookToken(settingsData.waWebhookToken);
      if (settingsData.waNotificationTarget) setWaNotificationTarget(settingsData.waNotificationTarget);
    }
  }, [settingsData]);

  // Update 2FA status when fetched
  useEffect(() => {
    if (totpStatus?.twoFactorEnabled !== undefined) {
      setTwoFactorEnabled(totpStatus.twoFactorEnabled);
    }
  }, [totpStatus]);

  const saveSettings = () => {
    apiAction.execute(
      () => api.put('/api/settings', {
        koperasiName, alamat, telepon, email,
        coopBankName, coopBankAccountNumber, coopBankAccountName,
        bungaPinjaman, bungaSimpanan, denda,
        viewReports: String(viewReports),
        selfRegister: String(selfRegister),
        ssoAutoRegister: String(ssoAutoRegister),
        waNotificationEnabled: String(waNotificationEnabled),
        waWebhookUrl,
        waWebhookToken,
        waNotificationTarget,
      }),
      {
        successMsg: 'Pengaturan berhasil disimpan!',
        errorMsg: 'Terjadi kesalahan saat menyimpan pengaturan',
        onSuccess: () => {
          fetchSettings();
          // Notify shell/header to refresh brand name without full reload
          window.dispatchEvent(new Event('app-settings-changed'));
        }
      }
    );
  };

  // ---------------------------------------------------------------------------
  // 2FA handlers
  // ---------------------------------------------------------------------------
  const handleEnable2Fa = async () => {
    try {
      const data = await api.get<{ uri: string; secret: string; recoveryCodes: string[] }>('/api/auth/totp/setup');
      setTotpUri(data.uri);
      setTotpSecret(data.secret);
      setRecoveryCodes(data.recoveryCodes);
      setStep('setup');
      setShowEnableModal(true);
    } catch (e: any) {
      console.error('Failed to setup 2FA:', e);
      alert(e.message || 'Gagal menyiapkan 2FA');
    }
  };

  const handleVerify2Fa = async () => {
    try {
      await api.post('/api/auth/totp/verify', { token: verifyToken });
      setShowEnableModal(false);
      setVerifyToken('');
      fetchTotpStatus();
    } catch (e: any) {
      console.error('Failed to verify 2FA:', e);
      alert(e.message || 'Verifikasi gagal');
    }
  };

  const handleDisable2Fa = async () => {
    const code = prompt('Masukkan kode pemulihan atau token TOTP untuk menonaktifkan 2FA:');
    if (!code) return;
    try {
      await api.post('/api/auth/totp/disable', { recoveryCode: code });
      fetchTotpStatus();
    } catch (e: any) {
      console.error('Failed to disable 2FA:', e);
      alert(e.message || 'Penonaktifan gagal');
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    const token = prompt('Masukkan token TOTP Anda untuk verifikasi:');
    if (!token) return;
    try {
      const data = await api.post<{ recoveryCodes: string[] }>('/api/auth/totp/recovery-codes', { token });
      alert(`Kode pemulihan baru:\n${data.recoveryCodes.join('\n')}\n\nSimpan kode ini dengan aman!`);
    } catch (e: any) {
      console.error('Failed to regenerate recovery codes:', e);
      alert(e.message || 'Regenerasi gagal');
    }
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
          <DataStateView isLoading={isLoading} error={error} onRetry={fetchSettings} errorTitle="Gagal Memuat Pengaturan">
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
            
            <ProfileSettings
              koperasiName={koperasiName}
              alamat={alamat}
              telepon={telepon}
              email={email}
              coopBankName={coopBankName}
              coopBankAccountNumber={coopBankAccountNumber}
              coopBankAccountName={coopBankAccountName}
              canUpdate={hasPermission('update:settings')}
              onKoperasiNameChange={setKoperasiName}
              onAlamatChange={setAlamat}
              onTeleponChange={setTelepon}
              onEmailChange={setEmail}
              onCoopBankNameChange={setCoopBankName}
              onCoopBankAccountNumberChange={setCoopBankAccountNumber}
              onCoopBankAccountNameChange={setCoopBankAccountName}
              onSave={saveSettings}
            />

            <Divider />

            <ParameterSettings
              bungaPinjaman={bungaPinjaman}
              bungaSimpanan={bungaSimpanan}
              denda={denda}
              canUpdate={hasPermission('update:settings')}
              onBungaPinjamanChange={setBungaPinjaman}
              onBungaSimpananChange={setBungaSimpanan}
              onDendaChange={setDenda}
              onSave={saveSettings}
            />

            <Divider />

            <WaNotificationSettings
              waNotificationEnabled={waNotificationEnabled}
              waWebhookUrl={waWebhookUrl}
              waWebhookToken={waWebhookToken}
              waNotificationTarget={waNotificationTarget}
              canUpdate={hasPermission('update:settings')}
              onWaNotificationEnabledChange={setWaNotificationEnabled}
              onWaWebhookUrlChange={setWaWebhookUrl}
              onWaWebhookTokenChange={setWaWebhookToken}
              onWaNotificationTargetChange={setWaNotificationTarget}
              onSave={saveSettings}
            />

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
                  disabled={!hasPermission('update:settings')}
                />
                <CheckboxInput
                  label="Aktifkan Pendaftaran Mandiri"
                  description="Calon anggota dapat mendaftar sendiri melalui aplikasi web."
                  value={selfRegister}
                  onChange={setSelfRegister}
                  disabled={!hasPermission('update:settings')}
                />
                <TwoFactorSettings
                  twoFactorEnabled={twoFactorEnabled}
                  showEnableModal={showEnableModal}
                  step={step}
                  totpUri={totpUri}
                  recoveryCodes={recoveryCodes}
                  verifyToken={verifyToken}
                  onEnable={handleEnable2Fa}
                  onDisable={handleDisable2Fa}
                  onRegenerateCodes={handleRegenerateRecoveryCodes}
                  onVerify={handleVerify2Fa}
                  onSetStep={setStep}
                  onVerifyTokenChange={setVerifyToken}
                  onCloseModal={() => { setShowEnableModal(false); setStep('setup'); }}
                />
                <CheckboxInput
                  label="Registrasi Otomatis via Google SSO"
                  description="Mendaftarkan secara otomatis akun Google baru dengan role Viewer."
                  value={ssoAutoRegister}
                  onChange={setSsoAutoRegister}
                  disabled={!hasPermission('update:settings')}
                />
                {hasPermission('update:settings') && (
                  <HStack>
                    <Button label="Simpan Hak Akses" variant="primary" onClick={saveSettings} />
                  </HStack>
                )}
              </VStack>
            </Grid>
          </VStack>
          </DataStateView>
        </LayoutContent>
      }
    />
  );
}
