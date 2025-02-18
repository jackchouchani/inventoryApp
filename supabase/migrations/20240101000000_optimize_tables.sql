-- Optimisation de la table items
CREATE INDEX IF NOT EXISTS idx_items_qr_code ON items(qr_code);
CREATE INDEX IF NOT EXISTS idx_items_container_id ON items(container_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_items_name_search ON items USING gin(name gin_trgm_ops) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at) WHERE deleted = false;

-- Optimisation de la table containers
CREATE INDEX IF NOT EXISTS idx_containers_qr_code ON containers(qr_code);
CREATE INDEX IF NOT EXISTS idx_containers_user_id ON containers(user_id) WHERE deleted = false;
CREATE INDEX IF NOT EXISTS idx_containers_number ON containers(number) WHERE deleted = false;

-- Optimisation de la table categories
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name) WHERE deleted = false;

-- Ajout de l'extension pour la recherche textuelle
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optimisation des requêtes fréquentes avec des vues matérialisées
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_items_list AS
SELECT 
    id,
    name,
    status,
    selling_price,
    purchase_price,
    category_id,
    container_id,
    photo_uri,
    qr_code,
    created_at,
    updated_at
FROM items
WHERE deleted = false
ORDER BY created_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_items_list_id ON mv_items_list(id);
CREATE INDEX IF NOT EXISTS idx_mv_items_list_category ON mv_items_list(category_id);
CREATE INDEX IF NOT EXISTS idx_mv_items_list_container ON mv_items_list(container_id);

-- Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_items_list()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_items_list;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour la vue matérialisée
DROP TRIGGER IF EXISTS trigger_refresh_items_list ON items;
CREATE TRIGGER trigger_refresh_items_list
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_list();

-- Fonction pour nettoyer le cache des images
CREATE OR REPLACE FUNCTION cleanup_unused_images()
RETURNS void AS $$
DECLARE
    bucket_name text := 'images';
BEGIN
    -- Supprimer les images qui ne sont plus référencées
    DELETE FROM storage.objects
    WHERE bucket_id = bucket_name
    AND path NOT IN (
        SELECT photo_uri FROM items WHERE photo_uri IS NOT NULL
        UNION
        SELECT replace(photo_uri, 'full_', 'thumb_') FROM items WHERE photo_uri IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Planifier le nettoyage des images (à exécuter manuellement ou via un cron)
-- SELECT cron.schedule('0 0 * * *', $$SELECT cleanup_unused_images()$$);

-- Optimisation des paramètres Postgres pour notre cas d'utilisation
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Fonction pour compresser automatiquement les images JPEG
CREATE OR REPLACE FUNCTION compress_image()
RETURNS TRIGGER AS $$
BEGIN
    -- Cette fonction serait implémentée côté serveur pour compresser les images
    -- avant leur stockage, mais comme nous le faisons déjà côté client,
    -- nous la laissons vide pour l'instant
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour la compression des images
DROP TRIGGER IF EXISTS trigger_compress_image ON storage.objects;
CREATE TRIGGER trigger_compress_image
BEFORE INSERT ON storage.objects
FOR EACH ROW
WHEN (NEW.bucket_id = 'images' AND (NEW.path LIKE '%.jpg' OR NEW.path LIKE '%.jpeg'))
EXECUTE FUNCTION compress_image(); 