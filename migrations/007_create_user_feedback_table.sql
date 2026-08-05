-- Create user_feedback table for Phase 12: User Feedback System

CREATE TABLE IF NOT EXISTS user_feedback (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature', 'improvement', 'rating')),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('admin', 'worker', 'customer')),
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  user_phone VARCHAR(20),
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  screenshot TEXT,
  url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_type ON user_feedback(user_type);
CREATE INDEX IF NOT EXISTS idx_feedback_user_email ON user_feedback(user_email);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON user_feedback(created_at DESC);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_feedback_updated_at_trigger ON user_feedback;
CREATE TRIGGER update_feedback_updated_at_trigger
BEFORE UPDATE ON user_feedback
FOR EACH ROW
EXECUTE FUNCTION update_feedback_updated_at();

-- Create view for feedback statistics
CREATE OR REPLACE VIEW feedback_stats AS
SELECT
  COUNT(*) as total_feedback,
  COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count,
  COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_count,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
  ROUND(AVG(rating), 1) as avg_rating,
  COUNT(CASE WHEN status != 'resolved' THEN 1 END) as unresolved_count
FROM user_feedback;
