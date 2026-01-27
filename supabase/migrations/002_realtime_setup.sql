-- ============================================
-- Realtime Setup & Order Status Trigger
-- Phase 02: Order Management & Tracking
-- ============================================

-- ============================================
-- TRIGGER FUNCTION: Automatic Status History
-- ============================================

-- Trigger function to automatically track order status changes
-- Fires on INSERT (new order) or UPDATE of status_id
-- Uses SECURITY DEFINER to access auth.uid() inside trigger
CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if this is an INSERT or if status actually changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status_id IS DISTINCT FROM NEW.status_id) THEN
    INSERT INTO order_status_history (
      order_id,
      status_id,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      NEW.status_id,
      auth.uid(), -- Current user from Supabase Auth
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Siparis olusturuldu'
        ELSE 'Durum degistirildi'
      END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CREATE TRIGGER
-- ============================================

-- Drop trigger if exists (for idempotent migrations)
DROP TRIGGER IF EXISTS order_status_change_trigger ON orders;

-- Create trigger on orders table
-- Fires AFTER INSERT or UPDATE OF status_id
CREATE TRIGGER order_status_change_trigger
  AFTER INSERT OR UPDATE OF status_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_order_status_change();

-- ============================================
-- REALTIME PERMISSIONS
-- ============================================

-- Grant SELECT permissions to supabase_realtime role
-- Required for Realtime postgres_changes to work with RLS
GRANT SELECT ON orders TO supabase_realtime;
GRANT SELECT ON order_status_history TO supabase_realtime;
GRANT SELECT ON order_statuses TO supabase_realtime;

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

-- Add tables to supabase_realtime publication
-- This enables postgres_changes subscriptions for these tables
-- Using DO block for idempotent execution
DO $$
BEGIN
  -- Add orders table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  -- Add order_status_history table to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'order_status_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION track_order_status_change() IS
  'Automatically inserts order_status_history record when order status changes. Uses SECURITY DEFINER to capture auth.uid().';

COMMENT ON TRIGGER order_status_change_trigger ON orders IS
  'Fires after INSERT or UPDATE of status_id to create automatic audit trail.';
