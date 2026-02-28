'use client'

import { useState } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export default function ContentGenerationPage() {
  const [concept, setConcept] = useState('')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<any>(null)
  const [error, setError] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const handleGenerateContent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(
        `${API_URL}/content/generate`,
        {
          concept: concept.trim(),
          difficulty_level: difficulty,
          user_id: 'demo_user'
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )

      setContent(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate content')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">Content Generation 📚</h1>
      <p className="text-gray-600 mb-8">Generate rich, multi-modal educational content powered by AI</p>

      <form onSubmit={handleGenerateContent} className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Concept</label>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g., Neural Networks, Quantum Computing, etc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg mb-4 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !concept.trim()}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating...' : 'Generate Content'}
        </button>
      </form>

      {content && (
        <div className="space-y-6">
          {/* Explanation */}
          {content.explanation && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">📖 Explanation</h2>
              <p className="text-gray-700 leading-relaxed">{content.explanation}</p>
            </div>
          )}

          {/* Analogies */}
          {content.analogies && content.analogies.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">💡 Analogies</h2>
              <ul className="space-y-2">
                {content.analogies.map((analogy: string, i: number) => (
                  <li key={i} className="flex items-start">
                    <span className="text-indigo-600 mr-3">→</span>
                    <span className="text-gray-700">{analogy}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Examples */}
          {content.examples && content.examples.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">🎯 Examples</h2>
              <ul className="space-y-2">
                {content.examples.map((example: string, i: number) => (
                  <li key={i} className="flex items-start">
                    <span className="text-green-600 mr-3">✓</span>
                    <span className="text-gray-700">{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Code Sample */}
          {content.code_sample && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">💻 Code Sample</h2>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto text-sm">
                <code>{content.code_sample}</code>
              </pre>
            </div>
          )}

          {/* Diagram */}
          {content.diagram && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">📊 Diagram</h2>
              <div className="bg-gray-50 p-4 rounded border border-gray-200 text-sm text-gray-600">
                <pre>{content.diagram}</pre>
              </div>
            </div>
          )}

          {/* Interactive Question */}
          {content.interactive_question && (
            <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
              <h2 className="text-xl font-bold mb-4">❓ Try This</h2>
              <p className="text-gray-700">{content.interactive_question}</p>
            </div>
          )}

          {/* Real-world Applications */}
          {content.real_world_applications && content.real_world_applications.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">🌍 Real-world Applications</h2>
              <ul className="space-y-2">
                {content.real_world_applications.map((app: string, i: number) => (
                  <li key={i} className="flex items-start">
                    <span className="text-blue-600 mr-3">→</span>
                    <span className="text-gray-700">{app}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
