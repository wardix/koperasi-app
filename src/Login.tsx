// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {useState, useEffect, useRef, type CSSProperties} from 'react';
import {VStack, HStack, StackItem} from '@astryxdesign/core/Layout';
import {apiFetch} from './config';
import {Grid} from '@astryxdesign/core/Grid';
import {Center} from '@astryxdesign/core/Center';
import {Card} from '@astryxdesign/core/Card';
import {Section} from '@astryxdesign/core/Section';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {SquaresPlusIcon, CheckCircleIcon} from '@heroicons/react/24/outline';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Divider} from '@astryxdesign/core/Divider';

// TypeScript declarations for Google Identity Services
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
          prompt: () => void;
        };
      };
    };
  }
}

const COVER_IMAGE_URL =
  'https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';

// Grid emits minmax(MIN, 1fr) where MIN is a hard floor, so MIN plus the
// grid inset and page padding must fit the narrowest phone or the column is
// clipped. 320 − 2×24 (page) − 2×16 (stacked inset) = 240.
const COLUMN_MIN_WIDTH = 240;
// repeat:'fit' (auto-fit) collapses the two columns to one — expanding to fill —
// below 2×MIN + 32(gap) = 512px. The container query reorders the image and
// tightens the inset at that same point, keyed to the card width (not the
// window) so it never desyncs.
// minHeight:100% fills the host so the centered card never leaves an unpainted
// band; padding keeps it off the surface edges.
const pageStyle: CSSProperties = {
  minHeight: '100%',
  backgroundColor: 'var(--color-background-body)',
  padding: 'var(--spacing-6)',
};
const cardWrap: CSSProperties = {
  width: '100%',
  maxWidth: 1000,
  marginInline: 'auto',
};
const coverImage: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

