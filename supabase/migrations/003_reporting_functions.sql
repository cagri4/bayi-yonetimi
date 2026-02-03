-- ============================================
-- B2B Bayi Siparis Sistemi - Reporting Functions
-- ============================================

-- ============================================
-- TOP PRODUCTS REPORT
-- ============================================

-- Get top selling products by quantity and revenue
CREATE OR REPLACE FUNCTION get_top_products(
  start_date DATE,
  end_date DATE,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  sku TEXT,
  order_count BIGINT,
  total_quantity BIGINT,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.code AS sku,
    COUNT(DISTINCT o.id) AS order_count,
    SUM(oi.quantity)::BIGINT AS total_quantity,
    SUM(oi.total_price)::NUMERIC AS total_revenue
  FROM products p
  INNER JOIN order_items oi ON p.id = oi.product_id
  INNER JOIN orders o ON oi.order_id = o.id
  INNER JOIN order_statuses os ON o.status_id = os.id
  WHERE
    o.created_at::DATE >= start_date
    AND o.created_at::DATE <= end_date
    AND os.code != 'cancelled'
  GROUP BY p.id, p.name, p.code
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- DEALER PERFORMANCE REPORT
-- ============================================

-- Get dealer performance with ranking and percentage
CREATE OR REPLACE FUNCTION get_dealer_performance(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  dealer_id UUID,
  company_name TEXT,
  order_count BIGINT,
  total_sales NUMERIC,
  avg_order_value NUMERIC,
  sales_rank BIGINT,
  sales_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH dealer_stats AS (
    SELECT
      d.id AS dealer_id,
      d.company_name,
      COUNT(o.id) AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS total_sales
    FROM dealers d
    LEFT JOIN orders o ON d.id = o.dealer_id
      AND o.created_at::DATE >= start_date
      AND o.created_at::DATE <= end_date
    LEFT JOIN order_statuses os ON o.status_id = os.id
    WHERE d.is_active = true
      AND (os.code IS NULL OR os.code != 'cancelled')
    GROUP BY d.id, d.company_name
  ),
  ranked_dealers AS (
    SELECT
      ds.dealer_id,
      ds.company_name,
      ds.order_count,
      ds.total_sales,
      CASE
        WHEN ds.order_count > 0 THEN ROUND(ds.total_sales / ds.order_count, 2)
        ELSE 0
      END AS avg_order_value,
      RANK() OVER (ORDER BY ds.total_sales DESC) AS sales_rank,
      CASE
        WHEN SUM(ds.total_sales) OVER () > 0
        THEN ROUND(ds.total_sales * 100.0 / SUM(ds.total_sales) OVER (), 2)
        ELSE 0
      END AS sales_percentage
    FROM dealer_stats ds
  )
  SELECT
    rd.dealer_id,
    rd.company_name,
    rd.order_count,
    rd.total_sales,
    rd.avg_order_value,
    rd.sales_rank,
    rd.sales_percentage
  FROM ranked_dealers rd
  ORDER BY rd.total_sales DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- SALES REPORT (for completeness)
-- ============================================

-- Get sales report by period
CREATE OR REPLACE FUNCTION get_sales_report(
  start_date DATE,
  end_date DATE,
  period_type TEXT DEFAULT 'daily'
)
RETURNS TABLE (
  period TEXT,
  order_count BIGINT,
  total_sales NUMERIC,
  avg_order_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE period_type
      WHEN 'daily' THEN TO_CHAR(o.created_at, 'YYYY-MM-DD')
      WHEN 'weekly' THEN TO_CHAR(DATE_TRUNC('week', o.created_at), 'YYYY-MM-DD')
      WHEN 'monthly' THEN TO_CHAR(o.created_at, 'YYYY-MM')
    END AS period,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_amount), 0) AS total_sales,
    CASE
      WHEN COUNT(o.id) > 0 THEN ROUND(SUM(o.total_amount) / COUNT(o.id), 2)
      ELSE 0
    END AS avg_order_value
  FROM orders o
  INNER JOIN order_statuses os ON o.status_id = os.id
  WHERE
    o.created_at::DATE >= start_date
    AND o.created_at::DATE <= end_date
    AND os.code != 'cancelled'
  GROUP BY
    CASE period_type
      WHEN 'daily' THEN TO_CHAR(o.created_at, 'YYYY-MM-DD')
      WHEN 'weekly' THEN TO_CHAR(DATE_TRUNC('week', o.created_at), 'YYYY-MM-DD')
      WHEN 'monthly' THEN TO_CHAR(o.created_at, 'YYYY-MM')
    END
  ORDER BY period;
END;
$$ LANGUAGE plpgsql STABLE;
