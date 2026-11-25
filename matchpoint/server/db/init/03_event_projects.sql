ALTER TABLE event_registrations
    ADD COLUMN IF NOT EXISTS repository_url TEXT,
    ADD COLUMN IF NOT EXISTS mentor TEXT,
    ADD COLUMN IF NOT EXISTS evaluation JSONB;
