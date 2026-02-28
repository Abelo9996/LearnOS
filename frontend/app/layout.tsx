import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/components/Toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LearnOS — AI-Powered Learning Platform',
  description: 'Your personalized AI learning companion. Create courses, generate roadmaps, and master any subject.',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
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
                <div className="flex gap-6 items-center">
                  <a href="/courses" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    My Courses
                  </a>
                  <a href="/courses/create" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    Create Course
                  </a>
                  <a href="/habits" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    Habits
                  </a>
                  <a href="/onboarding" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    Onboarding
                  </a>
                  <a href="/ai-settings" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
                    ⚙️ Settings
                  </a>
                  <a
                    href="https://github.com/Abelo9996/LearnOS"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                  >
                    <svg height="14" width="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/></svg>
                    Star on GitHub
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
