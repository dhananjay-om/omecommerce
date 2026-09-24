import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type {
  NewsletterRepository,
  SubscriberInfo,
  SubscribeOutcome,
  ListSubscribersFilter,
  SubscriberCounts,
  NewsletterStatusValue,
} from '../domain/repositories.js';

type Row = Prisma.NewsletterSubscriberGetPayload<object>;

function toInfo(row: Row): SubscriberInfo {
  return {
    publicId: row.publicId,
    email: row.email,
    status: row.status,
    source: row.source,
    websiteCode: row.websiteCode,
    unsubscribeToken: row.unsubscribeToken,
    subscribedAt: row.subscribedAt,
    unsubscribedAt: row.unsubscribedAt,
  };
}

const newToken = () => randomBytes(24).toString('base64url');

function whereOf(filter: { search?: string; status?: NewsletterStatusValue }): Prisma.NewsletterSubscriberWhereInput {
  return {
    status: filter.status,
    ...(filter.search ? { email: { contains: filter.search.trim().toLowerCase() } } : {}),
  };
}

export class PrismaNewsletterRepository implements NewsletterRepository {
  constructor(private readonly db: Db) {}

  async subscribe(input: { email: string; source: string; websiteCode: string | null }): Promise<{ outcome: SubscribeOutcome; subscriber: SubscriberInfo }> {
    const existing = await this.db.newsletterSubscriber.findUnique({ where: { email: input.email } });
    if (existing) {
      if (existing.status === 'SUBSCRIBED') return { outcome: 'ALREADY_SUBSCRIBED', subscriber: toInfo(existing) };
      const row = await this.db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { status: 'SUBSCRIBED', subscribedAt: new Date(), unsubscribedAt: null },
      });
      return { outcome: 'RESUBSCRIBED', subscriber: toInfo(row) };
    }
    try {
      const row = await this.db.newsletterSubscriber.create({
        data: { email: input.email, source: input.source, websiteCode: input.websiteCode, unsubscribeToken: newToken() },
      });
      return { outcome: 'CREATED', subscriber: toInfo(row) };
    } catch (err) {
      // Two simultaneous sign-ups for the same address: the loser just reads
      // what the winner wrote — a repeat sign-up is never an error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const row = await this.db.newsletterSubscriber.findUniqueOrThrow({ where: { email: input.email } });
        return { outcome: 'ALREADY_SUBSCRIBED', subscriber: toInfo(row) };
      }
      throw err;
    }
  }

  async findByToken(token: string): Promise<SubscriberInfo | null> {
    const row = await this.db.newsletterSubscriber.findUnique({ where: { unsubscribeToken: token } });
    return row ? toInfo(row) : null;
  }

  async findByPublicId(publicId: string): Promise<SubscriberInfo | null> {
    const row = await this.db.newsletterSubscriber.findUnique({ where: { publicId } });
    return row ? toInfo(row) : null;
  }

  async setStatus(publicId: string, status: NewsletterStatusValue): Promise<SubscriberInfo> {
    try {
      const row = await this.db.newsletterSubscriber.update({
        where: { publicId },
        data: status === 'SUBSCRIBED' ? { status, subscribedAt: new Date(), unsubscribedAt: null } : { status, unsubscribedAt: new Date() },
      });
      return toInfo(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new NotFoundError('newsletter subscriber', publicId);
      throw err;
    }
  }

  async list(filter: ListSubscribersFilter): Promise<{ total: number; subscribers: SubscriberInfo[] }> {
    const where = whereOf(filter);
    const [total, rows] = await this.db.$transaction([
      this.db.newsletterSubscriber.count({ where }),
      this.db.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { total, subscribers: rows.map(toInfo) };
  }

  async listAll(filter: { search?: string; status?: NewsletterStatusValue }): Promise<SubscriberInfo[]> {
    const rows = await this.db.newsletterSubscriber.findMany({ where: whereOf(filter), orderBy: { subscribedAt: 'desc' } });
    return rows.map(toInfo);
  }

  async counts(): Promise<SubscriberCounts> {
    const [subscribed, unsubscribed] = await this.db.$transaction([
      this.db.newsletterSubscriber.count({ where: { status: 'SUBSCRIBED' } }),
      this.db.newsletterSubscriber.count({ where: { status: 'UNSUBSCRIBED' } }),
    ]);
    return { total: subscribed + unsubscribed, subscribed, unsubscribed };
  }

  async delete(publicId: string): Promise<void> {
    try {
      await this.db.newsletterSubscriber.delete({ where: { publicId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new NotFoundError('newsletter subscriber', publicId);
      throw err;
    }
  }
}
