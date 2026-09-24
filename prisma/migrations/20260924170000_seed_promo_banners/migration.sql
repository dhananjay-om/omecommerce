-- The home page "Featured Collections" used to show 3 built-in demo cards that lived only in
-- code, so there was nothing in the admin to edit. Create them as real Promo banners
-- (Admin > Content > Banners) with the SAME photos, text and links, so the page looks exactly
-- the same and each card can now be edited, reordered, hidden or replaced. Only runs when
-- there is no Promo banner at all, so it never touches banners an admin already made.
INSERT INTO "banner" ("group", "title", "subtitle", "image_media_key", "cta_label", "cta_href", "gradient", "position", "is_active")
SELECT 'PROMO'::"BannerGroup", v.title, v.subtitle, v.image, 'Explore →', v.href, 'from-slate-700 to-slate-900', v.pos, true
FROM (VALUES
  ('Electronics Edit', 'Sound, screens, and everything smart', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=700&h=900&fit=crop&auto=format', '/collections/electronics', 0),
  ('Home Refresh', 'Kitchen and home essentials worth having', 'https://images.unsplash.com/photo-1556911073-38141963c9e0?w=700&h=900&fit=crop&auto=format', '/collections/home-kitchen', 1),
  ('Up to 40% Off', 'Great pieces at honest prices — no gimmicks', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&h=900&fit=crop&auto=format', '/offers', 2)
) AS v(title, subtitle, image, href, pos)
WHERE NOT EXISTS (SELECT 1 FROM "banner" WHERE "group" = 'PROMO' AND "deleted_at" IS NULL);
