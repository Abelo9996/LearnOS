'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  return (
    <span className="tabular-nums">{target}{suffix}</span>
  )
}

function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: string }) {
  return (
    <div
      className={`group relative bg-white rounded-2xl p-8 border border-gray-100 card-hover animate-fade-in-up`}
      style={{ animationDelay: delay }}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading) return null

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Hero */}
      <section className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-200/30 rounded-full blur-3xl animate-float" />
        <div className="absolute top-40 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-100/20 rounded-full blur-3xl animate-float-slow" />

        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-32 sm:pt-28 sm:pb-40">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-sm font-medium mb-8 ${mounted ? 'animate-fade-in-down' : 'opacity-0'}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              Open Source — Free Forever
            </div>

            {/* Headline */}
            <h1 className={`text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-6 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              The Future of
              <br />
              <span className="gradient-text">
                Education
              </span>
            </h1>

            {/* Subtitle */}
            <p className={`text-lg sm:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed ${mounted ? 'animate-stagger-2' : 'opacity-0'}`}>
              Personal AI tutors that adapt to you. Mastery-based learning.
              Community courses. No pre-recorded lectures — ever.
            </p>

            {/* CTA Buttons */}
            <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-20 ${mounted ? 'animate-stagger-3' : 'opacity-0'}`}>
              <Link
                href="/register"
                className="group relative px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-2xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200/50 text-lg btn-press overflow-hidden"
              >
                <span className="relative z-10">Start Learning Free →</span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/explore"
                className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-2xl border border-gray-200 hover:border-violet-200 hover:bg-violet-50/50 transition-all text-lg btn-press"
              >
                Explore Courses
              </Link>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-8 max-w-md mx-auto ${mounted ? 'animate-stagger-4' : 'opacity-0'}`}>
              {[
                { value: '100%', label: 'Open Source' },
                { value: 'AI', label: 'Powered Tutors' },
                { value: 'Free', label: 'Self-Hosted' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 52C120 44 240 28 360 24C480 20 600 28 720 32C840 36 960 36 1080 32C1200 28 1320 20 1380 16L1440 12V60H0Z" fill="#fafafa"/>
          </svg>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 sm:py-32 bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Learn smarter, not harder
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Think GitHub, but for education. Create courses, learn with AI tutors, prove mastery.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon="🔍"
              title="Explore & Enroll"
              desc="Browse community-created courses. Star, fork, and enroll in courses that match your goals. Filter by category, difficulty, or topic."
              delay="0.1s"
            />
            <FeatureCard
              icon="🤖"
              title="Learn with AI"
              desc="Your personal AI tutor adapts in real-time. Socratic questioning, personalized assignments, instant feedback. No recorded lectures."
              delay="0.2s"
            />
            <FeatureCard
              icon="🏆"
              title="Prove Mastery"
              desc="Complete assignments, track progress, earn verifiable certificates. You advance when you understand — not when a timer runs out."
              delay="0.3s"
            />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-24 sm:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-3">Why LearnOS</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Not another course platform
            </h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-4 px-6 text-sm font-medium text-gray-500">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <span className="text-sm font-bold text-violet-600">LearnOS</span>
                  </th>
                  <th className="py-4 px-4 text-center text-sm text-gray-400 font-medium">Coursera</th>
                  <th className="py-4 px-4 text-center text-sm text-gray-400 font-medium">Khan</th>
                </tr>
              </thead>
              <tbody className="text-sm stagger-children">
                {[
                  ['Personal AI Tutor', '✅', '❌', '❌'],
                  ['Open Source', '✅', '❌', '❌'],
                  ['Self-Hostable', '✅', '❌', '❌'],
                  ['Community Courses', '✅', '❌', '❌'],
                  ['Mastery-Based', '✅', '❌', '✅'],
                  ['Adaptive Content', '✅', '❌', '⚠️'],
                  ['Free Forever', '✅', '⚠️', '✅'],
                  ['Fork & Remix', '✅', '❌', '❌'],
                  ['Bring Your Own LLM', '✅', '❌', '❌'],
                ].map(([feature, ...vals], i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-violet-50/30 transition-colors duration-200">
                    <td className="py-3.5 px-6 font-medium text-gray-900">{feature}</td>
                    {vals.map((v, j) => (
                      <td key={j} className="py-3.5 px-4 text-center text-base">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-24 sm:py-32 bg-[#fafafa]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-violet-600 uppercase tracking-wide mb-3">AI-Native</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Every feature is powered by AI
              </h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                LearnOS isn't a course platform with AI bolted on. Every feature — from content generation
                to assessment to tutoring — is built AI-first. Your tutor knows your strengths,
                weaknesses, and learning style.
              </p>
              <div className="space-y-4">
                {[
                  { icon: '🧠', text: 'Adaptive difficulty based on your performance' },
                  { icon: '💬', text: 'Socratic dialogue — the AI asks YOU questions' },
                  { icon: '📊', text: 'Real-time learning analytics and insights' },
                  { icon: '🔄', text: 'Multi-LLM support — OpenAI, Claude, Llama, or local' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <span className="text-lg group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
                    <span className="text-gray-700 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-100 to-indigo-100 rounded-3xl blur-2xl opacity-40" />
              <div className="relative bg-white rounded-2xl border border-gray-100 p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-2 text-xs text-gray-400">AI Tutor Session</span>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                    <div className="bg-violet-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 max-w-[85%]">
                      You mentioned recursion uses a call stack. What happens if a recursive function never hits its base case?
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-gray-100 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-gray-700 max-w-[85%]">
                      It would keep calling itself forever... stack overflow?
                    </div>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm flex-shrink-0">👤</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                    <div className="bg-violet-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-700 max-w-[85%]">
                      Exactly! 🎯 Each call adds a frame to the stack. Can you think of a real-world analogy for this?
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 pl-11">
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce-gentle" style={{ animationDelay: '0s' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce-gentle" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce-gentle" style={{ animationDelay: '0.3s' }} />
                    </div>
                    AI is adapting to your level...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to learn differently?
          </h2>
          <p className="text-violet-200 text-lg sm:text-xl mb-10 max-w-2xl mx-auto">
            Join the open-source education revolution. Free forever for self-hosted.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="group px-8 py-4 bg-white text-violet-700 font-bold rounded-2xl hover:bg-violet-50 transition-all text-lg btn-press shadow-lg"
            >
              Get Started Free
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-200 ml-1">→</span>
            </Link>
            <a
              href="https://github.com/Abelo9996/LearnOS"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border-2 border-white/20 text-white font-semibold rounded-2xl hover:bg-white/10 transition-all text-lg btn-press backdrop-blur-sm"
            >
              ⭐ Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <span className="text-white font-bold text-lg">LearnOS</span>
                <p className="text-sm text-gray-500">The Open-Source AI University</p>
              </div>
            </div>
            <div className="flex gap-8 text-sm">
              <a href="https://github.com/Abelo9996/LearnOS" className="hover:text-white transition-colors duration-200 hover-underline">GitHub</a>
              <Link href="/explore" className="hover:text-white transition-colors duration-200 hover-underline">Explore</Link>
              <Link href="/register" className="hover:text-white transition-colors duration-200 hover-underline">Sign Up</Link>
            </div>
            <div className="text-sm text-gray-600">
              MIT License · Made with AI 🤖
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
