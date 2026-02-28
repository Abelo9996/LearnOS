'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/AuthProvider'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const inter = Inter({ subsets: ['latin'] })

function NavBar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    setIsLoggedIn(!!token)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    setIsLoggedIn(false)
    window.location.href = '/'
  }

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              LearnOS 🎓
            </Link>
            {isLoggedIn && (
              <div className="hidden md:flex gap-6">
                <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                  Home
                </Link>
                <Link href="/content-generation" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                  Generate Content
                </Link>
                <Link href="/llm-config" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                  LLM Config
                </Link>
                <Link href="/progress" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">
                  Progress
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <NavBar />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
