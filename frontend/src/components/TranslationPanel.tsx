'use client';

import { useEffect, useRef } from 'react';
import { Languages } from 'lucide-react';

import { useInterpreterStore } from '@/features/interpreter/store';
import { cn } from '@/lib/utils';

export function TranslationPanel() {
  const { theme, translations } = useInterpreterStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [translations]);

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
            theme === 'dark' ? 'bg-purple-950/50 text-purple-400' : 'bg-purple-50 text-purple-600'
          )}>
            <Languages size={16} />
          </div>
          <h3 className={cn(
            'text-sm font-semibold',
            theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
          )}>
            翻译文本
          </h3>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500'
        )}>
          {translations.length} 条
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {translations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center mb-3',
              theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
            )}>
              <Languages size={24} className={theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'} />
            </div>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            )}>
              翻译结果将显示在这里
            </p>
          </div>
        ) : (
          translations.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                'p-3 rounded-lg border',
                theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
              )}
            >
              <p className={cn(
                'text-sm leading-relaxed',
                theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
              )}>
                {segment.text}
              </p>
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
