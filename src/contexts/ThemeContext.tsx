import { createContext, useContext, useEffect, useState, ReactNode, FC } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      // First check localStorage
      const savedTheme = localStorage.getItem('theme');
      console.log('Saved theme:', savedTheme); // Debug log
      if (savedTheme === 'dark') {
        return true;
      } else if (savedTheme === 'light') {
        return false;
      }
      // If no saved theme, check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log('System prefers dark:', systemPrefersDark); // Debug log
      return systemPrefersDark;
    } catch {
      // Fallback if localStorage is not available
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  });

  // Apply theme immediately on mount
  useEffect(() => {
    const root = document.documentElement;
    console.log('Applying theme - isDarkMode:', isDarkMode); // Debug log
    console.log('Current classes before:', root.className); // Debug log
    
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    console.log('Current classes after:', root.className); // Debug log
    
    try {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignore localStorage errors
    }
  }, [isDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if no theme is saved in localStorage
      try {
        if (!localStorage.getItem('theme')) {
          setIsDarkMode(e.matches);
        }
      } catch {
        // If localStorage is not available, always follow system preference
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    console.log('Toggle theme called, current isDarkMode:', isDarkMode); // Debug log
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
