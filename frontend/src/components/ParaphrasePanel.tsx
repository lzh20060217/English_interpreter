'use client';

import { useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';

import { useInterpreterStore } from '@/features/interpreter/store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export function ParaphrasePanel() {
  const { theme, paraphrases } = useInterpreterStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [paraphrases]);

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
            theme === 'dark' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
          )}>
            <FileText size={16} />
          </div>
          <h3 className={cn(
            'text-sm font-semibold',
            theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
          )}>
            原语重述
          </h3>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500'
        )}>
          {paraphrases.length} 条
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {paraphrases.length === 0 ? (
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
              同语言简化重述
            </p>
            <p className={cn(
              'text-xs mt-1',
              theme === 'dark' ? 'text-zinc-600' : 'text-zinc-500'
            )}>
              将源语言内容用更简单的表达方式重述
            </p>
          </div>
        ) : (
          paraphrases.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                'p-3 rounded-lg border space-y-2',
                theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
              )}
            >
              {/* Original text */}
              <div>
                <div className={cn(
                  'text-xs font-medium mb-1',
                  theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                )}>
                  原文
                </div>
                <p className={cn(
                  'text-sm leading-relaxed',
                  theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'
                )}>
                  {segment.originalText}
                </p>
              </div>

              {/* Separator */}
              <div className={cn(
                'h-px',
                theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'
              )} />

              {/* Paraphrase text */}
              <div>
                <div className={cn(
                  'text-xs font-medium mb-1 text-emerald-500'
                )}>
                  简化重述
                </div>
                <p className={cn(
                  'text-sm leading-relaxed font-medium',
                  theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                )}>
                  {segment.paraphraseText}
                </p>
              </div>

              <div className={cn(
                'text-xs',
                theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'
              )}>
                {segment.timestamp}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
