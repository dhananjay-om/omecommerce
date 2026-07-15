import { DomainError } from '../../../shared/domain/errors.js';

export class CartNotActiveError extends DomainError {
  constructor(cartPublicId: string) {
    super(`cart ${cartPublicId} is not active (already checked out or abandoned)`, 'https://errors.ome/cart-not-active', 409);
  }
}

export class PaymentDeclinedError extends DomainError {
  constructor(orderPublicId: string, gatewayRef: string) {
    super(`payment declined for order ${orderPublicId} (gateway ref ${gatewayRef})`, 'https://errors.ome/payment-declined', 402);
  }
}

export class InvalidOrderStateError extends DomainError {
  constructor(message: string) {
    super(message, 'https://errors.ome/invalid-order-state', 409);
  }
}

export class FulfillmentExceedsQtyError extends DomainError {
  constructor(orderLineId: bigint) {
    super(`fulfillment quantity would exceed order line ${orderLineId}'s remaining quantity`, 'https://errors.ome/fulfillment-exceeds-qty', 409);
  }
}

export class RefundExceedsQtyError extends DomainError {
  constructor(orderLineId: bigint) {
    super(`refund quantity would exceed order line ${orderLineId}'s remaining quantity`, 'https://errors.ome/refund-exceeds-qty', 409);
  }
}
