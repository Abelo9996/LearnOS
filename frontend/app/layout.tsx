import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LearnOS - Agentic Learning Operating System',
  description: 'Production-grade AI-native learning platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b border-border bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <a href="/" className="text-xl font-bold text-foreground">
                  LearnOS
                </a>
              </div>
              <div className="flex gap-6">
                <a href="/" className="text-secondary hover:text-foreground transition-colors">
                  New Goal
                </a>
                <a href="/progress" className="text-secondary hover:text-foreground transition-colors">
                  Progress
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  )
}
