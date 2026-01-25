-- ============================================
-- SEED DATA FOR DEVELOPMENT
-- ============================================

-- Order Statuses
INSERT INTO order_statuses (code, name, display_order) VALUES
('pending', 'Beklemede', 1),
('confirmed', 'Onaylandi', 2),
('preparing', 'Hazirlaniyor', 3),
('shipped', 'Kargoya Verildi', 4),
('delivered', 'Teslim Edildi', 5),
('cancelled', 'Iptal Edildi', 6);

-- Status Transitions (valid state machine transitions)
INSERT INTO order_status_transitions (from_status_id, to_status_id)
SELECT
  f.id, t.id
FROM order_statuses f, order_statuses t
WHERE
  (f.code = 'pending' AND t.code IN ('confirmed', 'cancelled'))
  OR (f.code = 'confirmed' AND t.code IN ('preparing', 'cancelled'))
  OR (f.code = 'preparing' AND t.code IN ('shipped', 'cancelled'))
  OR (f.code = 'shipped' AND t.code = 'delivered');

-- Dealer Groups
INSERT INTO dealer_groups (name, discount_percent, min_order_amount) VALUES
('Altin', 20.00, 500.00),
('Gumus', 15.00, 750.00),
('Bronz', 10.00, 1000.00);

-- Categories
INSERT INTO categories (name, slug) VALUES
('Elektronik', 'elektronik'),
('Ev Aletleri', 'ev-aletleri'),
('Mobilya', 'mobilya'),
('Giyim', 'giyim'),
('Aksesuar', 'aksesuar');

-- Brands
INSERT INTO brands (name, slug) VALUES
('TechPro', 'techpro'),
('HomeMaster', 'homemaster'),
('ComfortLine', 'comfortline'),
('StyleWear', 'stylewear'),
('AccessPlus', 'accessplus');

-- Products (20 sample products)
INSERT INTO products (code, name, description, base_price, stock_quantity, low_stock_threshold, category_id, brand_id)
SELECT
  'PRD-' || LPAD(row_number() OVER ()::text, 4, '0'),
  name,
  description,
  base_price,
  stock_quantity,
  low_stock_threshold,
  (SELECT id FROM categories WHERE slug = category_slug),
  (SELECT id FROM brands WHERE slug = brand_slug)
FROM (VALUES
  ('Kablosuz Kulaklik', 'Bluetooth 5.0 destekli premium kulaklik', 450.00, 150, 20, 'elektronik', 'techpro'),
  ('Akilli Saat', 'Fitness takibi ve bildirim ozellikleri', 850.00, 75, 15, 'elektronik', 'techpro'),
  ('Tablet Stand', 'Ayarlanabilir aluminyum tablet standi', 180.00, 200, 30, 'aksesuar', 'accessplus'),
  ('USB-C Hub', '7-in-1 USB-C coklu baglanti noktasi', 320.00, 100, 25, 'elektronik', 'techpro'),
  ('Mekanik Klavye', 'RGB aydinlatmali mekanik klavye', 680.00, 50, 10, 'elektronik', 'techpro'),
  ('Elektrikli Su Isitici', '1.7L paslanmaz celik su isitici', 290.00, 120, 20, 'ev-aletleri', 'homemaster'),
  ('Tost Makinesi', 'Cift tarafli tost ve sandvic makinesi', 380.00, 85, 15, 'ev-aletleri', 'homemaster'),
  ('El Blenderi', '600W guclu el blenderi seti', 420.00, 60, 10, 'ev-aletleri', 'homemaster'),
  ('Kahve Makinesi', 'Otomatik espresso ve filtre kahve', 1250.00, 30, 5, 'ev-aletleri', 'homemaster'),
  ('Robot Supurge', 'Akilli haritalama ozellikli robot supurge', 2800.00, 25, 5, 'ev-aletleri', 'homemaster'),
  ('Ofis Sandalyesi', 'Ergonomik ofis sandalyesi', 1450.00, 40, 8, 'mobilya', 'comfortline'),
  ('Calisma Masasi', '140cm genis calisma masasi', 1800.00, 20, 5, 'mobilya', 'comfortline'),
  ('Kitaplik', '5 rafli modern kitaplik', 650.00, 35, 10, 'mobilya', 'comfortline'),
  ('TV Unitesi', 'Minimalist TV unitesi', 980.00, 25, 8, 'mobilya', 'comfortline'),
  ('Puf Koltuk', 'Yumusak dokulu puf koltuk', 480.00, 45, 10, 'mobilya', 'comfortline'),
  ('Polo Tisort', 'Premium pamuklu polo tisort', 180.00, 300, 50, 'giyim', 'stylewear'),
  ('Jean Pantolon', 'Slim fit jean pantolon', 320.00, 200, 40, 'giyim', 'stylewear'),
  ('Deri Cuzdan', 'El yapimi deri cuzdan', 250.00, 100, 20, 'aksesuar', 'accessplus'),
  ('Laptop Cantasi', '15.6 inc laptop cantasi', 380.00, 80, 15, 'aksesuar', 'accessplus'),
  ('Gunes Gozlugu', 'UV korumali polarize gunes gozlugu', 290.00, 120, 25, 'aksesuar', 'accessplus')
) AS t(name, description, base_price, stock_quantity, low_stock_threshold, category_slug, brand_slug);

-- Note: Dealers and users should be created through the application
-- to properly link with Supabase Auth
