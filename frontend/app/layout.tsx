import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/components/Toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LearnOS — AI-Powered Learning Platform',
  description: 'Your personalized AI learning companion. Create courses, generate roadmaps, and master any subject.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <a href="/" className="flex items-center gap-2">
                  <span className="text-2xl">🧠</span>
                  <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    LearnOS
                  </span>
                </a>
                <div className="flex gap-6">
                  <a href="/courses" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    My Courses
                  </a>
                  <a href="/courses/create" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    Create Course
                  </a>
                  <a href="/habits" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    Habits
                  </a>
                  <a href="/ai-settings" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    ⚙️ Settings
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  )
}
