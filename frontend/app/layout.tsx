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
                <a href="/courses" className="text-secondary hover:text-foreground transition-colors">
                  My Courses
                </a>
                <a href="/courses/create" className="text-secondary hover:text-foreground transition-colors">
                  Create Course
                </a>
                <a href="/habits" className="text-secondary hover:text-foreground transition-colors">
                  Habits
                </a>
                <a href="/ai-settings" className="text-secondary hover:text-foreground transition-colors">
                  AI Settings
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
