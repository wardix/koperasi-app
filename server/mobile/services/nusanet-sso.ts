import { SsoException } from "../domain/exceptions.js";

export interface SsoIdentity {
  subjectId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
}

export class NusanetSsoClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private timeout: number;

  constructor() {
    this.baseUrl = (process.env.NUSANET_SSO_BASE_URL || "https://sso.nusanet.id").replace(/\/+$/, "");
    this.clientId = process.env.NUSANET_SSO_CLIENT_ID || "";
    this.clientSecret = process.env.NUSANET_SSO_CLIENT_SECRET || "";
    this.timeout = parseInt(process.env.NUSANET_SSO_TIMEOUT || "10000", 10);
  }

  async verify(providerAccessToken: string, provider: string = "google"): Promise<SsoIdentity> {
    const token = await this.requestToken({
      grant_type: "social",
      provider,
      access_token: providerAccessToken,
    });

    return this.identityFrom(token);
  }

  async refresh(refreshToken: string): Promise<SsoIdentity> {
    const token = await this.requestToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    return this.identityFrom(token);
  }

  async requestEmailOtp(email: string): Promise<void> {
    const url = `${this.baseUrl}/email/${encodeURIComponent(email)}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as Record<string, any>;
        throw new SsoException(
          body.message || body.error || "Failed to request OTP.",
          "otp_request_failed",
          res.status
        );
      }
    } catch (err: any) {
      if (err instanceof SsoException) throw err;
      throw new SsoException(`Nusanet OTP service unreachable: ${err.message}`, "sso_unreachable", 503);
    }
  }

  async verifyEmailOtp(email: string, otp: string): Promise<SsoIdentity> {
    const url = `${this.baseUrl}/email/${encodeURIComponent(email)}`;
    let tmpToken: string;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ otp }),
        signal: AbortSignal.timeout(this.timeout),
      });

      const body = (await res.json().catch(() => ({}))) as Record<string, any>;

      if (!res.ok) {
        const errorMsg =
          body.errors?.otp?.[0] || body.message || body.error_description || "Invalid OTP.";
        throw new SsoException(errorMsg, "invalid_otp", 422);
      }

      tmpToken = body.tmp_token;
      if (!tmpToken) {
        throw new SsoException("Malformed OTP response.", "sso_malformed_profile", 500);
      }
    } catch (err: any) {
      if (err instanceof SsoException) throw err;
      throw new SsoException(`Nusanet OTP service unreachable: ${err.message}`, "sso_unreachable", 503);
    }

    return this.verify(tmpToken, "nusawork");
  }

  private async requestToken(grantPayload: Record<string, string>): Promise<Record<string, any>> {
    if (!this.clientId || !this.clientSecret) {
      throw new SsoException("SSO client is not configured.", "sso_not_configured", 500);
    }

    const url = `${this.baseUrl}/oauth/token`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...grantPayload,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      const body = (await res.json().catch(() => ({}))) as Record<string, any>;

      if (!res.ok) {
        throw new SsoException(
          body.message || body.error_description || "Token request failed.",
          "sso_invalid_token",
          res.status
        );
      }

      return body;
    } catch (err: any) {
      if (err instanceof SsoException) throw err;
      throw new SsoException(`Nusanet SSO unreachable: ${err.message}`, "sso_unreachable", 503);
    }
  }

  private async identityFrom(token: Record<string, any>): Promise<SsoIdentity> {
    const profile = await this.fetchProfile(token.access_token);
    return {
      subjectId: String(profile.id),
      email: String(profile.email),
      name: String(profile.name || profile.full_name || profile.username || profile.email),
      avatarUrl: profile.avatar || null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresIn: token.expires_in ? parseInt(token.expires_in, 10) : null,
    };
  }

  private async fetchProfile(accessToken: string): Promise<Record<string, any>> {
    const url = `${this.baseUrl}/api/user`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      const body = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        throw new SsoException("Failed to fetch user profile.", "sso_invalid_token", res.status);
      }

      const profile = body.data && typeof body.data === "object" ? body.data : body;
      if (!profile || !profile.email || !profile.id) {
        throw new SsoException("Malformed profile from SSO.", "sso_malformed_profile", 500);
      }

      return profile;
    } catch (err: any) {
      if (err instanceof SsoException) throw err;
      throw new SsoException(`Nusanet SSO unreachable: ${err.message}`, "sso_unreachable", 503);
    }
  }
}
