-- Mega Menu layout controls: panel width, column gap, promo image
-- width/height, and promo image position. All safe additive columns —
-- every existing row gets NULL (== "use the component's own default")
-- except promoImagePosition, which defaults to 'right' (the position
-- this panel already rendered at before this migration).

ALTER TABLE "mega_menu_item"
  ADD COLUMN "panel_width" INTEGER,
  ADD COLUMN "column_gap" INTEGER,
  ADD COLUMN "promo_image_width" INTEGER,
  ADD COLUMN "promo_image_height" INTEGER,
  ADD COLUMN "promo_image_position" TEXT NOT NULL DEFAULT 'right';
