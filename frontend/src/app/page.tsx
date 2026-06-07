'use client';

import { useInterpreterStore } from '@/features/interpreter/store';
import { ControlPanel } from '@/components/ControlPanel';
import { SourceTextPanel } from '@/components/SourceTextPanel';
import { TranslationPanel } from '@/components/TranslationPanel';
import { ParaphrasePanel } from '@/components/ParaphrasePanel';
import { NotesPanel } from '@/components/NotesPanel';
import { cn } from '@/lib/utils';

export default function Home() {
  const { theme } = useInterpreterStore();

  return (
    <main className={cn(
      'flex flex-col h-screen w-full overflow-hidden',
      theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-100 text-zinc-900'
    )}>
      <ControlPanel />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 border-r border-zinc-800 dark:border-zinc-700">
          <SourceTextPanel />
        </div>

        <div className="flex-1 min-w-0 border-r border-zinc-800 dark:border-zinc-700">
          <TranslationPanel />
        </div>

        <div className="flex-1 min-w-0 border-r border-zinc-800 dark:border-zinc-700">
          <ParaphrasePanel />
        </div>

        <div className="flex-1 min-w-0">
          <NotesPanel />
        </div>
      </div>
    </main>
  );
}
