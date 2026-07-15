import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Spinner } from '@astryxdesign/core/Spinner';
import { formatRp } from '../utils/format';
import { Table, proportional, pixel } from '@astryxdesign/core/Table';
import type { TableColumn } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';

export default function MemberPortal() {
  const [memberToken, setMemberToken] = useState(localStorage.getItem('memberToken'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'savings' | 'loans'>('savings');

  useEffect(() => {
    if (memberToken) {
      loadData();
    }
  }, [memberToken]);

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${memberToken}` };
      const [profileRes, txRes, loansRes] = await Promise.all([
        fetch('/api/v1/portal/profile', { headers }).then(r => r.json()),
        fetch('/api/v1/portal/savings/transactions', { headers }).then(r => r.json()),
        fetch('/api/v1/portal/loans', { headers }).then(r => r.json())
      ]);

      if (profileRes.success) setProfile(profileRes.data);
      if (txRes.success) setTransactions(txRes.data);
      if (loansRes.success) setLoans(loansRes.data);
    } catch (err) {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/member-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(r => r.json());

      if (res.success) {
        localStorage.setItem('memberToken', res.data.token);
        setMemberToken(res.data.token);
      } else {
        setError(res.message || 'Login gagal');
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    fetch('/api/v1/member-auth/logout', { method: 'POST' });
    localStorage.removeItem('memberToken');
    setMemberToken(null);
    setProfile(null);
  };

  if (!memberToken) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background-subtle)' }}>
        <Card style={{ width: '100%', maxWidth: 400, padding: 32 }}>
          <VStack gap={6}>
            <Heading level={2} align="center">Portal Anggota</Heading>
            <Text type="body" color="secondary" align="center">Masuk untuk melihat simpanan & pinjaman Anda.</Text>
            {error && <Text color="error">{error}</Text>}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <VStack gap={2}>
                <Text type="supporting">ID Anggota / Email</Text>
                <input 
                  type="text" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6 }} 
                  required 
                />
              </VStack>
              <VStack gap={2}>
                <Text type="supporting">Kata Sandi</Text>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6 }} 
                  required 
                />
              </VStack>
              <Button label={loading ? 'Memproses...' : 'Masuk'} type="submit" variant="primary" disabled={loading} />
            </form>
          </VStack>
        </Card>
      </div>
    );
  }

  if (loading && !profile) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner size="lg" /></div>;
  }

  const txCols: TableColumn<any>[] = [
    { key: 'createdAt', header: 'Tanggal', width: pixel(120), renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID') },
    { key: 'type', header: 'Jenis', width: pixel(100) },
    { key: 'amount', header: 'Jumlah', width: pixel(150), renderCell: (i) => formatRp(i.amount) },
    { key: 'balanceAfter', header: 'Saldo Akhir', width: proportional(1), renderCell: (i) => formatRp(i.balanceAfter) },
  ];

  const loanCols: TableColumn<any>[] = [
    { key: 'createdAt', header: 'Tgl Pengajuan', width: pixel(120), renderCell: (i) => new Date(i.createdAt).toLocaleDateString('id-ID') },
    { key: 'purpose', header: 'Keperluan', width: proportional(1) },
    { key: 'amount', header: 'Jumlah', width: pixel(120), renderCell: (i) => formatRp(i.amount) },
    { key: 'status', header: 'Status', width: pixel(100), renderCell: (i) => <Badge variant={i.status === 'Disetujui' ? 'success' : 'neutral'} label={i.status} /> },
  ];

  return (
    <Layout>
      <LayoutContent padding={4}>
        <VStack gap={6}>
          <HStack justify="space-between" vAlign="center" wrap="wrap">
            <Heading level={2}>Selamat Datang, {profile?.name}</Heading>
            <Button label="Keluar" onClick={handleLogout} variant="ghost" />
          </HStack>
          
          <Grid gap={4}>
            <Card>
              <VStack gap={2}>
                <Text type="supporting">Total Simpanan</Text>
                <Heading level={2} color="primary">{formatRp(profile?.totalSavings || 0)}</Heading>
              </VStack>
            </Card>
          </Grid>

          <HStack gap={4}>
            <Button label="Simpanan" variant={activeTab === 'savings' ? 'primary' : 'ghost'} onClick={() => setActiveTab('savings')} />
            <Button label="Pinjaman" variant={activeTab === 'loans' ? 'primary' : 'ghost'} onClick={() => setActiveTab('loans')} />
          </HStack>

          <Card>
            <VStack gap={4}>
              <Heading level={4}>{activeTab === 'savings' ? 'Riwayat Simpanan' : 'Daftar Pinjaman'}</Heading>
              {activeTab === 'savings' ? (
                transactions.length > 0 ? (
                  <Table data={transactions} columns={txCols} idKey="id" density="balanced" />
                ) : (
                  <Text type="supporting">Belum ada transaksi</Text>
                )
              ) : (
                loans.length > 0 ? (
                  <Table data={loans} columns={loanCols} idKey="id" density="balanced" />
                ) : (
                  <Text type="supporting">Belum ada pinjaman</Text>
                )
              )}
            </VStack>
          </Card>
        </VStack>
      </LayoutContent>
    </Layout>
  );
}

// Minimal Grid component placeholder since we didn't import it
const Grid = ({ children, gap }: any) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: `${gap * 4}px` }}>
    {children}
  </div>
);
