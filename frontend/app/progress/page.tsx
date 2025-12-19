'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

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
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [goalId, setGoalId] = useState('')

  const loadProgress = async () => {
    if (!goalId) return

    setLoading(true)
    try {
      const response = await axios.get(`${API_URL}/progress`, {
        params: {
          user_id: 'demo_user',
          goal_id: goalId
        }
      })
      setProgressData(response.data)
    } catch (err: any) {
      console.error('Failed to load progress:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'mastered':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'available':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'blocked':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">Learning Progress</h1>

      <div className="card mb-8">
        <label htmlFor="goalId" className="block text-sm font-medium text-foreground mb-2">
          Goal ID
        </label>
        <div className="flex gap-3">
          <input
            id="goalId"
            type="text"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="input flex-1"
            placeholder="Enter your goal ID"
          />
          <button
            onClick={loadProgress}
            className="btn-primary"
            disabled={!goalId}
          >
            Load Progress
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-secondary">Loading progress...</p>
        </div>
      )}

      {!loading && progressData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="text-sm text-secondary mb-1">Progress</div>
              <div className="text-3xl font-bold text-primary">
                {Math.round(progressData.progress_percentage)}%
              </div>
            </div>

            <div className="card">
              <div className="text-sm text-secondary mb-1">Mastered</div>
              <div className="text-3xl font-bold text-green-600">
                {progressData.mastered_concepts.length}
              </div>
            </div>

            <div className="card">
              <div className="text-sm text-secondary mb-1">Total Concepts</div>
              <div className="text-3xl font-bold text-foreground">
                {progressData.total_concepts}
              </div>
            </div>

            <div className="card">
              <div className="text-sm text-secondary mb-1">Engagement</div>
              <div className="text-3xl font-bold text-accent">
                {Math.round(progressData.engagement_score * 100)}%
              </div>
            </div>
          </div>

          <div className="card mb-8">
            <h2 className="text-xl font-semibold mb-4">Goal</h2>
            <p className="text-lg text-foreground">{progressData.goal}</p>
          </div>

          {progressData.next_concept && (
            <div className="card mb-8 bg-primary/5 border-primary">
              <h2 className="text-xl font-semibold mb-2 text-primary">Next Up</h2>
              <p className="text-lg text-foreground">{progressData.next_concept}</p>
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold mb-6">Concept Status</h2>
            
            <div className="space-y-4">
              {progressData.concept_details.map((concept) => (
                <div
                  key={concept.concept}
                  className="border border-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground flex-1">
                      {concept.concept}
                    </h3>
                    <span className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(concept.status)}`}>
                      {concept.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-secondary">Confidence</span>
                      <div className="font-semibold">
                        {Math.round(concept.confidence * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-secondary">Attempts</span>
                      <div className="font-semibold">{concept.attempts}</div>
                    </div>
                    <div>
                      <span className="text-secondary">Difficulty</span>
                      <div className="font-semibold">
                        {Math.round(concept.difficulty * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-secondary">Est. Time</span>
                      <div className="font-semibold">{concept.estimated_time}m</div>
                    </div>
                  </div>

                  {concept.confidence > 0 && concept.confidence < 0.8 && concept.status !== 'mastered' && (
                    <div className="mt-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                      Need more depth to demonstrate mastery
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
