'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, MonitorCog } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Cycles system → dark → light → system, persisted via next-themes'
 *  localStorage handling (the mock's own toggle deliberately does NOT
 *  persist — this one does, since a real daily-use app shouldn't reset a
 *  merchant's preference on every reload). `ThemeProvider` is mounted once
 *  in the root `app/layout.tsx` — `next-themes` was a declared-but-unused
 *  dependency before this. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // next-themes reads localStorage on mount, which SSR can't know — avoid
  // rendering the wrong icon for one frame (hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the official next-themes hydration-mismatch-avoidance recipe: server can't know the persisted theme, so this MUST run once after mount, not during render
    setMounted(true);
  }, []);

  function cycle() {
    setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
  }

  const Icon = !mounted ? MonitorCog : theme === 'dark' ? Moon : theme === 'light' ? Sun : MonitorCog;

  return (
    <Button variant="ghost" size="icon-sm" onClick={cycle} aria-label="Toggle theme" title={mounted ? `Theme: ${theme}` : 'Toggle theme'}>
      <Icon className="size-4" />
    </Button>
  );
}
