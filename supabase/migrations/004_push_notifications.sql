-- ============================================
-- Push Notifications Support
-- ============================================
-- Adds Expo push token storage and order notification trigger

-- Add expo_push_token column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Index for quick token lookups
CREATE INDEX IF NOT EXISTS idx_users_expo_push_token
ON users(expo_push_token)
WHERE expo_push_token IS NOT NULL;

-- ============================================
-- Order Status Change Notification Trigger
-- ============================================
-- This trigger function can be used to call the push-notification Edge Function
-- when an order status changes. The actual notification sending is done
-- via the Edge Function using Expo's push notification API.

-- Note: The Edge Function must be deployed and configured with the Supabase
-- Database Webhook to call it when order_status_history inserts happen.

-- Helper function to get dealer's push token from order
CREATE OR REPLACE FUNCTION get_order_dealer_push_token(p_order_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT u.expo_push_token INTO v_token
  FROM orders o
  JOIN dealers d ON o.dealer_id = d.id
  JOIN users u ON d.user_id = u.id
  WHERE o.id = p_order_id
    AND u.expo_push_token IS NOT NULL;

  RETURN v_token;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_order_dealer_push_token(UUID) TO authenticated;

-- ============================================
-- Comment for documentation
-- ============================================
COMMENT ON COLUMN users.expo_push_token IS 'Expo push notification token for mobile app notifications';
COMMENT ON FUNCTION get_order_dealer_push_token IS 'Returns the push token for the dealer who owns the given order';
