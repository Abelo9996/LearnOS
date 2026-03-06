'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import NotificationBell from '@/components/NotificationBell'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const inter = Inter({ subsets: ['latin'] })

function NavBar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => pathname === path

  const navLinks = user ? [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/explore', label: 'Explore', icon: '🔍' },
    { href: '/courses', label: 'My Courses', icon: '📚' },
    { href: '/tutor', label: 'AI Tutor', icon: '🤖' },
    { href: '/certificates', label: 'Certificates', icon: '🏅' },
  ] : []

  return (
    <nav className="border-b border-gray-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 group">
              <span className="text-2xl">🎓</span>
              <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                LearnOS
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1.5">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/courses/create"
                  className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm"
                >
                  <span>+</span> Create Course
                </Link>
                <NotificationBell />
                <Link
                  href="/settings/agents"
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                  title="AI Settings"
                >
                  ⚙️
                </Link>
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="font-medium">{user.display_name || user.username}</span>
                </Link>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 transition-colors"
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
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && user && (
          <div className="md:hidden pb-4 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive(link.href)
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            <Link
              href="/courses/create"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 rounded-lg text-sm font-medium text-violet-600 hover:bg-violet-50"
            >
              ✨ Create Course
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

function NavBarWrapper() {
  return <NavBar />
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>LearnOS — The Open-Source AI University</title>
        <meta name="description" content="Personal AI tutors, mastery-based learning, community-created courses. Education that adapts to you." />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <NavBarWrapper />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
