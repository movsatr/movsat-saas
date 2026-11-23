import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('movsat-theme');
    if (stored === 'light' || stored === 'dark') return stored;
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
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('movsat-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggle, set: setTheme };
}
