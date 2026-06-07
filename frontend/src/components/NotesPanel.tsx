'use client';

import { FileText } from 'lucide-react';

import { useInterpreterStore } from '@/features/interpreter/store';
import { cn } from '@/lib/utils';

export function NotesPanel() {
  const { theme, notes } = useInterpreterStore();

  const hasValidNotes = notes.length > 0 && !(notes.length === 1 && notes[0]?.content.includes('点击开始录音'));

  return (
    <div className={cn(
      'flex flex-col h-full',
      theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-50'
    )}>
      <div className={cn(
        'px-4 py-3 border-b flex items-center justify-between',
        theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'p-1.5 rounded',
            theme === 'dark' ? 'bg-amber-950/50 text-amber-400' : 'bg-amber-50 text-amber-600'
          )}>
            <FileText size={16} />
          </div>
          <h3 className={cn(
            'text-sm font-semibold',
            theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
          )}>
            口译笔记
          </h3>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500'
        )}>
          {notes.length} 条
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!hasValidNotes ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center mb-3',
              theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
            )}>
              <FileText size={24} className={theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'} />
            </div>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            )}>
              AI 将自动提取关键信息
            </p>
          </div>
        ) : (
          notes.map((block) => (
            <div
              key={block.id}
              className={cn(
                'p-4 rounded-lg border',
                theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
              )}
            >
              <pre className={cn(
                'text-base leading-relaxed whitespace-pre-wrap font-mono',
                theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
              )}>
                {block.content}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
