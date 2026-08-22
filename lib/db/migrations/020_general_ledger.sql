-- Double-entry general ledger. 120 points = 100 EGP for valuation.

CREATE TABLE IF NOT EXISTS gl_accounts (
  code varchar(20) PRIMARY KEY,
  name_en varchar(120) NOT NULL,
  name_ar varchar(120) NOT NULL,
  type varchar(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS gl_journal_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type varchar(40) NOT NULL,
  source_id varchar(80) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS gl_journal_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id varchar NOT NULL REFERENCES gl_journal_entries(id) ON DELETE CASCADE,
  account_code varchar(20) NOT NULL REFERENCES gl_accounts(code),
  debit numeric(12, 2) NOT NULL DEFAULT 0.00,
  credit numeric(12, 2) NOT NULL DEFAULT 0.00
);

CREATE INDEX IF NOT EXISTS idx_gl_journal_created ON gl_journal_entries (created_at);
CREATE INDEX IF NOT EXISTS idx_gl_lines_entry ON gl_journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_gl_lines_account ON gl_journal_lines (account_code);

INSERT INTO gl_accounts (code, name_en, name_ar, type) VALUES
  ('1100', 'Cash / Payment Clearing', 'النقد ومقاصة التحصيل', 'asset'),
  ('2100', 'Deferred Point Liability', 'التزام نقاط مؤجل', 'liability'),
  ('4100', 'Lead Access Revenue', 'إيراد فتح البيانات', 'revenue'),
  ('5100', 'Promotional Points Cost', 'تكلفة النقاط الترويجية', 'expense'),
  ('5200', 'Operating Expenses', 'مصروفات تشغيلية', 'expense'),
  ('5300', 'Welcome Bonus Cost', 'تكلفة المكافأة الترحيبية', 'expense')
ON CONFLICT (code) DO NOTHING;
