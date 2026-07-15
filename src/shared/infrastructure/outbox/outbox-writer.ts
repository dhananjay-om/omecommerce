export interface DomainEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
}

/**
 * The minimal shape OutboxWriter needs — deliberately narrower than the full
 * `Db` type so a `$transaction` callback's `tx` client (which is NOT
 * structurally the full extended `Db` type — it lacks $transaction/$extends
 * etc.) can be passed in directly, letting a caller write the event row
 * atomically alongside its domain write when it controls the transaction.
 */
interface OutboxCapableClient {
  outboxEvent: {
    create(args: { data: { aggregateType: string; aggregateId: string; eventType: string; payload: object } }): Promise<unknown>;
  };
}

/**
 * Writes to the transactional outbox (plan/00 §4.8). See
 * prisma/schema/system.prisma header for which OMEcommerce events currently get
 * same-transaction atomicity vs. an immediate-follow-up write.
 */
export class OutboxWriter {
  constructor(private readonly db: OutboxCapableClient) {}

  async write(event: DomainEvent): Promise<void> {
    await this.db.outboxEvent.create({
      data: {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as object,
      },
    });
  }
}
