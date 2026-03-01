-- ============================================
-- B2B Bayi Siparis Sistemi - Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- LOOKUP TABLES
-- ============================================

-- Order statuses (lookup table, not ENUM)
CREATE TABLE order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  display_order INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valid order status transitions
CREATE TABLE order_status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status_id UUID REFERENCES order_statuses(id),
  to_status_id UUID REFERENCES order_statuses(id),
  UNIQUE(from_status_id, to_status_id)
);

-- ============================================
-- USER MANAGEMENT
-- ============================================

-- User roles (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'dealer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEALER MANAGEMENT
-- ============================================

-- Dealer groups (Altin, Gumus, Bronz)
CREATE TABLE dealer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dealers
CREATE TABLE dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  dealer_group_id UUID REFERENCES dealer_groups(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT MANAGEMENT
-- ============================================

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  image_url TEXT,
  category_id UUID REFERENCES categories(id),
  brand_id UUID REFERENCES brands(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dealer-specific price overrides
CREATE TABLE dealer_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  custom_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dealer_id, product_id)
);

-- ============================================
-- ORDER MANAGEMENT
-- ============================================

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  dealer_id UUID REFERENCES dealers(id),
  status_id UUID REFERENCES order_statuses(id),
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order status history
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status_id UUID REFERENCES order_statuses(id),
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (Critical for RLS performance)
-- ============================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_dealers_user_id ON dealers(user_id);
CREATE INDEX idx_dealers_group_id ON dealers(dealer_group_id);
CREATE INDEX idx_dealers_is_active ON dealers(is_active);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_dealer_prices_dealer_id ON dealer_prices(dealer_id);
CREATE INDEX idx_dealer_prices_product_id ON dealer_prices(product_id);
CREATE INDEX idx_orders_dealer_id ON orders(dealer_id);
CREATE INDEX idx_orders_status_id ON orders(status_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get dealer price (checks override first, then group discount)
CREATE OR REPLACE FUNCTION get_dealer_price(
  p_dealer_id UUID,
  p_product_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_custom_price DECIMAL;
  v_calculated_price DECIMAL;
BEGIN
  -- Check for dealer-specific override
  SELECT custom_price INTO v_custom_price
  FROM dealer_prices
  WHERE dealer_id = p_dealer_id AND product_id = p_product_id;

  IF v_custom_price IS NOT NULL THEN
    RETURN v_custom_price;
  END IF;

  -- Calculate group discount price
  SELECT
    p.base_price * (1 - COALESCE(dg.discount_percent, 0) / 100)
  INTO v_calculated_price
  FROM products p
  LEFT JOIN dealers d ON d.id = p_dealer_id
  LEFT JOIN dealer_groups dg ON dg.id = d.dealer_group_id
  WHERE p.id = p_product_id;

  RETURN COALESCE(v_calculated_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number() RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INT;
  v_order_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 6) AS INT)), 0) + 1
  INTO v_sequence
  FROM orders
  WHERE order_number LIKE v_year || '-%';

  v_order_number := v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
  RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

-- Validate order status transition
CREATE OR REPLACE FUNCTION validate_order_status_transition(
  p_order_id UUID,
  p_new_status_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status_id UUID;
BEGIN
  SELECT status_id INTO v_current_status_id
  FROM orders
  WHERE id = p_order_id;

  -- New orders can be created with pending status
  IF v_current_status_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check if transition is valid
  RETURN EXISTS (
    SELECT 1 FROM order_status_transitions
    WHERE from_status_id = v_current_status_id
      AND to_status_id = p_new_status_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Dealer groups policies (readable by all authenticated, manageable by admin)
CREATE POLICY "Authenticated users can read dealer groups"
  ON dealer_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage dealer groups"
  ON dealer_groups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Dealers policies
CREATE POLICY "Dealers can read own record"
  ON dealers FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can manage dealers"
  ON dealers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Categories policies (public read, admin manage)
CREATE POLICY "Anyone can read categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Brands policies (public read, admin manage)
CREATE POLICY "Anyone can read brands"
  ON brands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage brands"
  ON brands FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Products policies (public read active, admin manage)
CREATE POLICY "Authenticated can read active products"
  ON products FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM users
    WHERE (SELECT auth.uid()) = id AND role = 'admin'
  ));

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Dealer prices policies
CREATE POLICY "Dealers can read own prices"
  ON dealer_prices FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage dealer prices"
  ON dealer_prices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Orders policies
CREATE POLICY "Dealers can read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Dealers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Order items policies
CREATE POLICY "Dealers can read own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN dealers d ON o.dealer_id = d.id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Dealers can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN dealers d ON o.dealer_id = d.id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Order statuses policies (readable by all authenticated)
CREATE POLICY "Authenticated can read order statuses"
  ON order_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage order statuses"
  ON order_statuses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- Order status transitions policies
CREATE POLICY "Authenticated can read transitions"
  ON order_status_transitions FOR SELECT
  TO authenticated
  USING (true);

-- Order status history policies
CREATE POLICY "Dealers can read own order history"
  ON order_status_history FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN dealers d ON o.dealer_id = d.id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage order history"
  ON order_status_history FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE (SELECT auth.uid()) = id AND role = 'admin'
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealer_groups_updated_at
  BEFORE UPDATE ON dealer_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealers_updated_at
  BEFORE UPDATE ON dealers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dealer_prices_updated_at
  BEFORE UPDATE ON dealer_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
