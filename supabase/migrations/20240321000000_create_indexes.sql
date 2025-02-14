-- Activer l'extension pg_trgm pour la recherche de texte similaire
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for common query fields
CREATE INDEX IF NOT EXISTS idx_items_container_id ON items(container_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at DESC);

-- Create indexes for full text search
CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_description_trgm ON items USING gin (description gin_trgm_ops);

-- Add indexes for foreign key relationships
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_items_status_category ON items(status, category_id);
CREATE INDEX IF NOT EXISTS idx_items_status_container ON items(status, container_id); 