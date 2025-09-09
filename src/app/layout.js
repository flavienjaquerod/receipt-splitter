import './globals.css'

export const metadata = {
  title: 'Receipt Splitter - Split Grocery Receipts Easily',
  description: 'Upload your grocery receipt and split costs with your roommate effortlessly.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}