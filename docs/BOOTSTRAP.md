# Production Bootstrap Guide

This document describes how to securely bootstrap a Koperasi Maju Bersama production deployment.

## Security Requirements

Production deployments **must** meet these security requirements:

1. **NODE_ENV** must be set to `production`
2. **DATABASE_URL** and **JWT_SECRET** are required (no fallbacks)
3. Default admin password (`admin123`) is **only** seeded in development/test environments
4. Production requires explicit bootstrap via secure channels (SSH, vault, secret manager)
5. PostgreSQL port (`5432`) must NOT be exposed to host network in production
6. Use SSL/TLS for database connections (`?sslmode=require`)

## Bootstrap Procedure

### 1. Generate Secure Secrets

```bash
# Generate JWT_SECRET (minimum 32 bytes / 64 hex chars)
openssl rand -hex 64

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or using Bun
bun -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Configure Environment Variables

Create `.env` file with secure values:

```bash
NODE_ENV=production
JWT_SECRET=<generated-jwt-secret>
DATABASE_URL=postgres://user:secure-password@db.example.com:5432/koperasi?sslmode=require
PORT=3000
CORS_ORIGIN=https://koperasi.yourdomain.com
RATE_LIMIT_ENABLED=true
```

### 3. Bootstrap Admin Account (Secure Method)

For production, **do NOT** use the default admin credentials. Instead:

#### Option A: SSH/Console Access

Connect to the database directly and create admin account with strong password:

```bash
# Connect to PostgreSQL
psql -h db.example.com -U koperasi -d koperasi

# Create admin user with strong password (generate one)
INSERT INTO admins (id, email, password, role) VALUES (
  'admin-001',
  'admin@koperasi.com',
  '$argon2id$...',  -- Use Bun.password.hash() to generate
  'superadmin'
);

-- Generate hash using Bun
bun -e "console.log(await Bun.password.hash('your-strong-password-here'))"
```

#### Option B: API Endpoint (After Initial Bootstrap)

Once the system is running with at least one admin account, use the secure API endpoint to create additional admins:

```bash
curl -X POST https://api.koperasi.com/api/v1/admins \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new-admin@koperasi.com",
    "password": "strong-password-here",
    "role": "superadmin"
  }'
```

### 4. Verify Deployment

After bootstrap, verify the deployment:

```bash
# Check health endpoint
curl https://api.koperasi.com/health

# Verify admin login works (use secure credentials)
curl -X POST https://api.koperasi.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@koperasi.com",
    "password": "<secure-password>"
  }'
```

## Development/Testing Bootstrap

For development and testing, the system auto-seeds default credentials:

- **Email**: `admin@koperasi.com`
- **Password**: `admin123` (dev/test only)

This is automatically handled when:
- `NODE_ENV=development` or `NODE_ENV=test`
- Database is empty (no admins exist)

**WARNING**: This auto-seeding does NOT occur in production. Production deployments must use the secure bootstrap procedure above.

## Security Checklist

Before deploying to production, verify:

- [ ] NODE_ENV is set to `production`
- [ ] DATABASE_URL points to secure database with SSL/TLS
- [ ] JWT_SECRET is strong random value (64+ hex chars)
- [ ] No default admin credentials are used
- [ ] PostgreSQL port is not exposed to host network
- [ ] CORS_ORIGIN is configured for production domain
- [ ] RATE_LIMIT_ENABLED is true
- [ ] Admin account created via secure method

## Troubleshooting

### "No admin accounts found" warning in logs

This indicates production deployment without explicit bootstrap. Follow the secure bootstrap procedure above.

### "JWT_SECRET environment variable is required" error

Ensure JWT_SECRET is set in your environment before starting the application. Docker Compose will fail to start if it's missing.

### "DATABASE_URL environment variable is required" error

Ensure DATABASE_URL is set with proper connection string including SSL/TLS for production.