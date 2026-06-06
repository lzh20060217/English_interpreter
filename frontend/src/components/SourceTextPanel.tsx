'use client';

import { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

import { useInterpreterStore } from '@/features/interpreter/store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export function SourceTextPanel() {
  const { theme, transcripts, status } = useInterpreterStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

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
            theme === 'dark' ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600'
          )}>
            <Mic size={16} />
          </div>
          <h3 className={cn(
            'text-sm font-semibold',
            theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
          )}>
            源文本
          </h3>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          status === 'recording'
            ? (theme === 'dark' ? 'bg-green-950/50 text-green-400' : 'bg-green-100 text-green-700')
            : (theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500')
        )}>
          {transcripts.length} 条
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {transcripts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center mb-3',
              theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
            )}>
              <Mic size={24} className={theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'} />
            </div>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            )}>
              点击开始录音按钮
            </p>
            <p className={cn(
              'text-xs mt-1',
              theme === 'dark' ? 'text-zinc-600' : 'text-zinc-500'
            )}>
              语音将实时转写为文本
            </p>
          </div>
        ) : (
          transcripts.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                'p-3 rounded-lg border',
                segment.isFinal
                  ? (theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200')
                  : (theme === 'dark' ? 'bg-blue-950/20 border-blue-900/30' : 'bg-blue-50 border-blue-100')
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={cn(
                  'text-sm leading-relaxed',
                  theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                )}>
                  {segment.text}
                </p>
                {!segment.isFinal && (
                  <span className="shrink-0 text-xs text-blue-500 animate-pulse">
                    ...
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs opacity-50">
                {segment.timestamp}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
