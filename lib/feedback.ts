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

// Submit feedback
export async function submitFeedback(feedback: Omit<Feedback, "id" | "createdAt" | "updatedAt" | "status">) {
  try {
    const id = `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await queryPostgres(
      STORE,
      `INSERT INTO user_feedback
       (id, type, user_type, user_name, user_email, user_phone, title, message, rating, screenshot, url, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id,
        feedback.type,
        feedback.userType,
        feedback.userName,
        feedback.userEmail || null,
        feedback.userPhone || null,
        feedback.title,
        feedback.message,
        feedback.rating || null,
        feedback.screenshot || null,
        feedback.url || null,
        "new",
      ]
    );

    // Send notification to admin
    await notifyAdminFeedback(feedback.type, feedback.title);

    return id;
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    throw error;
  }
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
    const params: any[] = [];

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

    const feedback = await queryPostgres<any>(STORE, query, params);

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
  note?: string
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
    const feedback = await queryPostgres<any>(
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
function formatFeedback(record: any): Feedback {
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
    const adminEmail = "design.cad.tsa@gmail.com";
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
