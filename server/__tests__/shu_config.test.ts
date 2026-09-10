import { describe, it, expect, beforeEach } from 'bun:test';
import { sign } from 'hono/jwt';
import db from '../db';
import { app } from '../index';
import { secretKey } from '../middleware';

async function superadminToken(): Promise<string> {
  return sign(
    { email: "superadmin@example.com", role: "superadmin", exp: Math.floor(Date.now() / 1000) + 3600 },
    secretKey
  );
}

describe('SHU Config API', () => {
  beforeEach(async () => {
    // Reset to standard defaults
    const defaults = [
      ['shu_cadangan_pct', '25'],
      ['shu_anggota_pct', '40'],
      ['shu_pengurus_pct', '20'],
      ['shu_sosial_pct', '10'],
      ['shu_pembangunan_pct', '5'],
      ['shu_jasa_simpanan_pct', '50'],
      ['shu_jasa_pinjaman_pct', '50'],
    ];
    for (const [key, val] of defaults) {
      await db.run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [key, val]
      );
    }
  });

  it('GET /config returns current SHU percentages', async () => {
    const token = await superadminToken();
    const res = await app.request('http://localhost/api/v1/shu/config', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.anggotaPct).toBe(40);
    expect(json.data.cadanganPct).toBe(25);
    expect(json.data.pengurusPct).toBe(20);
    expect(json.data.sosialPct).toBe(10);
    expect(json.data.pembangunanPct).toBe(5);
    expect(json.data.jasaSimpananPct).toBe(50);
    expect(json.data.jasaPinjamanPct).toBe(50);
  });

  it('PUT /config updates percentages when sum equals 100%', async () => {
    const token = await superadminToken();
    const newConfig = {
      anggotaPct: 50,
      cadanganPct: 20,
      pengurusPct: 15,
      sosialPct: 10,
      pembangunanPct: 5,
      jasaSimpananPct: 60,
      jasaPinjamanPct: 40,
    };

    const res = await app.request('http://localhost/api/v1/shu/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newConfig),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify persisted in DB
    const getRes = await app.request('http://localhost/api/v1/shu/config', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const getJson = await getRes.json();
    expect(getJson.data.anggotaPct).toBe(50);
    expect(getJson.data.cadanganPct).toBe(20);
    expect(getJson.data.jasaSimpananPct).toBe(60);
    expect(getJson.data.jasaPinjamanPct).toBe(40);
  });

  it('PUT /config rejects when primary distribution sum is not 100%', async () => {
    const token = await superadminToken();
    const invalidConfig = {
      anggotaPct: 50,
      cadanganPct: 20,
      pengurusPct: 15,
      sosialPct: 10,
      pembangunanPct: 10, // Total = 105%
      jasaSimpananPct: 50,
      jasaPinjamanPct: 50,
    };

    const res = await app.request('http://localhost/api/v1/shu/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(invalidConfig),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain('Total distribusi SHU');
  });

  it('PUT /config rejects when member service pool sum is not 100%', async () => {
    const token = await superadminToken();
    const invalidConfig = {
      anggotaPct: 40,
      cadanganPct: 25,
      pengurusPct: 20,
      sosialPct: 10,
      pembangunanPct: 5,
      jasaSimpananPct: 60,
      jasaPinjamanPct: 30, // Total = 90%
    };

    const res = await app.request('http://localhost/api/v1/shu/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(invalidConfig),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain('Total porsi jasa anggota');
  });
});
