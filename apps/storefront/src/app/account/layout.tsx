import { requireSession } from '@/lib/session';
import { AccountNav } from '@/components/account/account-nav';

/** Gates every /account/* route in one place — requireSession() redirects to /login if not authenticated. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">My Account</h1>
      <div className="flex flex-col gap-8 md:flex-row">
        <AccountNav />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
