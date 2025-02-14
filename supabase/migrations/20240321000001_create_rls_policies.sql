-- Activer RLS pour toutes les tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Politique par défaut : refuser tout accès
CREATE POLICY "deny_all_items" ON items FOR ALL USING (false);
CREATE POLICY "deny_all_containers" ON containers FOR ALL USING (false);
CREATE POLICY "deny_all_categories" ON categories FOR ALL USING (false);

-- Politiques de lecture pour les items
CREATE POLICY "allow_read_own_items" ON items
    FOR SELECT
    USING (auth.uid() = user_id);

-- Politique de création pour les items
CREATE POLICY "allow_insert_own_items" ON items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Politique de mise à jour pour les items
CREATE POLICY "allow_update_own_items" ON items
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politique de suppression pour les items
CREATE POLICY "allow_delete_own_items" ON items
    FOR DELETE
    USING (auth.uid() = user_id);

-- Politiques pour les containers
CREATE POLICY "allow_read_own_containers" ON containers
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "allow_insert_own_containers" ON containers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_update_own_containers" ON containers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_delete_own_containers" ON containers
    FOR DELETE
    USING (auth.uid() = user_id);

-- Politiques pour les categories
CREATE POLICY "allow_read_own_categories" ON categories
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "allow_insert_own_categories" ON categories
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_update_own_categories" ON categories
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_delete_own_categories" ON categories
    FOR DELETE
    USING (auth.uid() = user_id);

-- Ajouter une fonction pour l'audit
CREATE OR REPLACE FUNCTION audit_log() RETURNS trigger AS $$
BEGIN
    INSERT INTO audit_logs (
        metadata,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        created_at
    ) VALUES (
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'operation', TG_OP
        ),
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        CASE
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb
            WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::jsonb
            ELSE NULL
        END,
        CASE
            WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW)::jsonb
            ELSE NULL
        END,
        auth.uid(),
        CURRENT_TIMESTAMP
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer la table d'audit
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    metadata JSONB NOT NULL,
    record_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Ajouter les triggers d'audit
CREATE TRIGGER items_audit
    AFTER INSERT OR UPDATE OR DELETE ON items
    FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER containers_audit
    AFTER INSERT OR UPDATE OR DELETE ON containers
    FOR EACH ROW EXECUTE FUNCTION audit_log();

CREATE TRIGGER categories_audit
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION audit_log();

-- Ajouter les index pour la table d'audit
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING gin (metadata); 