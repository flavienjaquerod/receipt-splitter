import './globals.css'

export const metadata = {
  title: 'Receipt Splitter - Split Grocery Receipts Easily',
  description: 'Upload your grocery receipt and split costs with your roommate effortlessly.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-700 ease-in-out">
        {children}
      </body>
    </html>
  )
}