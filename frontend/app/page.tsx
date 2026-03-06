'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'

function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: string }) {
  return (
    <div
      className="group relative bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-violet-500/50 transition-all duration-500 overflow-hidden"
      style={{ animationDelay: delay }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 group-hover:border-violet-500/40 transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-6">
      <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
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
    <div className="bg-[#0a0a0a] text-white overflow-hidden">

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center">
        {/* Ambient background */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[128px] animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[128px] animate-float-delayed" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/5 rounded-full blur-[200px]" />
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 py-32 text-center">
          {/* Badge */}
          <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-sm font-medium text-gray-300 mb-10 ${mounted ? 'animate-fade-in-down' : 'opacity-0'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            Open Source · Free Forever · Self-Hosted
          </div>

          {/* Headline */}
          <h1 className={`text-6xl sm:text-8xl lg:text-9xl font-bold tracking-tight mb-8 leading-[0.9] ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <span className="text-white">The AI</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent bg-300% animate-gradient-x">
              University
            </span>
          </h1>

          {/* Subtitle */}
          <p className={`text-lg sm:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed ${mounted ? 'animate-stagger-2' : 'opacity-0'}`}>
            Personal AI tutors that adapt to you in real-time. No pre-recorded lectures.
            Mastery-based progression. Open source and community-driven.
          </p>

          {/* CTA */}
          <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-20 ${mounted ? 'animate-stagger-3' : 'opacity-0'}`}>
            <Link
              href="/register"
              className="group relative px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all duration-300 text-lg btn-press shadow-xl shadow-violet-500/25 overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Start Learning Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
            </Link>
            <a
              href="https://github.com/Abelo9996/LearnOS"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-lg btn-press backdrop-blur-sm"
            >
              ⭐ Star on GitHub
            </a>
          </div>

          {/* Stats */}
          <div className={`flex justify-center divide-x divide-gray-800 ${mounted ? 'animate-stagger-4' : 'opacity-0'}`}>
            <StatCard value="100%" label="Open Source" />
            <StatCard value="8" label="AI Agents" />
            <StatCard value="∞" label="Adaptive" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-gentle">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <div className="w-1 h-2.5 rounded-full bg-white/40 animate-pulse-soft" />
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="relative py-32 bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-900/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <p className="text-sm font-bold text-violet-400 uppercase tracking-[0.2em] mb-4">How It Works</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Learn smarter, not harder
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
              Think GitHub for education. Create courses, learn with AI, prove mastery.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon="🔍"
              title="Explore & Enroll"
              desc="Browse community courses. Star, fork, and enroll. Filter by category, difficulty, or trending. Like GitHub, but for learning."
              delay="0.1s"
            />
            <FeatureCard
              icon="🤖"
              title="AI-Powered Learning"
              desc="Your personal AI tutor adapts in real-time. Socratic questioning, personalized assignments, instant feedback. No recorded lectures."
              delay="0.2s"
            />
            <FeatureCard
              icon="🏆"
              title="Prove Mastery"
              desc="Advance when you understand — not when a timer expires. Earn verifiable certificates. Share achievements on LinkedIn."
              delay="0.3s"
            />
          </div>
        </div>
      </section>

      {/* ═══ AI TUTOR DEMO ═══ */}
      <section className="relative py-32 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-bold text-violet-400 uppercase tracking-[0.2em] mb-4">AI-Native</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                Every feature is
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">powered by AI</span>
              </h2>
              <p className="text-gray-400 mb-10 text-lg leading-relaxed">
                LearnOS isn't a course platform with AI bolted on. Every feature — content generation,
                assessment, tutoring — is built AI-first.
              </p>
              <div className="space-y-5">
                {[
                  { icon: '🧠', title: 'Adaptive Difficulty', desc: 'Adjusts to your performance in real-time' },
                  { icon: '💬', title: 'Socratic Dialogue', desc: 'The AI asks YOU questions to deepen understanding' },
                  { icon: '📊', title: 'Learning Analytics', desc: 'Track mastery, gaps, and engagement over time' },
                  { icon: '🔄', title: 'Multi-LLM', desc: 'OpenAI, Claude, Llama, Groq, or your own local model' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg flex-shrink-0 group-hover:border-violet-500/30 group-hover:bg-violet-500/10 transition-all duration-300">
                      {item.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{item.title}</div>
                      <div className="text-gray-500 text-sm">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-3xl blur-3xl" />
              <div className="relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800 bg-gray-900/80">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="ml-3 text-xs text-gray-500 font-mono">AI Tutor — Recursion & Data Structures</span>
                </div>
                {/* Chat */}
                <div className="p-6 space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-200 max-w-[85%]">
                      You mentioned recursion uses a call stack. What happens if a recursive function never hits its base case?
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tr-md px-4 py-3 text-sm text-gray-300 max-w-[85%]">
                      It would keep calling itself forever... stack overflow?
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">You</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-200 max-w-[85%]">
                      Exactly! 🎯 Each call adds a frame. Now — can you think of a data structure that behaves like a call stack but you control manually?
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-11">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce-gentle" style={{ animationDelay: '0s' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce-gentle" style={{ animationDelay: '0.15s' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce-gentle" style={{ animationDelay: '0.3s' }} />
                    </div>
                    <span className="text-xs text-gray-600">Adapting to your level...</span>
                  </div>
                </div>
                {/* Input bar */}
                <div className="px-5 py-4 border-t border-gray-800">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <span className="text-gray-600 text-sm flex-1">Type your answer...</span>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ COMPARISON ═══ */}
      <section className="relative py-32 bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-violet-400 uppercase tracking-[0.2em] mb-4">Why LearnOS</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white">
              Not another course platform
            </h2>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-4 px-6 text-sm font-medium text-gray-500">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <span className="text-sm font-bold text-violet-400">LearnOS</span>
                  </th>
                  <th className="py-4 px-4 text-center text-sm text-gray-600 font-medium">Coursera</th>
                  <th className="py-4 px-4 text-center text-sm text-gray-600 font-medium">Khan</th>
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
                  ['Free Forever', '✅', '⚠️', '✅'],
                  ['Fork & Remix', '✅', '❌', '❌'],
                  ['Bring Your Own LLM', '✅', '❌', '❌'],
                ].map(([feature, ...vals], i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-violet-500/5 transition-colors duration-200">
                    <td className="py-3.5 px-6 font-medium text-gray-300">{feature}</td>
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

      {/* ═══ CTA ═══ */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-[#0a0a0a] to-indigo-950" />
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[200px]" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Ready to learn
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">differently?</span>
          </h2>
          <p className="text-gray-400 text-xl mb-12 max-w-2xl mx-auto">
            Join the open-source education revolution. Free forever when self-hosted.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="group px-10 py-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all duration-300 text-lg btn-press shadow-xl shadow-violet-500/25"
            >
              Get Started Free
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-200 ml-2">→</span>
            </Link>
            <Link
              href="/explore"
              className="px-10 py-5 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-lg btn-press backdrop-blur-sm"
            >
              Explore Courses
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-gray-800/50 bg-[#050505] py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <span className="text-white font-bold text-lg">LearnOS</span>
                <p className="text-xs text-gray-600">The Open-Source AI University</p>
              </div>
            </div>
            <div className="flex gap-8 text-sm text-gray-500">
              <a href="https://github.com/Abelo9996/LearnOS" className="hover:text-white transition-colors duration-200">GitHub</a>
              <Link href="/explore" className="hover:text-white transition-colors duration-200">Explore</Link>
              <Link href="/register" className="hover:text-white transition-colors duration-200">Sign Up</Link>
            </div>
            <div className="text-sm text-gray-700">
              MIT License · Built with AI
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
