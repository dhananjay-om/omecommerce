#!/usr/bin/env bash
# Deploys the category/listing-page (PLP) fixes that finish porting it to
# match theme/'s reference design, plus a real "Colour" swatch filter:
#
#  - Sort control is now a real dropdown (was pill buttons).
#  - A category with children now shows a pill row of subcategories next
#    to its title (real categories, not a mock).
#  - Real bug fix: a SELECT-type attribute's facet used to show its raw
#    internal numeric option id (e.g. "17") instead of its label (e.g.
#    "Red") — it now resolves to the option's real label, and its real
#    swatch hex (if the admin sets one on that option) is surfaced too.
#    The storefront filter sidebar renders a coloured circle instead of a
#    text checkbox whenever every value in that filter carries a swatch.
#  - Admin's attribute-options editor (both create and edit) gained a
#    colour picker per option to actually set that hex.
#
# No new migration, no new permission — `AttributeOption.swatch` already
# existed in the schema, this just wires it through search indexing/facets
# and exposes it in the admin UI for the first time.
#
# IMPORTANT — this changes the OpenSearch mapping (a new `facets.swatch`
# field), and `ensureIndex()` only ever CREATES the index if missing, it
# never migrates an existing one's mapping. So after the api image is
# rebuilt, the existing `product_search` index has to be dropped so it
# gets recreated fresh with the new mapping on the next reindex — this
# script does that for you, then runs the same full reindex
# deploy/reindex-search.sh already does, so every product's facets pick up
# the fix immediately rather than only on their next individual edit.
#
# Run from the repo root, after `git pull`: ./deploy/deploy-plp-theme-and-color-facets.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Rebuilding api, admin, storefront"
$COMPOSE up -d --build api admin storefront
if [ $? -ne 0 ]; then
  echo "!! build/restart failed — see the output above" >&2
  exit 1
fi

echo
echo "==> Dropping the product_search index so it's recreated with the new"
echo "    facets.swatch mapping (a mapping change on an existing index"
echo "    isn't picked up automatically):"
$COMPOSE exec api node -e '
fetch("http://opensearch:9200/product_search", { method: "DELETE" })
  .then((r) => r.json())
  .then((r) => console.log(JSON.stringify(r)))
  .catch((err) => { console.error(err.message); process.exit(1); });
'

echo
echo "==> Rebuilding the index and reindexing every product (this recreates"
echo "    product_search with the new mapping, then repopulates it):"
echo
"$REPO_ROOT/deploy/reindex-search.sh"

echo
echo "==> Deploy complete. No migration, no new permission."
echo "Any category page (/collections/*) now shows a dropdown sort control"
echo "and, on a parent category, subcategory pills next to the title."
echo "To try the colour swatch filter: open a SELECT/MULTISELECT attribute"
echo "in Attributes, check Filterable, set a hex colour on its options, and"
echo "make sure at least one ACTIVE product actually carries one of those"
echo "values — its filter will render as a coloured circle instead of text."
