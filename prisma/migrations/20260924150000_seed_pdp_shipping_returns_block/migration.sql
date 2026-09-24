-- The product page's "Shipping & Returns" tab now reads a CMS block with code
-- `pdp_shipping_returns` (edit it in Admin > Content > Blocks). Create it once,
-- pre-filled with the text the tab always showed, so nothing changes until an
-- admin edits it. Never overwrites an existing block with that code.
INSERT INTO "cms_block" ("store_view_id", "code", "body", "status")
SELECT
  NULL,
  'pdp_shipping_returns',
  '<ul>
<li>Free standard delivery on orders above $50</li>
<li>Express delivery (1–2 days) available at checkout</li>
<li>International shipping to select countries</li>
<li>Orders placed before 2pm ship same day</li>
<li>Free returns within 30 days of delivery</li>
<li>Item must be unused, in original packaging, with tags</li>
<li>Start a return from your account anytime</li>
<li>Refund processed within 5 working days</li>
</ul>',
  'PUBLISHED'
WHERE NOT EXISTS (SELECT 1 FROM "cms_block" WHERE "store_view_id" IS NULL AND "code" = 'pdp_shipping_returns');
