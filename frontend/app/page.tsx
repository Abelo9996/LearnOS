'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export default function Home() {
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!goal.trim()) {
      setError('Please enter a learning goal')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await axios.post(`${API_URL}/goal`, {
        goal: goal.trim(),
        user_id: 'demo_user'
      })

      const { goal_id, graph_id } = response.data
      
      // Navigate to graph visualization
      router.push(`/graph/${goal_id}`)
    } catch (err: any) {
      console.error('Error creating goal:', err)
      setError(err.response?.data?.detail || 'Failed to create learning goal')
    } finally {
      setLoading(false)
    }
  }

  const examples = [
    'Learn reinforcement learning well enough to build agents',
    'Master neural networks from fundamentals to advanced architectures',
    'Understand machine learning algorithms deeply',
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          What do you want to learn?
        </h1>
        <p className="text-lg text-secondary">
          Enter your learning goal. LearnOS will build a personalized concept graph and guide you to mastery.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card mb-8">
        <label htmlFor="goal" className="block text-sm font-medium text-foreground mb-2">
          Learning Goal
        </label>
        <textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="input min-h-[120px] resize-none"
          placeholder="e.g., Learn reinforcement learning well enough to build agents"
          disabled={loading}
        />
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full mt-4"
          disabled={loading}
        >
          {loading ? 'Generating concept graph...' : 'Start Learning'}
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-sm font-medium text-secondary">Examples:</p>
        {examples.map((example, idx) => (
          <button
            key={idx}
            onClick={() => setGoal(example)}
            className="block w-full text-left p-3 bg-muted hover:bg-gray-200 rounded-md text-sm text-foreground transition-colors"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}
