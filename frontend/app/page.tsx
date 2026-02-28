'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export default function Home() {
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    setIsLoggedIn(!!token)
  }, [])

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

      const { goal_id } = response.data
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
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Welcome to LearnOS 🎓
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          An AI-native learning platform with multi-LLM support, adaptive content, and real-time personalization.
        </p>

        {!isLoggedIn && (
          <div className="flex gap-4 justify-center mb-12">
            <a
              href="/register"
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Get Started Free
            </a>
            <a
              href="/login"
              className="px-8 py-3 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Sign In
            </a>
          </div>
        )}

        {isLoggedIn && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <a
              href="/content-generation"
              className="p-6 bg-white rounded-lg border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all"
            >
              <div className="text-3xl mb-2">📚</div>
              <h3 className="font-bold text-lg mb-1">Generate Content</h3>
              <p className="text-sm text-gray-600">AI-powered educational content</p>
            </a>
            <a
              href="/llm-config"
              className="p-6 bg-white rounded-lg border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all"
            >
              <div className="text-3xl mb-2">⚙️</div>
              <h3 className="font-bold text-lg mb-1">LLM Config</h3>
              <p className="text-sm text-gray-600">Manage AI providers & usage</p>
            </a>
            <a
              href="/progress"
              className="p-6 bg-white rounded-lg border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all"
            >
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-bold text-lg mb-1">Progress</h3>
              <p className="text-sm text-gray-600">Track your learning journey</p>
            </a>
          </div>
        )}

        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          What do you want to learn?
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Enter your learning goal and we'll create a personalized concept graph.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
        <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-2">
          Learning Goal
        </label>
        <textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px] resize-none"
          placeholder="e.g., Learn reinforcement learning well enough to build agents"
          disabled={loading}
        />
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          disabled={loading}
        >
          {loading ? 'Generating concept graph...' : 'Start Learning'}
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-600 mb-4">Quick Start Examples:</p>
        {examples.map((example, idx) => (
          <button
            key={idx}
            onClick={() => setGoal(example)}
            className="block w-full text-left p-4 bg-white border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 rounded-lg text-gray-700 transition-all"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}
