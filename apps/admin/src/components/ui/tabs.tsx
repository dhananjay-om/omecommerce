'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

/** Genuine in-page tab primitive (base-ui `Tabs.Root`/`List`/`Tab`/`Panel`)
 *  — for client-side panel switching within ONE page. For the horizontal
 *  tab STRIP that links between several real Next.js routes (the mock's
 *  everywhere-horizontal-tabs pattern, replacing the app's old left-rail
 *  sub-navs), use `NavTabs` (components/nav-tabs.tsx) instead — that one is
 *  plain `<Link>`s styled to match, not a controlled base-ui component,
 *  since real route navigation isn't panel-toggling. */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-4', className)} {...props} />;
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('flex items-center gap-1 border-b border-border', className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        '-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none',
        'hover:text-foreground',
        'data-[selected]:border-primary data-[selected]:text-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-t-sm',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn('outline-none', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
