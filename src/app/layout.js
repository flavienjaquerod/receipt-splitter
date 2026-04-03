import './globals.css';
import { DarkModeProvider } from '../contexts/darkModeContext';
import { AuthProvider } from '../contexts/authContext';

export const metadata = {
  title: 'Receipt Splitter - Split Grocery Receipts Easily',
  description: 'Upload your grocery receipt and split costs with your roommate effortlessly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('darkMode');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'true' || (saved === null && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-700 ease-in-out">
        <AuthProvider>
          <DarkModeProvider>
            {children}
          </DarkModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
