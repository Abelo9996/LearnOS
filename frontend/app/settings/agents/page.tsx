'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'
import Link from 'next/link'

const LLM_OPTIONS = [
  { provider: 'openai', model: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast & affordable', icon: '⚡' },
  { provider: 'openai', model: 'gpt-4o', label: 'GPT-4o', desc: 'Most capable', icon: '🧠' },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', label: 'Claude Sonnet', desc: 'Thoughtful & detailed', icon: '📝' },
  { provider: 'groq', model: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B (Groq)', desc: 'Ultra fast, open-source', icon: '🦙' },
  { provider: 'local', model: 'llama3.1', label: 'Local Model (Ollama)', desc: 'Private, self-hosted', icon: '🏠' },
]

interface AgentStats {
  total_rated: number
  avg_quality: number
  mastery_count: number
}

export default function AgentSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [stats, setStats] = useState<Record<string, AgentStats>>({})
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user) loadData()
    if (!authLoading && !user) setLoading(false)
  }, [user, authLoading])

  const loadData = async () => {
    const userId = getUserId()
    try {
      const [prefRes, statsRes, profileRes] = await Promise.all([
        authFetch(`${API_URL}/api/agents/llm/preference/${userId}`),
        fetch(`${API_URL}/api/agents/metrics/stats`),
        authFetch(`${API_URL}/api/agents/memory/${userId}`),
      ])
      if (prefRes.ok) {
        const p = await prefRes.json()
        setSelectedProvider(p.provider || 'openai')
        setSelectedModel(p.model || 'gpt-4o-mini')
      }
      if (statsRes.ok) {
        const s = await statsRes.json()
        setStats(s.stats || {})
      }
      if (profileRes.ok) {
        const pr = await profileRes.json()
        setProfile(pr.profile)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const savePref = async () => {
    setSaving(true)
    const userId = getUserId()
    await authFetch(`${API_URL}/api/agents/llm/preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, provider: selectedProvider, model: selectedModel }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  if (!user) return <div className="min-h-screen flex items-center justify-center"><Link href="/login" className="text-violet-600">Sign in</Link></div>

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🤖 AI Agent Settings</h1>
          <p className="text-gray-500 mt-1">Configure your AI learning experience</p>
        </div>

        {/* LLM Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Choose Your AI Model</h2>
          <p className="text-sm text-gray-500 mb-4">Select which LLM powers your tutoring, research, and certification agents</p>

          <div className="space-y-2">
            {LLM_OPTIONS.map(opt => (
              <button
                key={`${opt.provider}-${opt.model}`}
                onClick={() => { setSelectedProvider(opt.provider); setSelectedModel(opt.model) }}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                  selectedProvider === opt.provider && selectedModel === opt.model
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.desc}</div>
                </div>
                {selectedProvider === opt.provider && selectedModel === opt.model && (
                  <span className="text-violet-600 font-bold">✓</span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={savePref}
            disabled={saving}
            className="mt-4 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-all text-sm font-medium"
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Preference'}
          </button>
        </div>

        {/* Agent Quality Metrics */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Agent Quality Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'tutor', label: 'Tutor', icon: '🎓' },
              { key: 'research', label: 'Research', icon: '🔬' },
              { key: 'community', label: 'Community', icon: '👥' },
              { key: 'certification', label: 'Certification', icon: '🏅' },
            ].map(agent => {
              const s = stats[agent.key] || { total_rated: 0, avg_quality: 0, mastery_count: 0 }
              return (
                <div key={agent.key} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-1">{agent.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">{agent.label}</div>
                  <div className="text-2xl font-bold text-violet-600 mt-2">
                    {s.avg_quality > 0 ? `${s.avg_quality}` : '—'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {s.total_rated} rated · {s.mastery_count} mastery
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Learner Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">🧠 Your Learner Profile</h2>
          <p className="text-sm text-gray-500 mb-4">What the agents know about you (shared across all agents)</p>

          {profile?.streak && (
            <div className="flex gap-6 mb-4">
              <div>
                <span className="text-2xl">🔥</span>
                <span className="ml-1 font-bold text-gray-900">{profile.streak.current_streak || 0}</span>
                <span className="text-xs text-gray-500 ml-1">day streak</span>
              </div>
              <div>
                <span className="text-2xl">📅</span>
                <span className="ml-1 font-bold text-gray-900">{profile.streak.total_active_days || 0}</span>
                <span className="text-xs text-gray-500 ml-1">total days</span>
              </div>
            </div>
          )}

          {profile?.agents && Object.keys(profile.agents).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(profile.agents).map(([agent, memory]: [string, any]) => (
                <div key={agent} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase">{agent} Agent Memory</div>
                  <pre className="text-xs text-gray-700 mt-1 overflow-x-auto">{JSON.stringify(memory, null, 2)}</pre>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No agent memory yet. Start learning and your AI agents will build a profile!</p>
          )}
        </div>
      </div>
    </div>
  )
}
