'use client';

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'
import Link from 'next/link'

interface ConceptDetail {
  concept: string
  status: string
  confidence: number
  attempts: number
  difficulty: number
  estimated_time: number
}

interface ProgressData {
  goal: string
  progress_percentage: number
  mastered_concepts: string[]
  available_concepts: string[]
  blocked_concepts: Record<string, string[]>
  engagement_score: number
  concept_details: ConceptDetail[]
  total_concepts: number
  next_concept: string | null
}

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth()
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(false)
  const [goalId, setGoalId] = useState('')

  const loadProgress = async () => {
    if (!goalId) return
    const userId = getUserId()

    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/progress?user_id=${userId}&goal_id=${goalId}`)
      if (res.ok) {
        const data = await res.json()
        setProgressData(data)
      }
    } catch (err) {
      console.error('Failed to load progress:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'mastered': return 'bg-green-100 text-green-700'
      case 'available': return 'bg-violet-100 text-violet-700'
      case 'blocked': return 'bg-gray-100 text-gray-500'
      default: return 'bg-gray-100 text-gray-500'
    }
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">Please log in to view progress</p>
        <Link href="/login" className="text-violet-600 hover:text-violet-700 font-medium">Sign In</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Learning Progress</h1>
        <p className="text-gray-500 mt-1">Track your concept mastery and engagement</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <label htmlFor="goalId" className="block text-sm font-medium text-gray-700 mb-2">
          Goal ID
        </label>
        <div className="flex gap-3">
          <input
            id="goalId"
            type="text"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            placeholder="Enter your goal ID"
          />
          <button
            onClick={loadProgress}
            className="px-5 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50 transition-all text-sm"
            disabled={!goalId}
          >
            Load Progress
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Loading progress...
        </div>
      )}

      {!loading && progressData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Progress</div>
              <div className="text-2xl font-bold text-violet-600">
                {Math.round(progressData.progress_percentage)}%
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Mastered</div>
              <div className="text-2xl font-bold text-green-600">
                {progressData.mastered_concepts.length}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Total Concepts</div>
              <div className="text-2xl font-bold text-gray-900">
                {progressData.total_concepts}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm text-gray-500 mb-1">Engagement</div>
              <div className="text-2xl font-bold text-indigo-600">
                {Math.round(progressData.engagement_score * 100)}%
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Goal</h2>
            <p className="text-gray-700">{progressData.goal}</p>
          </div>

          {progressData.next_concept && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-bold text-violet-900 mb-1">Next Up</h2>
              <p className="text-violet-800">{progressData.next_concept}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Concept Status</h2>
            <div className="space-y-3">
              {progressData.concept_details.map((concept) => (
                <div
                  key={concept.concept}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex-1">{concept.concept}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusColor(concept.status)}`}>
                      {concept.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Confidence</span>
                      <div className="font-semibold text-gray-900">{Math.round(concept.confidence * 100)}%</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Attempts</span>
                      <div className="font-semibold text-gray-900">{concept.attempts}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Difficulty</span>
                      <div className="font-semibold text-gray-900">{Math.round(concept.difficulty * 100)}%</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Est. Time</span>
                      <div className="font-semibold text-gray-900">{concept.estimated_time}m</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
