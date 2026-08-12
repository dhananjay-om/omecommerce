-- =============================================================================
-- 0001_foundation_raw.sql
-- Raw-SQL blocks appended to the generated Prisma migration for the Foundation
-- (Store + Catalog core). See plan/02-prisma-schema-and-migrations.md §1 & §5.
--
-- WORKFLOW: run `prisma migrate dev --create-only` to scaffold the base migration,
-- then paste the relevant sections below into that migration.sql (or keep this file
-- and apply it with `prisma db execute --file` right after `migrate deploy` in CI).
-- Everything here is idempotent-friendly where practical.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions (Prisma also declares these via `extensions=[...]`; safe to repeat)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- -----------------------------------------------------------------------------
-- 1. UUIDv7 generator (time-sortable external ids). Referenced by @default(dbgenerated("uuidv7()"))
--    gen_random_uuid() is core in PostgreSQL 13+.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
  ts_ms      bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  uuid_bytes bytea  := uuid_send(gen_random_uuid());
BEGIN
  -- first 48 bits = unix ms timestamp
  uuid_bytes := overlay(uuid_bytes placing substring(int8send(ts_ms) FROM 3) FROM 1 FOR 6);
  -- version 7 in high nibble of byte 6
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- RFC-4122 variant in top two bits of byte 8
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- -----------------------------------------------------------------------------
-- 2. updated_at trigger (DB-authoritative, so raw-SQL writes also touch it).
--    Prisma's @updatedAt covers ORM writes; this covers everything else.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'theme','website','store','store_view','attribute','attribute_set','product',
    'product_variant','product_attribute_value','category','category_rule',
    'metafield_definition'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Deferred / cyclic foreign keys (declared as scalar columns in Prisma to
--    break creation cycles and keep back-relation lists clean).
-- -----------------------------------------------------------------------------
ALTER TABLE website
  ADD CONSTRAINT website_default_store_fk
  FOREIGN KEY (default_store_id) REFERENCES store(id) ON DELETE SET NULL;

ALTER TABLE store
  ADD CONSTRAINT store_root_category_fk
  FOREIGN KEY (root_category_id) REFERENCES category(id) ON DELETE SET NULL;

ALTER TABLE store
  ADD CONSTRAINT store_default_store_view_fk
  FOREIGN KEY (default_store_view_id) REFERENCES store_view(id) ON DELETE SET NULL;

-- Scope FKs on value / override tables (kept scalar in Prisma).
ALTER TABLE product_attribute_value
  ADD CONSTRAINT pav_website_fk    FOREIGN KEY (website_id)    REFERENCES website(id)    ON DELETE CASCADE,
  ADD CONSTRAINT pav_store_fk      FOREIGN KEY (store_id)      REFERENCES store(id)      ON DELETE CASCADE,
  ADD CONSTRAINT pav_store_view_fk FOREIGN KEY (store_view_id) REFERENCES store_view(id) ON DELETE CASCADE;

ALTER TABLE product_store_view
  ADD CONSTRAINT psv_store_view_fk FOREIGN KEY (store_view_id) REFERENCES store_view(id) ON DELETE CASCADE;

ALTER TABLE product_media
  ADD CONSTRAINT pm_store_view_fk  FOREIGN KEY (store_view_id) REFERENCES store_view(id) ON DELETE SET NULL;

ALTER TABLE metafield_value
  ADD CONSTRAINT mv_website_fk     FOREIGN KEY (website_id)    REFERENCES website(id)    ON DELETE CASCADE,
  ADD CONSTRAINT mv_store_fk       FOREIGN KEY (store_id)      REFERENCES store(id)      ON DELETE CASCADE,
  ADD CONSTRAINT mv_store_view_fk  FOREIGN KEY (store_view_id) REFERENCES store_view(id) ON DELETE CASCADE,
  ADD CONSTRAINT mv_language_fk    FOREIGN KEY (language_id)   REFERENCES language(id)   ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 4. Scope-consistency CHECK constraints (exactly the right *_id set per scope).
