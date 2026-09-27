INSERT INTO roles (code, name) VALUES
  ('sales', 'Sales / Customer Support'),
  ('technical', 'Technical'),
  ('admin', 'Administrator')
ON CONFLICT (code) DO NOTHING;
