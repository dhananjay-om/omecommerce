'use client';

import { useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { api } from '@/lib/axios';
import { recordRecentlyViewed, getRecentlyViewed } from '@/lib/recently-viewed';
import { ProductCarousel } from '@/components/product/product-carousel';
import type { ProductDetail, SearchHit } from '@/types/product';

function toSearchHit(product: ProductDetail): SearchHit {
  return {
    productId: product.publicId,
    sku: product.sku,
    name: product.name ?? product.sku,
    priceDisplay: product.price,
    mrpDisplay: product.mrp,
    currency: product.currency,
    imageUrl: product.media[0]?.url ?? null,
  };
}

/** Records the current product as viewed, then renders the OTHER recently-viewed products — localStorage only, no backend (plan/14 Phase 4 decision). */
export function RecentlyViewed({ currentProductId }: { currentProductId: string }) {
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    recordRecentlyViewed(currentProductId);
    const ids = getRecentlyViewed(currentProductId);
    if (ids.length === 0) return;

    let cancelled = false;
    Promise.allSettled(ids.map((id) => api.get<ProductDetail>(`/products/${id}`))).then((results) => {
      if (cancelled) return;
      const found = results
        .filter((r): r is PromiseFulfilledResult<AxiosResponse<ProductDetail>> => r.status === 'fulfilled')
        .map((r) => toSearchHit(r.value.data));
      setHits(found);
    });
    return () => {
      cancelled = true;
    };
  }, [currentProductId]);

  if (hits.length === 0) return null;
  return <ProductCarousel title="Recently Viewed" hits={hits} />;
}
