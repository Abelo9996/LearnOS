'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface LearningContent {
  concept: string
  modality: string
  content: string
  question: string | null
  context: Record<string, any>
}

export default function LearnPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [content, setContent] = useState<LearningContent | null>(null)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    loadSessionState()
  }, [sessionId])

  const loadSessionState = async () => {
    try {
      const res = await axios.get(`${API_URL}/session/state`, {
        params: { session_id: sessionId }
      })
      
      setContent(res.data.next_content)
      setProgress(res.data.progress_percentage)
    } catch (err: any) {
      console.error('Failed to load session:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!response.trim()) return

    setLoading(true)
    setFeedback('')

    try {
      const res = await axios.post(`${API_URL}/session/interact`, {
        session_id: sessionId,
        response: response.trim()
      })

      if (res.data.completed) {
        setCompleted(true)
        setFeedback('Congratulations! You have completed this learning goal.')
      } else if (res.data.concept_mastered) {
        setFeedback(`Excellent! You've mastered ${res.data.new_concept}. Moving to next concept.`)
        setContent(res.data.next_content)
        setProgress(res.data.progress_percentage)
        setResponse('')
      } else {
        setFeedback(res.data.feedback)
        if (res.data.next_content) {
          setContent(res.data.next_content)
        }
      }
    } catch (err: any) {
      setFeedback(err.response?.data?.detail || 'Error processing response')
    } finally {
      setLoading(false)
    }
  }

  if (!content) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <p className="text-center text-secondary">Loading...</p>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="card text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Goal Completed!
          </h1>
          <p className="text-lg text-secondary mb-6">
            You've demonstrated mastery of all concepts.
          </p>
          <a href="/" className="btn-primary inline-block">
            Start New Goal
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-secondary">Progress</span>
          <span className="text-sm font-semibold text-foreground">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Learning Content */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">{content.concept}</h1>
          <span className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
            {content.modality}
          </span>
        </div>

        <div className="prose prose-slate max-w-none mb-6">
          <div className="whitespace-pre-wrap text-foreground">
            {content.content}
          </div>
        </div>

        {content.question && (
          <div className="border-t border-border pt-4">
            <p className="font-semibold text-foreground mb-3">{content.question}</p>
          </div>
        )}
      </div>

      {/* Response Form */}
      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="response" className="block text-sm font-medium text-foreground mb-2">
          Your Explanation
        </label>
        <textarea
          id="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="input min-h-[150px] resize-none mb-4"
          placeholder="Explain the concept in your own words. Show your reasoning and provide examples..."
          disabled={loading}
        />

        {feedback && (
          <div className={`mb-4 p-4 rounded-md ${
            feedback.includes('Excellent') || feedback.includes('Strong')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
          }`}>
            {feedback}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || !response.trim()}
        >
          {loading ? 'Evaluating...' : 'Submit Explanation'}
        </button>

        <p className="text-xs text-secondary mt-3 text-center">
          Your response will be evaluated for depth of understanding, not just correctness.
        </p>
      </form>
    </div>
  )
}
