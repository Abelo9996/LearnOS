'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface ConceptNode {
  concept: string
  prerequisites: string[]
  difficulty_score: number
  estimated_time_minutes: number
}

interface ConceptGraph {
  id: string
  goal: string
  nodes: Record<string, ConceptNode>
  edges: [string, string][]
}

export default function GraphPage() {
  const params = useParams()
  const router = useRouter()
  const goalId = params.goalId as string

  const [graph, setGraph] = useState<ConceptGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!goalId) return

    const fetchGraph = async () => {
      try {
        const response = await axios.get(`${API_URL}/graph/${goalId}`)
        setGraph(response.data.graph)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load graph')
      } finally {
        setLoading(false)
      }
    }

    fetchGraph()
  }, [goalId])

  const startLearning = async () => {
    try {
      const response = await axios.post(`${API_URL}/session/start`, {
        goal_id: goalId,
        user_id: 'demo_user'
      })

      router.push(`/learn/${response.data.session_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start session')
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center">
          <p className="text-secondary">Loading concept graph...</p>
        </div>
      </div>
    )
  }

  if (error || !graph) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700">{error || 'Graph not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">{graph.goal}</h1>
        <p className="text-secondary">
          {Object.keys(graph.nodes).length} concepts identified
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Concept Dependency Graph</h2>
            
            <div className="space-y-3">
              {Object.entries(graph.nodes).map(([name, node]) => (
                <div
                  key={name}
                  className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{node.concept}</h3>
                    <span className="text-xs px-2 py-1 bg-muted rounded">
                      {Math.round(node.difficulty_score * 100)}% difficulty
                    </span>
                  </div>
                  
                  {node.prerequisites.length > 0 && (
                    <div className="text-sm text-secondary">
                      Requires: {node.prerequisites.join(', ')}
                    </div>
                  )}
                  
                  <div className="text-xs text-secondary mt-2">
                    ~{node.estimated_time_minutes} minutes
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <h2 className="text-xl font-semibold mb-4">Learning Path</h2>
            
            <p className="text-sm text-secondary mb-6">
              This graph shows your personalized learning path. Each concept builds on previous ones.
              You must demonstrate mastery before progressing.
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Total Concepts</span>
                <span className="font-semibold">{Object.keys(graph.nodes).length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Est. Total Time</span>
                <span className="font-semibold">
                  {Math.round(
                    Object.values(graph.nodes).reduce(
                      (sum, node) => sum + node.estimated_time_minutes,
                      0
                    ) / 60
                  )}h
                </span>
              </div>
            </div>

            <button
              onClick={startLearning}
              className="btn-primary w-full"
            >
              Begin Learning
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
