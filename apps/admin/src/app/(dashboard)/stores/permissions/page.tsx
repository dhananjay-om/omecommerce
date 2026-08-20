import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SyncPermissionsButton } from './sync-button';

export default function AdminPermissionsPage() {
  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every feature area (Orders, Coupons, Companies, and so on) checks for a specific
          permission before letting an admin use it. New features sometimes ship after your
          account was first set up, which can leave a gap — a menu that 403s even for a
          full-access admin. Use this to close that gap without touching a server.
        </p>
      </div>

      <Card className="mt-6 max-w-2xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Sync Super Admin permissions</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Grants every registered permission to the Super Admin role — safe to run any time, it
            only adds missing grants and never removes anything. After it runs, you (and any other
            Super Admin) need to sign out and sign back in, since permissions are set on your
            session at login, not checked live.
          </p>
          <SyncPermissionsButton />
        </CardContent>
      </Card>
    </div>
  );
}