// The container query lives in a plain <style> tag so it needs NO CSS compiler.
// - Pad the grid, not the Card: the form's Section escapes Card's
//   --container-padding-* vars, which would cancel the inset on the form side.
//   container-type makes the grid the query container for the stack point.
// - repeat:'fit' (auto-fit) collapses the two columns to one below 511px; the
//   query reorders the image (order:-1) and tightens the inset at that point,
//   keyed to the card width (not the window) so it never desyncs.
const LOGIN_SPLIT_CSS = `
.login-split-grid {
  container-type: inline-size;
  container-name: login-split;
  padding: var(--spacing-8);
}
.login-split-image {
  width: 100%;
  order: 0;
}
@container login-split (max-width: 511px) {
  .login-split-grid {
    padding: var(--spacing-4);
  }
  .login-split-image {
    order: -1;
  }
}
`;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginTwoColumn({onLoginSuccess}: {onLoginSuccess: () => void}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginFailed, setLoginFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setLoginFailed(true);
      setErrorMessage('Kata sandi salah. Coba lagi.');
      return;
    }
    setIsLoading(true);
    setLoginFailed(false);
    setErrorMessage('');
    
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        setIsSuccess(true);
        setTimeout(onLoginSuccess, 1000);
      } else {
        setLoginFailed(true);
        setErrorMessage('Kata sandi salah. Coba lagi.');
      }
    } catch (err) {
      console.error(err);
      setLoginFailed(true);
      setErrorMessage('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google SSO credential callback
  const handleGoogleCredential = async (response: { credential: string }) => {
    setIsLoading(true);
    setLoginFailed(false);
    setErrorMessage('');

    try {
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        setIsSuccess(true);
        setTimeout(onLoginSuccess, 500);
      } else {
        setLoginFailed(true);
        setErrorMessage(data.message || 'Login Google gagal.');
      }
    } catch (err) {
      console.error('Google SSO error:', err);
      setLoginFailed(true);
      setErrorMessage('Terjadi kesalahan saat login dengan Google.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });

    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(
        googleBtnRef.current,
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          shape: 'rectangular',
          locale: 'id',
        }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center axis="both" style={pageStyle}>
      <style>{LOGIN_SPLIT_CSS}</style>
      <VStack gap={4} width="100%">
        <div style={cardWrap}>
          <Card padding={0} width="100%">
            <Grid
              columns={{minWidth: COLUMN_MIN_WIDTH, repeat: 'fit'}}
              gap={8}
              align="stretch"
              className="login-split-grid">
              {/* Form */}
              <Section variant="transparent" padding={0} height="100%">
                <VStack gap={4} height="100%">
                  <HStack gap={2} vAlign="center">
                    <Icon icon={SquaresPlusIcon} />
                    <Text type="body" weight="bold">
                      Koperasi Maju Bersama
                    </Text>
                  </HStack>

                  <StackItem size="fill">
                    <Center axis="vertical" height="100%">
                      {isSuccess ? (
                        <EmptyState
                          title="Login Berhasil!"
                          description="Mengarahkan Anda ke dasbor utama…"
                          icon={<Icon icon={CheckCircleIcon} size="lg" />}
                        />
                      ) : (
                        <VStack gap={4} hAlign="stretch" width="100%">
                          <VStack gap={1}>
                            <Text type="display-1" as="h2">
                              Selamat Datang
                            </Text>
                            <Text type="body" color="secondary" size="sm">
                              Masuk ke Sistem Informasi Koperasi
                            </Text>
                          </VStack>

                          <VStack gap={2}>
                            <TextInput
                              label="Email"
                              isLabelHidden
                              type="email"
                              placeholder="name@company.com"
                              value={email}
                              onChange={setEmail}
                              size="lg"
                            />
                            <VStack gap={1}>
                              <TextInput
                                label="Password"
                                isLabelHidden
                                placeholder="Masukkan kata sandi"
                                type="password"
                                value={password}
                                onChange={(v: string) => {
                                  setPassword(v);
                                  setLoginFailed(false);
                                  setErrorMessage('');
                                }}
                                size="lg"
                                status={
                                  loginFailed
                                    ? {
                                        type: 'error',
                                        message: errorMessage,
                                      }
                                    : undefined
                                }
                              />
                              {loginFailed && (
                                <VStack hAlign="end">
                                  <Link
                                    href="#"
                                    size="sm"
                                    color="secondary"
                                    type="supporting">
                                    Lupa kata sandi?
                                  </Link>
                                </VStack>
                              )}
                            </VStack>
                          </VStack>

                          <Button
                            label="Masuk"
                            variant="primary"
                            size="lg"
                            isLoading={isLoading}
                            onClick={handleLogin}
                          />

                          {GOOGLE_CLIENT_ID && (
                            <>
                              <HStack gap={2} vAlign="center" width="100%">
                                <StackItem size="fill"><Divider /></StackItem>
                                <Text type="supporting" color="secondary">atau</Text>
                                <StackItem size="fill"><Divider /></StackItem>
                              </HStack>

                              <div
                                ref={googleBtnRef}
                                id="google-signin-btn"
                                style={{ display: 'flex', justifyContent: 'center' }}
                              />
                            </>
                          )}
                        </VStack>
                      )}
                    </Center>
                  </StackItem>

                  {!isSuccess && (
                    <Text type="supporting" color="secondary">
                      Belum memiliki akun?{' '}
                      <Link href="#" type="supporting">
                        Daftar
                      </Link>
                    </Text>
                  )}
                </VStack>
              </Section>

              {/* Cover image — the transparent Card clips it to rounded
                  corners (overflow:clip + radius), so the image needs no radius. */}
              <div className="login-split-image">
                <Card
                  variant="transparent"
                  padding={0}
                  width="100%"
                  height="100%">
                  <img
                    style={coverImage}
                    src={COVER_IMAGE_URL}
                    alt="Two people working at a desk"
                  />
                </Card>
              </div>
            </Grid>
          </Card>
        </div>

        <VStack hAlign="center">
          <Text type="supporting" color="secondary">
            Dengan melanjutkan, Anda menyetujui{' '}
            <Link href="#" type="supporting">
              Syarat dan Ketentuan
            </Link>{' '}
            serta{' '}
            <Link href="#" type="supporting">
              Kebijakan Privasi
            </Link>
            {' '}koperasi kami.
          </Text>
        </VStack>
      </VStack>
    </Center>
  );
}
