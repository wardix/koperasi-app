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
  {id: '5', label: 'Bunga Pinjaman (% per Tahun)'},
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
  const { hasPermission } = useAuth();
  const apiAction = useApiAction();
  
  const [koperasiName, setKoperasiName] = useState('Koperasi Maju Bersama');
  const [alamat, setAlamat] = useState('Jl. Jend. Sudirman No. 123, Jakarta');
  const [telepon, setTelepon] = useState('021-555-0192');
  const [email, setEmail] = useState('info@majubersama.co.id');
  
  const [bungaPinjaman, setBungaPinjaman] = useState('1.5');
  const [bungaSimpanan, setBungaSimpanan] = useState('4.0');
  const [denda, setDenda] = useState('0.5');
  
  const [viewReports, setViewReports] = useState(false);
  const [selfRegister, setSelfRegister] = useState(true);
  const [ssoAutoRegister, setSsoAutoRegister] = useState(true);

  // 2FA state (per-user, not org-wide)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
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
      if (settingsData.bungaPinjaman) setBungaPinjaman(settingsData.bungaPinjaman);
      if (settingsData.bungaSimpanan) setBungaSimpanan(settingsData.bungaSimpanan);
      if (settingsData.denda) setDenda(settingsData.denda);
      if (settingsData.viewReports !== undefined) setViewReports(settingsData.viewReports === 'true' || settingsData.viewReports === true);
      if (settingsData.selfRegister !== undefined) setSelfRegister(settingsData.selfRegister === 'true' || settingsData.selfRegister === true);
      if (settingsData.ssoAutoRegister !== undefined) setSsoAutoRegister(settingsData.ssoAutoRegister === 'true' || settingsData.ssoAutoRegister === true);
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
        bungaPinjaman, bungaSimpanan, denda,
        viewReports: String(viewReports),
        selfRegister: String(selfRegister),
        ssoAutoRegister: String(ssoAutoRegister)
      }),
      {
        successMsg: 'Pengaturan berhasil disimpan!',
        errorMsg: 'Terjadi kesalahan saat menyimpan pengaturan',
        onSuccess: () => fetchSettings()
      }
    );
  };

  // ---------------------------------------------------------------------------
  // 2FA handlers
  // ---------------------------------------------------------------------------
  const handleEnable2Fa = async () => {
    try {
      const res = await api.get('/api/auth/totp/setup');
      const data = await res.json();
      if (data.success) {
        setTotpUri(data.data.uri);
        setTotpSecret(data.data.secret);
        setRecoveryCodes(data.data.recoveryCodes);
        setStep('setup');
        setShowEnableModal(true);
      }
    } catch (e) {
      console.error('Failed to setup 2FA:', e);
    }
  };

  const handleVerify2Fa = async () => {
    try {
      const res = await api.post('/api/auth/totp/verify', { token: verifyToken });
      const data = await res.json();
      if (data.success) {
        setShowEnableModal(false);
        setVerifyToken('');
        fetchTotpStatus();
      } else {
        alert(data.message || 'Verifikasi gagal');
      }
    } catch (e) {
      console.error('Failed to verify 2FA:', e);
    }
  };

  const handleDisable2Fa = async () => {
    const code = prompt('Masukkan kode pemulihan atau token TOTP untuk menonaktifkan 2FA:');
    if (!code) return;
    try {
      const res = await api.post('/api/auth/totp/disable', { recoveryCode: code });
      const data = await res.json();
      if (data.success) {
        fetchTotpStatus();
      } else {
        alert(data.message || 'Penonaktifan gagal');
      }
    } catch (e) {
      console.error('Failed to disable 2FA:', e);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    const token = prompt('Masukkan token TOTP Anda untuk verifikasi:');
    if (!token) return;
    try {
      const res = await api.post('/api/auth/totp/recovery-codes', { token });
      const data = await res.json();
      if (data.success) {
        alert(`Kode pemulihan baru:\n${data.data.recoveryCodes.join('\n')}\n\nSimpan kode ini dengan aman!`);
      } else {
        alert(data.message || 'Regenerasi gagal');
      }
    } catch (e) {
      console.error('Failed to regenerate recovery codes:', e);
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
            
            <Grid columns={{minWidth: 320}} gap={10}>
              <VStack gap={1}>
                <Heading level={3}>Informasi Koperasi</Heading>
                <Text type="supporting" color="secondary">
                  Perbarui detail dan identitas koperasi Anda.
                </Text>
              </VStack>
              <VStack gap={4}>
                <TextInput label="Nama Koperasi" value={koperasiName} onChange={setKoperasiName} disabled={!hasPermission('update:settings')} />
                <TextInput label="Alamat Lengkap" value={alamat} onChange={setAlamat} disabled={!hasPermission('update:settings')} />
                <Grid columns={2} gap={4}>
                  <TextInput label="No. Telepon" value={telepon} onChange={setTelepon} disabled={!hasPermission('update:settings')} />
                  <TextInput label="Email Resmi" type="email" value={email} onChange={setEmail} disabled={!hasPermission('update:settings')} />
                </Grid>
                {hasPermission('update:settings') && (
                  <HStack hAlign="start">
                    <Button label="Simpan Perubahan" variant="primary" onClick={saveSettings} />
                  </HStack>
                )}
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
                <Grid columns={3} gap={4}>
                  <TextInput 
                    label="Bunga Pinjaman (% per Tahun)" 
                    type="number" 
                    value={bungaPinjaman} 
                    onChange={setBungaPinjaman}
                    disabled={!hasPermission('update:settings')} 
                  />
                  <TextInput 
                    label="Bunga Simpanan (%)" 
                    type="number" 
                    value={bungaSimpanan} 
                    onChange={setBungaSimpanan}
                    disabled={!hasPermission('update:settings')} 
                  />
                  <TextInput 
                    label="Denda Keterlambatan (%)" 
                    type="number" 
                    value={denda} 
                    onChange={setDenda}
                    disabled={!hasPermission('update:settings')} 
                  />
                </Grid>
                {hasPermission('update:settings') && (
                  <HStack>
                    <Button label="Simpan Parameter" variant="primary" onClick={saveSettings} />
                  </HStack>
                )}
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
                  disabled={!hasPermission('update:settings')}
                />
                <CheckboxInput
                  label="Aktifkan Pendaftaran Mandiri"
                  description="Calon anggota dapat mendaftar sendiri melalui aplikasi web."
                  value={selfRegister}
                  onChange={setSelfRegister}
                  disabled={!hasPermission('update:settings')}
                />
                <VStack gap={3}>
                  <HStack justify="space-between">
                    <div>
                      <Text type="body" fontWeight="600">Otentikasi Dua Langkah (2FA)</Text>
                      <Text type="supporting" color="secondary">
                        Tambahkan lapisan keamanan ekstra pada akun Anda.
                      </Text>
                    </div>
                    {twoFactorEnabled ? (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-success-500)',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        Aktif
                      </span>
                    ) : (
                      <Button
                        label="Aktifkan"
                        variant="secondary"
                        onClick={handleEnable2Fa}
                        size="sm"
                      />
                    )}
                  </HStack>

                  {twoFactorEnabled && (
                    <VStack gap={2} style={{ paddingLeft: '4px' }}>
                      <Text type="supporting">
                        2FA telah diaktifkan untuk akun Anda. Gunakan aplikasi autentikator (Google Authenticator, Authy, dll.) untuk mendapatkan kode verifikasi saat login.
                      </Text>
                      <HStack gap={3}>
                        <Button
                          label="Regenerasi Kode Pemulihan"
                          variant="secondary"
                          size="sm"
                          onClick={handleRegenerateRecoveryCodes}
                        />
                        <Button
                          label="Nonaktifkan 2FA"
                          variant="danger"
                          size="sm"
                          onClick={handleDisable2Fa}
                        />
                      </HStack>
                    </VStack>
                  )}

                  {/* Enable 2FA Modal */}
                  {showEnableModal && (step === 'setup' || step === 'verify') && (
                    <div style={{
                      position: 'fixed',
                      inset: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1000
                    }}>
                      <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '32px',
                        maxWidth: '480px',
                        width: '90%',
                        maxHeight: '90vh',
                        overflow: 'auto'
                      }}>
                        <Heading level={3} style={{ marginTop: 0 }}>
                          {step === 'setup' ? 'Aktifkan 2FA' : 'Verifikasi 2FA'}
                        </Heading>

                        {step === 'setup' && (
                          <>
                            <Text type="body" style={{ marginBottom: '16px' }}>
                              Scan QR code di bawah ini dengan aplikasi autentikator Anda, atau masukkan kunci manual:
                            </Text>

                            {/* QR Code placeholder - in production, use a QR code library */}
                            {totpUri && (
                              <div style={{
                                backgroundColor: 'f8f9fa',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '24px',
                                textAlign: 'center',
                                marginBottom: '16px'
                              }}>
                                <div style={{ fontSize: '14px', color: '#718096', marginBottom: '8px' }}>
                                  QR Code untuk scan dengan autentikator
                                </div>
                                <div style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', color: '#4a5568' }}>
                                  {totpUri}
                                </div>
                              </div>
                            )}

                            {/* Recovery codes */}
                            {recoveryCodes && recoveryCodes.length > 0 && (
                              <div style={{
                                backgroundColor: 'fffbeb',
                                border: '1px solid #f59e0b',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '16px'
                              }}>
                                <Text type="body" fontWeight="600" style={{ color: '#92400e', marginBottom: '8px' }}>
                                  Kode Pemulihan (simpan dengan aman!)
                                </Text>
                                <pre style={{
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                  padding: '12px',
                                  borderRadius: '4px',
                                  overflow: 'auto',
                                  maxHeight: '200px'
                                }}>
{recoveryCodes.join('\n')}
                                </pre>
                              </div>
                            )}

                            <Button
                              label="Saya Sudah Memindai QR Code"
                              variant="primary"
                              fullWidth
                              onClick={() => setStep('verify')}
                            />
                          </>
                        )}

                        {step === 'verify' && (
                          <>
                            <Text type="body" style={{ marginBottom: '16px' }}>
                              Masukkan kode 6 digit dari aplikasi autentikator Anda:
                            </Text>
                            <TextInput
                              label="Kode Verifikasi"
                              placeholder="000000"
                              value={verifyToken}
                              onChange={setVerifyToken}
                              maxLength={6}
                              style={{ marginBottom: '16px' }}
                            />
                            <HStack gap={3}>
                              <Button
                                label="Kembali"
                                variant="secondary"
                                onClick={() => setStep('setup')}
                              />
                              <Button
                                label="Verifikasi"
                                variant="primary"
                                fullWidth
                                onClick={handleVerify2Fa}
                              />
                            </HStack>
                          </>
                        )}

                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                          <Button
                            label="Batal"
                            variant="ghost"
                            size="sm"
                            onClick={() => { setShowEnableModal(false); setStep('setup'); }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </VStack>
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