--    This is what replaces Magento's "store_id = 0 means default" convention.
-- -----------------------------------------------------------------------------
ALTER TABLE product_attribute_value
  ADD CONSTRAINT pav_scope_consistent CHECK (
    (scope = 'GLOBAL'     AND website_id IS NULL     AND store_id IS NULL     AND store_view_id IS NULL) OR
    (scope = 'WEBSITE'    AND website_id IS NOT NULL AND store_id IS NULL     AND store_view_id IS NULL) OR
    (scope = 'STORE'      AND store_id   IS NOT NULL AND store_view_id IS NULL) OR
    (scope = 'STORE_VIEW' AND store_view_id IS NOT NULL)
  ),
  -- at least one typed value column populated
  ADD CONSTRAINT pav_value_present CHECK (
    num_nonnulls(value_text, value_int, value_decimal, value_datetime, value_json) >= 1
  );

ALTER TABLE metafield_value
  ADD CONSTRAINT mv_scope_consistent CHECK (
    (scope = 'GLOBAL'     AND website_id IS NULL     AND store_id IS NULL     AND store_view_id IS NULL) OR
    (scope = 'WEBSITE'    AND website_id IS NOT NULL AND store_id IS NULL     AND store_view_id IS NULL) OR
    (scope = 'STORE'      AND store_id   IS NOT NULL AND store_view_id IS NULL) OR
    (scope = 'STORE_VIEW' AND store_view_id IS NOT NULL)
  );

-- -----------------------------------------------------------------------------
-- 5. scope_rank generated column (single-pass scope resolution; see plan 02 §5).
--    0=GLOBAL .. 3=STORE_VIEW ; DISTINCT ON (attribute_id) ORDER BY scope_rank DESC.
-- -----------------------------------------------------------------------------
ALTER TABLE product_attribute_value
  ADD COLUMN scope_rank smallint GENERATED ALWAYS AS (
    CASE scope
      WHEN 'GLOBAL'     THEN 0
      WHEN 'WEBSITE'    THEN 1
      WHEN 'STORE'      THEN 2
      WHEN 'STORE_VIEW' THEN 3
    END
  ) STORED;

-- -----------------------------------------------------------------------------
-- 6. Fix scope uniqueness: NULLs must NOT be distinct, else duplicate GLOBAL rows
--    slip through (Postgres treats NULLs as distinct by default). PG15+.
--    Replace the Prisma-generated unique constraints with NULLS NOT DISTINCT ones.
-- -----------------------------------------------------------------------------
-- Prisma may emit @@unique(map:) as either a CONSTRAINT or a plain unique INDEX
-- depending on version; drop whichever exists before recreating with NULLS NOT DISTINCT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pav_scope') THEN
    ALTER TABLE product_attribute_value DROP CONSTRAINT uq_pav_scope;
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_pav_scope' AND relkind = 'i') THEN
    DROP INDEX uq_pav_scope;
  END IF;
END $$;
CREATE UNIQUE INDEX uq_pav_scope
  ON product_attribute_value (product_id, attribute_id, scope, website_id, store_id, store_view_id)
  NULLS NOT DISTINCT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_metafield_ver') THEN
    ALTER TABLE metafield_value DROP CONSTRAINT uq_metafield_ver;
  ELSIF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_metafield_ver' AND relkind = 'i') THEN
    DROP INDEX uq_metafield_ver;
  END IF;
END $$;
CREATE UNIQUE INDEX uq_metafield_ver
  ON metafield_value (definition_id, owner_id, scope, store_view_id, language_id, version)
  NULLS NOT DISTINCT;

-- -----------------------------------------------------------------------------
-- 7. Single-default enforcement (exactly one default website / attribute_set).
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX uq_one_default_website
  ON website (is_default) WHERE is_default AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_one_default_attribute_set
  ON attribute_set (is_default) WHERE is_default AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 8. Layered-navigation / faceting indexes on the EAV value table.
--    (DB is the correct source of truth; OpenSearch is the fast facet path.)
-- -----------------------------------------------------------------------------
CREATE INDEX ix_pav_attr_int
  ON product_attribute_value (attribute_id, value_int) WHERE value_int IS NOT NULL;

CREATE INDEX ix_pav_attr_decimal
  ON product_attribute_value (attribute_id, value_decimal) WHERE value_decimal IS NOT NULL;

CREATE INDEX ix_pav_value_json
  ON product_attribute_value USING gin (value_json jsonb_path_ops) WHERE value_json IS NOT NULL;

-- PDP hydration + single-pass scope resolution
CREATE INDEX ix_pav_resolve
  ON product_attribute_value (product_id, attribute_id, scope_rank DESC);

