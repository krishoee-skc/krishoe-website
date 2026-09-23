import { queryPostgres } from "@/lib/postgres/client";

const STORE = "krishoe";

export type FeedbackType = "bug" | "feature" | "improvement" | "rating";
export type FeedbackStatus = "new" | "acknowledged" | "in_progress" | "resolved";
export type UserType = "admin" | "worker" | "customer";

export interface Feedback {
  id: string;
  type: FeedbackType;
  userType: UserType;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  title: string;
  message: string;
  rating?: number; // 1-5
  status: FeedbackStatus;
  screenshot?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackRecord {
  id: string;
  type: FeedbackType;
  user_type: UserType;
  user_name: string;
  user_email?: string;
  user_phone?: string;
  title: string;
  message: string;
  rating?: number;
  status: FeedbackStatus;
  screenshot?: string;
  url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * A note about the app goes into the inbox the owner already reads.
 *
 * This used to insert into a `user_feedback` table read by one screen that
 * no route ever rendered — customers could send a note and nobody could open
 * it. On the database built from docs/schema.sql that table does not exist at
 * all, so the form accepted what was typed and then failed on the insert.
 *
 * It writes to customer_voice as the `app` kind instead: the same row shape,
 * the same new/answered/closed statuses and the same reply flow as a review or
 * a complaint, in the one inbox at /admin/inbox.
 *
 * The four feedback types are kept in `source` rather than thrown away — a bug
 * report and a feature request read differently, and the owner should be able
 * to tell them apart in the row. The title is folded into the message because
 * customer_voice carries one body of text; losing the title would lose what
 * the person led with.
 */
export async function submitFeedback(feedback: Omit<Feedback, "id" | "createdAt" | "updatedAt" | "status">) {
  const { saveCustomerVoice } = await import("@/lib/customer-voice");

  const body = feedback.title.trim()
    ? `${feedback.title.trim()}

${feedback.message}`
    : feedback.message;

  const voice = await saveCustomerVoice({
    kind: "app",
    customerName: feedback.userName,
    email: feedback.userEmail ?? "",
    phone: feedback.userPhone ?? "",
    // Only a rating carries a verdict; a bug report has none, and 0 is what
    // the column means by "no rating".
    rating: feedback.type === "rating" ? (feedback.rating ?? 0) : 0,
    message: body,
    source: `app-${feedback.type}`,
  });

  // Said after the row is safe, and not allowed to undo it: a notification
  // that fails must not lose a customer's note.
  try {
    await notifyAdminFeedback(feedback.type, feedback.title);
  } catch (error) {
    console.error("Feedback saved but the notification failed:", error);
  }

  return voice.id;
}

// Get feedback statistics
export async function getFeedbackStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  averageRating: number;
  unresolved: number;
}> {
  try {
    const stats = await queryPostgres<{
      total: number;
      avg_rating: number;
      unresolved: number;
    }>(
      STORE,
      `SELECT
        COUNT(*) as total,
        ROUND(AVG(rating), 1)::float as avg_rating,
        COUNT(CASE WHEN status != 'resolved' THEN 1 END) as unresolved
      FROM user_feedback`,
      []
    );

    const byType = await queryPostgres<{ type: string; count: number }>(
      STORE,
      `SELECT type, COUNT(*) as count FROM user_feedback GROUP BY type`,
      []
    );

    const byStatus = await queryPostgres<{ status: string; count: number }>(
      STORE,
      `SELECT status, COUNT(*) as count FROM user_feedback GROUP BY status`,
      []
    );

    const data = stats[0] || { total: 0, avg_rating: 0, unresolved: 0 };

    return {
      total: data.total,
      byType: byType.reduce((acc, r) => ({ ...acc, [r.type]: r.count }), {}),
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {}),
      averageRating: data.avg_rating,
      unresolved: data.unresolved,
    };
  } catch (error) {
    console.error("Failed to get feedback stats:", error);
    return {
      total: 0,
      byType: {},
      byStatus: {},
      averageRating: 0,
      unresolved: 0,
    };
  }
}

// Get all feedback (admin)
export async function getAllFeedback(
  status?: FeedbackStatus,
  type?: FeedbackType,
  limit: number = 100
): Promise<Feedback[]> {
  try {
    let query = "SELECT * FROM user_feedback WHERE 1=1";
    const params: Array<string | number> = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const feedback = await queryPostgres<FeedbackRecord>(STORE, query, params);

    return feedback.map(formatFeedback);
  } catch (error) {
    console.error("Failed to get feedback:", error);
    return [];
  }
}

// Update feedback status
export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
) {
  try {
    await queryPostgres(
      STORE,
      `UPDATE user_feedback
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, id]
    );
  } catch (error) {
    console.error("Failed to update feedback:", error);
  }
}

// Get feedback by user
export async function getFeedbackByUser(
  userEmail: string,
  limit: number = 20
): Promise<Feedback[]> {
  try {
    const feedback = await queryPostgres<FeedbackRecord>(
      STORE,
      `SELECT * FROM user_feedback
       WHERE user_email = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userEmail, limit]
    );

    return feedback.map(formatFeedback);
  } catch (error) {
    console.error("Failed to get user feedback:", error);
    return [];
  }
}

// Format feedback record
function formatFeedback(record: FeedbackRecord): Feedback {
  return {
    id: record.id,
    type: record.type,
    userType: record.user_type,
    userName: record.user_name,
    userEmail: record.user_email,
    userPhone: record.user_phone,
    title: record.title,
    message: record.message,
    rating: record.rating,
    status: record.status,
    screenshot: record.screenshot,
    url: record.url,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// Notify admin of feedback
async function notifyAdminFeedback(type: FeedbackType, title: string) {
  try {
    const icons: Record<FeedbackType, string> = {
      bug: "🐛",
      feature: "✨",
      improvement: "💡",
      rating: "⭐",
    };

    console.log(
      `📢 New feedback: ${icons[type]} ${type} - ${title}`
    );
    // Email notification can be implemented here
  } catch (error) {
    console.error("Failed to notify admin:", error);
  }
}
