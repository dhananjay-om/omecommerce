import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { env } from '../../config/env.js';
import { createEmailSender } from '../order/order.module.js';
import { PrismaNewsletterRepository } from './infrastructure/prisma-newsletter.repository.js';
import {
  SubscribeToNewsletter,
  UnsubscribeFromNewsletter,
  AddSubscriber,
  ListSubscribers,
  SetSubscriberStatus,
  DeleteSubscriber,
  ExportSubscribersCsv,
} from './application/newsletter.usecases.js';
import {
  subscribeSchema,
  unsubscribeSchema,
  adminAddSubscriberSchema,
  setStatusSchema,
  listSubscribersQuerySchema,
  exportSubscribersQuerySchema,
} from './interface/http/schemas.js';

export interface NewsletterModule {
  admin: Router;
  store: Router;
}

/** Newsletter sign-ups. The two storefront routes are public (a visitor needs
 *  no account to subscribe, and an unsubscribe link must work without login —
 *  it's authorised by the subscriber's own random token). Admin routes sit
 *  behind `newsletter:manage`. */
export function createNewsletterModule(db: Db, authorize: (permission: string) => RequestHandler): NewsletterModule {
  const repo = new PrismaNewsletterRepository(db);
  const subscribe = new SubscribeToNewsletter(repo, createEmailSender(db), env.SITE_URL);
  const unsubscribe = new UnsubscribeFromNewsletter(repo);
  const addSubscriber = new AddSubscriber(repo);
  const listSubscribers = new ListSubscribers(repo);
  const setStatus = new SetSubscriberStatus(repo);
  const deleteSubscriber = new DeleteSubscriber(repo);
  const exportCsv = new ExportSubscribersCsv(repo);

  const store = Router();
  store.post(
    '/newsletter/subscribe',
    asyncHandler(async (req, res) => {
      const { alreadySubscribed } = await subscribe.execute(parse(subscribeSchema, req.body));
      res.status(202).json({ data: { subscribed: true, alreadySubscribed } });
    }),
  );
  store.post(
    '/newsletter/unsubscribe',
    asyncHandler(async (req, res) => {
      await unsubscribe.execute(parse(unsubscribeSchema, req.body).token);
      res.json({ data: { unsubscribed: true } });
    }),
  );

  const admin = Router();
  const manage = authorize('newsletter:manage');
  admin.get(
    '/newsletter/subscribers',
    manage,
    asyncHandler(async (req, res) => {
      res.json({ data: await listSubscribers.execute(parse(listSubscribersQuerySchema, req.query)) });
    }),
  );
  // Registered before the `:publicId` routes so "export" is never read as an id.
  admin.get(
    '/newsletter/subscribers/export',
    manage,
    asyncHandler(async (req, res) => {
      const csv = await exportCsv.execute(parse(exportSubscribersQuerySchema, req.query));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="newsletter-subscribers.csv"');
      res.send(csv);
    }),
  );
  admin.post(
    '/newsletter/subscribers',
    manage,
    asyncHandler(async (req, res) => {
      res.status(201).json({ data: await addSubscriber.execute(parse(adminAddSubscriberSchema, req.body).email) });
    }),
  );
  admin.patch(
    '/newsletter/subscribers/:publicId',
    manage,
    asyncHandler(async (req, res) => {
      res.json({ data: await setStatus.execute(req.params.publicId!, parse(setStatusSchema, req.body).status) });
    }),
  );
  admin.delete(
    '/newsletter/subscribers/:publicId',
    manage,
    asyncHandler(async (req, res) => {
      await deleteSubscriber.execute(req.params.publicId!);
      res.status(204).end();
    }),
  );

  return { admin, store };
}
