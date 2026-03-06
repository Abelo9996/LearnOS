'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { API_URL } from '@/lib/api'
import Link from 'next/link'

interface Certificate {
  user_display_name: string
  course_title: string
  completion_date: string
  mastery_score: number
  milestones_completed: number
  total_milestones: number
  verification_hash: string
  issued_at: string
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const [hash, setHash] = useState(searchParams.get('hash') || '')
  const [cert, setCert] = useState<Certificate | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const h = searchParams.get('hash')
    if (h) { setHash(h); doVerify(h) }
  }, [searchParams])

  const doVerify = async (h: string) => {
    setLoading(true)
    setError('')
    setCert(null)
    try {
      const res = await fetch(`${API_URL}/api/certificates/verify/${h}`)
      if (!res.ok) { setError('Certificate not found'); return }
      const data = await res.json()
      setCert(data.certificate)
    } catch { setError('Verification failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 py-16 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900">Verify Certificate</h1>
          <p className="text-gray-500 mt-1">Enter a verification code to validate a LearnOS certificate</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={hash}
              onChange={e => setHash(e.target.value.toUpperCase())}
              placeholder="Verification code (e.g., A1B2C3D4E5F6)"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <button
              onClick={() => doVerify(hash)}
              disabled={!hash.trim() || loading}
              className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-all"
            >
              {loading ? '...' : 'Verify'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">❌</div>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {cert && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-green-200 p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">✅</div>
              <h2 className="text-xl font-bold text-green-700">Certificate Verified</h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Recipient</div>
                <div className="text-lg font-semibold text-gray-900">{cert.user_display_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Course</div>
                <div className="text-lg font-semibold text-violet-700">{cert.course_title}</div>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Completed</div>
                  <div className="text-sm font-medium text-gray-900">{cert.completion_date}</div>
                </div>
                {cert.mastery_score > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">Mastery</div>
                    <div className="text-sm font-medium text-gray-900">{cert.mastery_score}%</div>
                  </div>
                )}
                {cert.total_milestones > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">Milestones</div>
                    <div className="text-sm font-medium text-gray-900">{cert.milestones_completed}/{cert.total_milestones}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <a
                href={`${API_URL}/api/certificates/download-by-hash/${cert.verification_hash}`}
                className="text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                📥 Download PDF
              </a>
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to LearnOS
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  )
}
