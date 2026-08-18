-- Banner.gradient: admin-picked backdrop color (a raw Tailwind gradient-
-- utility string, from a fixed preset list in the admin form) shown when
-- no image is uploaded, replacing the position-cycled hardcoded default
-- that previously had no DB column or form field backing it at all.
ALTER TABLE "banner" ADD COLUMN "gradient" VARCHAR(64);

-- WidgetInstance.customCss: shared, optional raw CSS across every widget
-- type (not part of the per-type `config` JSONB), injected as-is in a
-- <style> tag on the storefront next to the widget's rendered markup.
-- Same trust level as CmsPage/CmsBlock's unsanitized HTML body.
ALTER TABLE "widget_instance" ADD COLUMN "custom_css" TEXT;
