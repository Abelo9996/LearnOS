'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-indigo-50" />
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-8">
              <span>🚀</span> Open Source — Free Forever
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-gray-900 mb-6">
              The Open-Source
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                AI University
              </span>
            </h1>

            <p className="text-xl sm:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Personal AI tutors. Mastery-based learning. Community-created courses.
              <br />
              <span className="text-gray-900 font-medium">Education that adapts to you.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/register"
                className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200 text-lg"
              >
                Start Learning Free →
              </Link>
              <Link
                href="/explore"
                className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-lg"
              >
                Explore Courses
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
              <div>
                <div className="text-3xl font-bold text-gray-900">100%</div>
                <div className="text-sm text-gray-500">Open Source</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">AI</div>
                <div className="text-sm text-gray-500">Powered Tutors</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900">Free</div>
                <div className="text-sm text-gray-500">Self-Hosted</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            How LearnOS Works
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Think GitHub, but for education. Create courses, learn with AI tutors, earn certificates.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔍',
                title: 'Explore & Enroll',
                desc: 'Browse community-created courses. Star, fork, and enroll in courses that match your goals. Filter by category, difficulty, or topic.'
              },
              {
                icon: '🤖',
                title: 'Learn with AI',
                desc: 'Your personal AI tutor adapts to your pace. Socratic questioning, personalized assignments, real-time feedback. No pre-recorded lectures.'
              },
              {
                icon: '🏆',
                title: 'Prove Mastery',
                desc: 'Complete assignments, track your progress, earn certificates. Mastery-based — you advance when you understand, not when a timer expires.'
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">
            Why LearnOS?
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-4 pr-4 text-gray-600 font-medium">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <span className="text-violet-600 font-bold">LearnOS</span>
                  </th>
                  <th className="py-4 px-4 text-center text-gray-400">Coursera</th>
                  <th className="py-4 px-4 text-center text-gray-400">Khan Academy</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['Personal AI Tutor', '✅', '❌', '❌'],
                  ['Open Source', '✅', '❌', '❌'],
                  ['Self-Hostable', '✅', '❌', '❌'],
                  ['Community Courses', '✅', '❌', '❌'],
                  ['Mastery-Based', '✅', '❌', '✅'],
                  ['Adaptive Content', '✅', '❌', '⚠️'],
                  ['Free Tier', '✅', '⚠️', '✅'],
                  ['Star & Fork Courses', '✅', '❌', '❌'],
                  ['Bring Your Own LLM', '✅', '❌', '❌'],
                ].map(([feature, ...vals], i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">{feature}</td>
                    {vals.map((v, j) => (
                      <td key={j} className="py-3 px-4 text-center text-lg">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-violet-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to learn differently?
          </h2>
          <p className="text-violet-200 text-xl mb-10">
            Join the open-source education revolution. Free forever for self-hosted.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 bg-white text-violet-700 font-bold rounded-xl hover:bg-violet-50 transition-all text-lg"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/Abelo9996/LearnOS"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all text-lg"
            >
              ⭐ Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <span className="text-white font-bold">LearnOS</span>
            <span className="text-sm">— The Open-Source AI University</span>
          </div>
          <div className="flex gap-6 text-sm">
            <a href="https://github.com/Abelo9996/LearnOS" className="hover:text-white transition-colors">GitHub</a>
            <Link href="/explore" className="hover:text-white transition-colors">Explore Courses</Link>
            <Link href="/register" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
          <div className="text-sm">
            MIT License · Made with AI 🤖
          </div>
        </div>
      </footer>
    </div>
  )
}
