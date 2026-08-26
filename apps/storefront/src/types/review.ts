export interface RatingBreakdown {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ProductReview {
  publicId: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

/** Mirrors the backend's ProductReviewListView — approved-only, paginated
 *  (catalog/application/dto.ts). `averageRating` is `null` when there are
 *  zero approved reviews, never a fabricated 0. */
export interface ProductReviewList {
  total: number;
  page: number;
  pageSize: number;
  averageRating: number | null;
  ratingBreakdown: RatingBreakdown;
  reviews: ProductReview[];
}