-- -----------------------------------------------------------------------------
-- 9. JSONB GIN indexes (rules / config / metafields).
-- -----------------------------------------------------------------------------
CREATE INDEX ix_category_rule_gin      ON category_rule       USING gin (rule jsonb_path_ops);
CREATE INDEX ix_metafield_value_gin    ON metafield_value     USING gin (value jsonb_path_ops);
CREATE INDEX ix_attribute_validation_gin ON attribute         USING gin (validation_rules jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- 10. Category LTREE indexes + partial "active" indexes.
-- -----------------------------------------------------------------------------
CREATE INDEX ix_category_path_gist  ON category USING gist (path);
CREATE INDEX ix_category_path_btree ON category USING btree (path);

-- Hot-path partial indexes (soft-delete aware). Prisma's plain @@index([deletedAt])
-- stays; these give the planner selective active-only paths.
CREATE INDEX ix_product_active      ON product     (status)          WHERE deleted_at IS NULL;
CREATE INDEX ix_variant_active      ON product_variant (product_id)  WHERE deleted_at IS NULL;
CREATE INDEX ix_category_active     ON category    (parent_id)       WHERE deleted_at IS NULL;

-- Admin fuzzy search on cached product name
CREATE INDEX ix_product_name_trgm   ON product USING gin (name_default gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- 11. Category path + closure maintenance (INSERT). Reparenting goes through the
--     category_reparent(child, new_parent) service function (see §12).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION category_before_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := NEW.id::text::ltree;
  ELSE
    SELECT path || NEW.id::text INTO NEW.path FROM category WHERE id = NEW.parent_id;
    IF NEW.path IS NULL THEN
      RAISE EXCEPTION 'parent category % has no path (missing/uninitialized)', NEW.parent_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION category_after_insert() RETURNS trigger AS $$
BEGIN
  -- self reference
  INSERT INTO category_closure (ancestor_id, descendant_id, depth)
  VALUES (NEW.id, NEW.id, 0);
  -- all ancestors of the parent, +1 depth
  IF NEW.parent_id IS NOT NULL THEN
    INSERT INTO category_closure (ancestor_id, descendant_id, depth)
    SELECT ancestor_id, NEW.id, depth + 1
    FROM category_closure
    WHERE descendant_id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_category_before_insert ON category;
CREATE TRIGGER trg_category_before_insert
  BEFORE INSERT ON category
  FOR EACH ROW EXECUTE FUNCTION category_before_insert();

DROP TRIGGER IF EXISTS trg_category_after_insert ON category;
CREATE TRIGGER trg_category_after_insert
  AFTER INSERT ON category
  FOR EACH ROW EXECUTE FUNCTION category_after_insert();

-- -----------------------------------------------------------------------------
-- 12. Reparent helper (recomputes path + closure for a moved subtree).
--     Call from the application inside a transaction; keeps moves correct & atomic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION category_reparent(p_child bigint, p_new_parent bigint)
RETURNS void AS $$
DECLARE
  new_base ltree;
  old_path ltree;
BEGIN
  SELECT path INTO old_path FROM category WHERE id = p_child;
  IF p_new_parent IS NULL THEN
    new_base := p_child::text::ltree;
  ELSE
    SELECT path || p_child::text INTO new_base FROM category WHERE id = p_new_parent;
  END IF;

  -- rewrite paths of the subtree
  UPDATE category
     SET path = new_base || subpath(path, nlevel(old_path))
   WHERE path <@ old_path AND id <> p_child;
  UPDATE category SET path = new_base, parent_id = p_new_parent WHERE id = p_child;

  -- rebuild closure for the subtree: drop links from outside-ancestors into subtree...
  DELETE FROM category_closure
   WHERE descendant_id IN (SELECT id FROM category WHERE path <@ new_base)
     AND ancestor_id  NOT IN (SELECT id FROM category WHERE path <@ new_base);
  -- ...then re-link new ancestors × subtree
  INSERT INTO category_closure (ancestor_id, descendant_id, depth)
  SELECT a.ancestor_id, d.descendant_id, a.depth + d.depth + 1
  FROM category_closure a
  CROSS JOIN category_closure d
  WHERE a.descendant_id = p_new_parent
    AND d.ancestor_id  = p_child
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- End 0001_foundation_raw.sql
-- =============================================================================
