'use client';

import { useEffect } from 'react';
import { useInterpreterStore } from '@/features/interpreter/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useInterpreterStore();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
