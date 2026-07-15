import db from '../db';
import { randomUUID } from 'crypto';
import type { MemberRow } from '../db/entities';

type NotificationType = 'due_in_3_days' | 'due_today' | 'overdue';
type NotificationChannel = 'email' | 'whatsapp';

interface ScheduleInfo {
  id: string;
  loanId: string;
  installmentNo: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
}

export class NotificationService {
  /**
   * Checks if a notification of a specific type has already been sent for a given schedule.
   */
  static async hasBeenSent(scheduleId: string, type: NotificationType): Promise<boolean> {
    const log = await db.query(
      "SELECT id FROM notification_logs WHERE scheduleId = ? AND type = ? AND status = 'sent'"
    ).get(scheduleId, type);
    return !!log;
  }

  /**
   * Mocks sending an email notification.
   */
  static async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    // Mock provider: In a real app, this would use nodemailer, SendGrid, Resend, etc.
    console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL BODY]\n${body}\n`);
    return true; // Assume success for MVP
  }

  /**
   * Mocks sending a WhatsApp notification (provider-agnostic interface).
   */
  static async sendWhatsApp(phone: string, text: string): Promise<boolean> {
    // Mock provider: Twilio, WATI, Qiscus, etc.
    console.log(`[WHATSAPP SENT] To: ${phone} | Text: ${text}`);
    return true;
  }

  /**
   * Logs the notification attempt to the database.
   */
  static async logNotification(
    memberId: string,
    loanId: string | null,
    scheduleId: string | null,
    type: NotificationType,
    channel: NotificationChannel,
    status: 'sent' | 'failed',
    errorMessage: string | null = null
  ) {
    await db.run(
      `INSERT INTO notification_logs (id, memberId, loanId, scheduleId, type, channel, status, errorMessage, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), memberId, loanId, scheduleId, type, channel, status, errorMessage, Date.now()]
    );
  }

  /**
   * Helper to format money
   */
  static formatRp(amount: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  }

  /**
   * Sends due date notification and logs it.
   */
  static async notifySchedule(
    member: MemberRow,
    schedule: ScheduleInfo,
    type: NotificationType
  ) {
    // Deduplication check
    if (await this.hasBeenSent(schedule.id, type)) {
      return;
    }

    const totalDue = schedule.principalAmount + schedule.interestAmount;
    let subject = '';
    let message = '';
    
    const d = new Date(schedule.dueDate);
    const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    if (type === 'due_in_3_days') {
      subject = `Pengingat: Angsuran Koperasi Jatuh Tempo dalam 3 Hari`;
      message = `Halo ${member.name},\n\nIni adalah pengingat bahwa angsuran ke-${schedule.installmentNo} Anda sebesar ${this.formatRp(totalDue)} akan jatuh tempo pada tanggal ${dateStr}. Mohon pastikan ketersediaan dana Anda.\n\nTerima kasih.`;
    } else if (type === 'due_today') {
      subject = `Pemberitahuan: Angsuran Koperasi Jatuh Tempo HARI INI`;
      message = `Halo ${member.name},\n\nAngsuran ke-${schedule.installmentNo} Anda sebesar ${this.formatRp(totalDue)} jatuh tempo pada HARI INI (${dateStr}). Mohon segera lakukan pembayaran untuk menghindari denda.\n\nTerima kasih.`;
    } else if (type === 'overdue') {
      subject = `Peringatan: Angsuran Koperasi TERLAMBAT`;
      message = `Halo ${member.name},\n\nAngsuran ke-${schedule.installmentNo} Anda sebesar ${this.formatRp(totalDue)} yang jatuh tempo pada ${dateStr} belum dibayarkan (TERLAMBAT). Harap segera melunasi tunggakan Anda.\n\nTerima kasih.`;
    }

    // Try Email First
    if (member.email) {
      try {
        const success = await this.sendEmail(member.email, subject, message);
        await this.logNotification(member.id, schedule.loanId, schedule.id, type, 'email', success ? 'sent' : 'failed');
        if (success) return; // If email succeeded, we don't spam WA for MVP (or we could send both)
      } catch (err: any) {
        await this.logNotification(member.id, schedule.loanId, schedule.id, type, 'email', 'failed', err.message);
      }
    }

    // Fallback to WhatsApp (Assuming member has a phone column, if not we'll just log it)
    // Currently MemberRow might not have 'phone', we fallback gracefully.
    const phone = (member as any).phone || null; 
    if (phone) {
      try {
        const success = await this.sendWhatsApp(phone, message);
        await this.logNotification(member.id, schedule.loanId, schedule.id, type, 'whatsapp', success ? 'sent' : 'failed');
      } catch (err: any) {
        await this.logNotification(member.id, schedule.loanId, schedule.id, type, 'whatsapp', 'failed', err.message);
      }
    }
  }
}
