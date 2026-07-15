import { Hono } from 'hono';
import db from '../db';
import { NotificationService } from '../services/notificationService';
import type { MemberRow } from '../db/entities';

const cronRoutes = new Hono();

// A simple authentication middleware for cron endpoints
cronRoutes.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const cronSecret = process.env.CRON_SECRET || Bun.env.CRON_SECRET || 'default-cron-secret';
  
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ success: false, message: 'Unauthorized cron access' }, 401);
  }
  return next();
});

cronRoutes.post('/due-dates', async (c) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    const todayStr = today.toISOString().split('T')[0];

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    // Fetch all unpaid schedules
    // Note: status in loan_schedules is either 'Belum Dibayar', 'Sebagian', or 'Lunas'
    const schedules = await db.query(
      `SELECT ls.id, ls.loanId, ls.installmentNo, ls.dueDate, ls.principalAmount, ls.interestAmount, l.memberId 
       FROM loan_schedules ls
       JOIN loans l ON ls.loanId = l.id
       WHERE ls.status != 'Lunas' AND l.deletedAt IS NULL`
    ).all() as any[];

    let processedCount = 0;
    let sentCount = 0;

    for (const schedule of schedules) {
      // Due date from DB is usually ISO string or YYYY-MM-DD
      const scheduleDate = new Date(schedule.dueDate);
      scheduleDate.setHours(0, 0, 0, 0);
      const scheduleDateStr = scheduleDate.toISOString().split('T')[0];

      let type: 'due_in_3_days' | 'due_today' | 'overdue' | null = null;

      if (scheduleDateStr === threeDaysStr) {
        type = 'due_in_3_days';
      } else if (scheduleDateStr === todayStr) {
        type = 'due_today';
      } else if (scheduleDate < today) {
        type = 'overdue';
      }

      if (type) {
        processedCount++;
        
        // Fetch member
        const member = await db.query("SELECT * FROM members WHERE id = ? AND deletedAt IS NULL").get<MemberRow>(schedule.memberId);
        
        if (member) {
          // Send notification (deduplication is handled inside NotificationService)
          const alreadySent = await NotificationService.hasBeenSent(schedule.id, type);
          if (!alreadySent) {
            await NotificationService.notifySchedule(member, schedule, type);
            sentCount++;
          }
        }
      }
    }

    return c.json({ 
      success: true, 
      message: 'Cron job executed successfully', 
      stats: { processed: processedCount, sent: sentCount } 
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

export default cronRoutes;
