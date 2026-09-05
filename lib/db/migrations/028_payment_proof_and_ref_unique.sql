-- Payment anti-fraud: receipt proof + unique transfer reference
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

-- Same transfer reference cannot be reused (case/whitespace-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_reference_number_uidx
  ON payment_requests (lower(btrim(reference_number)))
  WHERE reference_number IS NOT NULL AND btrim(reference_number) <> '';
