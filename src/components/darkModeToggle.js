// components/DarkModeToggle.js
import { useDarkMode } from '../contexts/darkModeContext';

export default function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  if(isDarkMode === null) {
    return <div className='w-10 h-10'/>
  }

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-700 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 transform hover:scale-105 ${
        isDarkMode 
          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-800 focus:ring-purple-500 focus:ring-offset-gray-900 shadow-lg shadow-purple-500/25' 
          : 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 focus:ring-blue-500 focus:ring-offset-white shadow-lg shadow-blue-500/25'
      }`}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
    >
      {/* Background gradient overlay for smooth color transitions */}
      <div className={`absolute inset-0 rounded-full transition-opacity duration-700 ease-in-out ${
        isDarkMode 
          ? 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 opacity-100'
          : 'bg-gradient-to-r from-sky-300 via-sky-400 to-sky-500 opacity-100'
      }`} />
      
      {/* Stars for night mode */}
      <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
        isDarkMode ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="absolute top-1 left-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
        <div className="absolute top-2 left-4 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-300" />
        <div className="absolute bottom-2 left-3 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-700" />
      </div>
      
      {/* Animated background icons */}
      <div className="absolute inset-0 flex items-center justify-between px-1 z-10">
        {/* Sun icon with rising animation */}
        <div className={`transition-all duration-700 ease-in-out transform ${
          isDarkMode 
            ? 'opacity-0 translate-y-2 scale-75 rotate-180' 
            : 'opacity-100 translate-y-0 scale-100 rotate-0'
        }`}>
          <svg className="h-4 w-4 text-yellow-200 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        </div>
        
        {/* Moon icon with rising/setting animation */}
        <div className={`transition-all duration-700 ease-in-out transform ${
          isDarkMode 
            ? 'opacity-100 translate-y-0 scale-100 rotate-0' 
            : 'opacity-0 translate-y-2 scale-75 -rotate-180'
        }`}>
          <svg className="h-4 w-4 text-slate-200 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        </div>
      </div>
      
      {/* Toggle circle with enhanced animations */}
      <span
        className={`inline-block h-6 w-6 transform rounded-full shadow-lg transition-all duration-700 ease-in-out z-20 ${
          isDarkMode 
            ? 'translate-x-6 bg-gradient-to-br from-slate-100 to-slate-200 shadow-slate-400/50' 
            : 'translate-x-1 bg-gradient-to-br from-white to-yellow-50 shadow-blue-400/50'
        }`}
      >
        {/* Inner glow effect */}
        <div className={`absolute inset-0.5 rounded-full transition-all duration-700 ease-in-out ${
          isDarkMode 
            ? 'bg-gradient-to-br from-slate-50 to-slate-100' 
            : 'bg-gradient-to-br from-yellow-50 to-white'
        }`} />
      </span>
    </button>
  );
}