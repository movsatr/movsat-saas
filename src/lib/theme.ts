import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('movsat-theme') as Theme | null;
    if (stored) return stored;
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('movsat-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggle, set: setTheme };
}
