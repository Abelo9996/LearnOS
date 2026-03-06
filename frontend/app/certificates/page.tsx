'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'
import Link from 'next/link'

interface Certificate {
  certificate_id: string
  course_title: string
  completion_date: string
  mastery_score: number
  milestones_completed: number
  total_milestones: number
  verification_hash: string
  issued_at: string
}

export default function CertificatesPage() {
  const { user, loading: authLoading } = useAuth()
  const [certs, setCerts] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user) loadCerts()
    if (!authLoading && !user) setLoading(false)
  }, [user, authLoading])

  const loadCerts = async () => {
    try {
      const userId = getUserId()
      const res = await authFetch(`${API_URL}/api/certificates/user/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setCerts(data.certificates || [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const shareLinkedIn = (cert: Certificate) => {
    const url = encodeURIComponent(`${window.location.origin}/verify?hash=${cert.verification_hash}`)
    const title = encodeURIComponent(`Completed "${cert.course_title}" on LearnOS`)
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`,
      '_blank'
    )
  }

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please log in to view your certificates</p>
          <Link href="/login" className="text-violet-600 hover:text-violet-700 font-medium">Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🏅 My Certificates</h1>
          <p className="text-gray-500 mt-1">Your earned course completion certificates</p>
        </div>

        {certs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No certificates yet</h2>
            <p className="text-gray-500 mb-6">Complete a course to earn your first certificate!</p>
            <Link
              href="/explore"
              className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all"
            >
              Explore Courses
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {certs.map(cert => (
              <div key={cert.certificate_id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-2xl">🏅</div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Verified</span>
                </div>

                <h3 className="font-bold text-gray-900 mb-1">{cert.course_title}</h3>
                <p className="text-sm text-gray-500 mb-3">Completed {cert.completion_date}</p>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  {cert.mastery_score > 0 && <span>✨ {cert.mastery_score}% mastery</span>}
                  {cert.total_milestones > 0 && <span>📚 {cert.milestones_completed}/{cert.total_milestones}</span>}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <a
                    href={`${API_URL}/api/certificates/download/${cert.certificate_id}`}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    📥 PDF
                  </a>
                  <span className="text-gray-200">|</span>
                  <Link
                    href={`/verify?hash=${cert.verification_hash}`}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    🔗 Verify
                  </Link>
                  <span className="text-gray-200">|</span>
                  <button
                    onClick={() => shareLinkedIn(cert)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    💼 LinkedIn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
