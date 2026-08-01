'use client';

import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';

interface TwoFactorSettingsProps {
  twoFactorEnabled: boolean;
  showEnableModal: boolean;
  step: 'setup' | 'verify';
  totpUri: string | null;
  recoveryCodes: string[] | null;
  verifyToken: string;
  onEnable: () => void;
  onDisable: () => void;
  onRegenerateCodes: () => void;
  onVerify: () => void;
  onSetStep: (step: 'setup' | 'verify') => void;
  onVerifyTokenChange: (v: string) => void;
  onCloseModal: () => void;
}

/**
 * Two-factor authentication settings: enable/disable + QR code modal.
 * Controlled component — all state and handlers come from parent (Settings.tsx).
 */
export function TwoFactorSettings({
  twoFactorEnabled,
  showEnableModal,
  step,
  totpUri,
  recoveryCodes,
  verifyToken,
  onEnable,
  onDisable,
  onRegenerateCodes,
  onVerify,
  onSetStep,
  onVerifyTokenChange,
  onCloseModal,
}: TwoFactorSettingsProps) {
  return (
    <VStack gap={3}>
      <HStack justify="space-between">
        <div>
          <Text type="body" fontWeight="600">Otentikasi Dua Langkah (2FA)</Text>
          <Text type="supporting" color="secondary">
            Tambahkan lapisan keamanan ekstra pada akun Anda.
          </Text>
        </div>
        {twoFactorEnabled ? (
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-success-500)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Aktif
          </span>
        ) : (
          <Button label="Aktifkan" variant="secondary" onClick={onEnable} size="sm" />
        )}
      </HStack>

      {twoFactorEnabled && (
        <VStack gap={2} style={{ paddingLeft: '4px' }}>
          <Text type="supporting">
            2FA telah diaktifkan untuk akun Anda. Gunakan aplikasi autentikator (Google
            Authenticator, Authy, dll.) untuk mendapatkan kode verifikasi saat login.
          </Text>
          <HStack gap={3}>
            <Button
              label="Regenerasi Kode Pemulihan"
              variant="secondary"
              size="sm"
              onClick={onRegenerateCodes}
            />
            <Button
              label="Nonaktifkan 2FA"
              variant="danger"
              size="sm"
              onClick={onDisable}
            />
          </HStack>
        </VStack>
      )}

      {/* Enable 2FA Modal */}
      {showEnableModal && (step === 'setup' || step === 'verify') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-background-primary)',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '480px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <Heading level={3} style={{ marginTop: 0 }}>
              {step === 'setup' ? 'Aktifkan 2FA' : 'Verifikasi 2FA'}
            </Heading>

            {step === 'setup' && (
              <>
                <Text type="body" style={{ marginBottom: '16px' }}>
                  Scan QR code di bawah ini dengan aplikasi autentikator Anda, atau masukkan
                  kunci manual:
                </Text>

                {totpUri && (
                  <div
                    style={{
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        color: 'var(--color-text-secondary)',
                        marginBottom: '8px',
                      }}
                    >
                      QR Code untuk scan dengan autentikator
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        wordBreak: 'break-all',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {totpUri}
                    </div>
                  </div>
                )}

                {recoveryCodes && recoveryCodes.length > 0 && (
                  <div
                    style={{
                      border: '1px solid var(--color-warning-500)',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '16px',
                    }}
                  >
                    <Text
                      type="body"
                      fontWeight="600"
                      style={{ color: 'var(--color-text-primary)', marginBottom: '8px' }}
                    >
                      Kode Pemulihan (simpan dengan aman!)
                    </Text>
                    <pre
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        padding: '12px',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '200px',
                      }}
                    >
                      {recoveryCodes.join('\n')}
                    </pre>
                  </div>
                )}

                <Button
                  label="Saya Sudah Memindai QR Code"
                  variant="primary"
                  fullWidth
                  onClick={() => onSetStep('verify')}
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
                  onChange={onVerifyTokenChange}
                  maxLength={6}
                  style={{ marginBottom: '16px' }}
                />
                <HStack gap={3}>
                  <Button
                    label="Kembali"
                    variant="secondary"
                    onClick={() => onSetStep('setup')}
                  />
                  <Button label="Verifikasi" variant="primary" fullWidth onClick={onVerify} />
                </HStack>
              </>
            )}

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <Button label="Batal" variant="ghost" size="sm" onClick={onCloseModal} />
            </div>
          </div>
        </div>
      )}
    </VStack>
  );
}
