-- Functional invariant tests (run against a freshly migrated DB). Not part of the migration.
\set ON_ERROR_STOP 0

-- seed
INSERT INTO currency(code,symbol,minor_units,name) VALUES ('USD','$',2,'US Dollar');
INSERT INTO language(code,name,native_name,is_rtl) VALUES ('en-US','English','English',false);
INSERT INTO website(code,name,base_currency,is_default) VALUES ('us_retail','US Retail','USD',true);
INSERT INTO store(website_id,code,name) VALUES (1,'main','Main Store');
INSERT INTO store_view(store_id,code,language_id,currency) VALUES (1,'en',1,'USD');
INSERT INTO attribute_set(code,name,is_default) VALUES ('electronics','Electronics',true);
INSERT INTO attribute(code,label,data_type,input_type) VALUES ('ram','RAM','NUMBER','NUMBER');
INSERT INTO product(type,sku,slug,attribute_set_id,name_default,status) VALUES ('SIMPLE','SKU-1','phone-a',1,'Phone A','ACTIVE');
INSERT INTO product_attribute_value(product_id,attribute_id,scope,value_int) VALUES (1,1,'GLOBAL',8);
INSERT INTO product_attribute_value(product_id,attribute_id,scope,store_view_id,value_int) VALUES (1,1,'STORE_VIEW',1,16);

\echo '--- T1: public_id is UUIDv7 (version nibble should be 7) ---'
SELECT substring(public_id::text from 15 for 1) AS version_nibble FROM product WHERE sku='SKU-1';

\echo '--- T2: scope_rank auto-generated (GLOBAL=0, STORE_VIEW=3) ---'
SELECT scope, scope_rank, value_int FROM product_attribute_value ORDER BY scope_rank;

\echo '--- T3: single-pass scope resolution for store_view=1 (expect 16, the STORE_VIEW override) ---'
SELECT DISTINCT ON (attribute_id) value_int AS resolved_ram
FROM product_attribute_value
WHERE product_id=1 AND (store_view_id=1 OR scope='GLOBAL')
ORDER BY attribute_id, scope_rank DESC;

\echo '--- T4: NULLS NOT DISTINCT blocks a duplicate GLOBAL value (EXPECT unique violation) ---'
INSERT INTO product_attribute_value(product_id,attribute_id,scope,value_int) VALUES (1,1,'GLOBAL',99);

\echo '--- T5: scope CHECK rejects inconsistent scope (STORE_VIEW without store_view_id) (EXPECT check violation) ---'
INSERT INTO product_attribute_value(product_id,attribute_id,scope,value_int) VALUES (1,1,'STORE_VIEW',5);

\echo '--- T6: value-present CHECK rejects an all-null value row (EXPECT check violation) ---'
INSERT INTO product_attribute_value(product_id,attribute_id,scope) VALUES (1,1,'WEBSITE');

\echo '--- T7: single-default partial unique index blocks a 2nd default website (EXPECT unique violation) ---'
INSERT INTO website(code,name,base_currency,is_default) VALUES ('eu','EU','USD',true);

\echo '--- T8: category LTREE path + closure maintained by triggers ---'
INSERT INTO category(type,position,slug) VALUES ('MANUAL',0,'root-cat');                    -- id 1 root
INSERT INTO category(parent_id,type,position,slug) VALUES (1,'MANUAL',0,'child-cat');       -- id 2
INSERT INTO category(parent_id,type,position,slug) VALUES (2,'MANUAL',0,'grandchild-cat');  -- id 3
SELECT id, parent_id, path::text FROM category ORDER BY id;
\echo '   closure (ancestor,descendant,depth) — expect self-links + 1>2,1>3,2>3 :'
SELECT ancestor_id, descendant_id, depth FROM category_closure ORDER BY ancestor_id, descendant_id;

\echo '--- T9: updated_at has a DB default (raw insert already succeeded above => PASS if no error) ---'
SELECT count(*) AS products_with_updated_at FROM product WHERE updated_at IS NOT NULL;
