CREATE TABLE IF NOT EXISTS studio_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  product TEXT NOT NULL,
  size TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount REAL NOT NULL,
  advance_paid REAL NOT NULL,
  balance_amount REAL NOT NULL,
  expected_delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_studio_orders_created_at ON studio_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_studio_orders_customer_name ON studio_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_studio_orders_phone_number ON studio_orders(phone_number);
CREATE INDEX IF NOT EXISTS idx_studio_orders_order_number ON studio_orders(order_number);
