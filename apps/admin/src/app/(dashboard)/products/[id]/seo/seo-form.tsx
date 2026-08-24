'use client';

import { useActionState } from 'react';
import { updateProductAttributes } from '../../actions';
import type { UpdateProductFormState } from '../../actions';
import type { ProductDetail } from '@/lib/types';
import { AttributeFieldsSection } from '../../attribute-fields-section';
import { SEO_GROUP } from '../../default-attribute-groups';
import { Card, CardContent } from '@/components/ui/card';
import { StickyFormActions } from '@/components/sticky-form-actions';

const initialState: UpdateProductFormState = { error: null };

/** Its own small form + its own dedicated `updateProductAttributes`
 *  action — deliberately NOT the same action/form as the Overview tab,
 *  since that action's category-save step treats an empty submission as
 *  "clear all categories" (see the action's own doc comment). Keeping
 *  this tab's save fully independent means it can never touch categories
 *  at all, safe by construction rather than by remembering to carry
 *  hidden fields forward. */
export function SeoForm({ product }: { product: ProductDetail }) {
  const action = updateProductAttributes.bind(null, product.publicId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-6">
      <form id="product-seo-form" action={formAction}>
        <Card>
          <CardContent className="pt-6">
            <AttributeFieldsSection groups={[SEO_GROUP]} values={product.attributes} />
          </CardContent>
        </Card>
      </form>
      <StickyFormActions pending={pending} label="Save Changes" pendingLabel="Saving…" error={state.error} formId="product-seo-form" />
    </div>
  );
}
