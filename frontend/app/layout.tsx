'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import NotificationBell from '@/components/NotificationBell'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const inter = Inter({ subsets: ['latin'] })

function NavBar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const isActive = (path: string) => pathname === path
  const isLanding = pathname === '/'

  const navLinks = user ? [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/explore', label: 'Explore', icon: '🔍' },
    { href: '/courses', label: 'My Courses', icon: '📚' },
    { href: '/tutor', label: 'AI Tutor', icon: '🤖' },
    { href: '/certificates', label: 'Certificates', icon: '🏅' },
  ] : []

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      isLanding
        ? scrolled
          ? 'bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
        : scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm'
          : 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 group">
              <span className="text-2xl group-hover:scale-110 transition-transform duration-200">🎓</span>
              <span className={`text-xl font-bold ${
                isLanding ? 'text-white' : 'bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent'
              }`}>
                LearnOS
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex gap-0.5">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.href)
                      ? 'text-violet-700 bg-violet-50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-1.5">{link.icon}</span>
                  {link.label}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-violet-600 rounded-full" />
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  href="/courses/create"
                  className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 shadow-sm shadow-violet-200/50 btn-press"
                >
                  <span>+</span> Create
                </Link>
                <NotificationBell />
                <Link
                  href="/settings/agents"
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200"
                  title="AI Settings"
                >
                  ⚙️
                </Link>
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all duration-200 ml-1"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                </Link>
                <button
                  onClick={logout}
                  className="text-sm text-gray-400 hover:text-gray-600 px-2 py-2 transition-all duration-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    isLanding ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 shadow-sm shadow-violet-200/50 btn-press"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
          mobileMenuOpen && user ? 'max-h-96 pb-4 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="space-y-1 stagger-children">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
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
              className="block px-4 py-3 rounded-lg text-sm font-medium text-violet-600 hover:bg-violet-50 transition-all duration-200"
            >
              ✨ Create Course
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>LearnOS — The Open-Source AI University</title>
        <meta name="description" content="Personal AI tutors, mastery-based learning, community-created courses. Education that adapts to you." />
      </head>
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>
          <NavBar />
          <main className="min-h-screen bg-[#fafafa]">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
