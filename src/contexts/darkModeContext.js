// contexts/DarkModeContext.js
import { useState, useEffect, createContext, useContext } from 'react';

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      setIsDarkMode(JSON.parse(savedMode));
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  // Update localStorage and document class when dark mode changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    
    // Add transition class to document
    document.documentElement.classList.add('transitioning');
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      // Add sunset effect to body during transition
      document.body.classList.add('sunset-effect');
    } else {
      document.documentElement.classList.remove('dark');
      // Add sunrise effect to body during transition
      document.body.classList.add('sunrise-effect');
    }
    
    // Remove transition effects after animation completes
    const timeoutId = setTimeout(() => {
      document.documentElement.classList.remove('transitioning');
      document.body.classList.remove('sunset-effect', 'sunrise-effect');
    }, 2000); // 2 seconds for the full transition
    
    return () => clearTimeout(timeoutId);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsTransitioning(true);
    
    // Add a small delay to create anticipation
    setTimeout(() => {
      setIsDarkMode(prev => !prev);
      
      // Reset transition state after the animation
      setTimeout(() => {
        setIsTransitioning(false);
      }, 2000);
    }, 100);
  };

  return (
    <DarkModeContext.Provider value={{ 
      isDarkMode, 
      toggleDarkMode, 
      isTransitioning 
    }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}