'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'
import Link from 'next/link'

interface Milestone {
  title: string
  description: string
  estimated_hours: number
  concepts: string[]
  completed?: boolean
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [course, setCourse] = useState<any>(null)
  const [meta, setMeta] = useState<any>(null)
  const [roadmap, setRoadmap] = useState<any>(null)
  const [starred, setStarred] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCourse()
  }, [courseId])

  const loadCourse = async () => {
    try {
      const userId = user ? getUserId() : ''
      const res = await fetch(`${API_URL}/api/marketplace/course/${courseId}?user_id=${userId}`)
      if (!res.ok) { router.push('/explore'); return }
      const data = await res.json()
      setCourse(data.course)
      setMeta(data.meta || {})
      setRoadmap(data.roadmap)
      setStarred(data.starred)
      setIsOwner(data.is_owner)
    } catch {
      router.push('/explore')
    } finally {
      setLoading(false)
    }
  }

  const handleStar = async () => {
    if (!user) { router.push('/login'); return }
    const userId = getUserId()
    const endpoint = starred ? 'unstar' : 'star'
    await authFetch(`${API_URL}/api/marketplace/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, course_id: courseId }),
    })
    setStarred(!starred)
    setMeta((m: any) => ({ ...m, star_count: (m?.star_count || 0) + (starred ? -1 : 1) }))
  }

  const handleFork = async () => {
    if (!user) { router.push('/login'); return }
    const userId = getUserId()
    const res = await authFetch(`${API_URL}/api/marketplace/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, course_id: courseId }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/courses/${data.course.course_id}`)
    }
  }

  const handleEnroll = async () => {
    if (!user) { router.push('/login'); return }
    const userId = getUserId()
    await authFetch(`${API_URL}/api/marketplace/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, course_id: courseId }),
    })
    // Fork + enroll
    handleFork()
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">Loading...</div>
  )

  if (!course) return null

  const milestones: Milestone[] = roadmap?.milestones || []
  const totalHours = milestones.reduce((acc, m) => acc + (m.estimated_hours || 0), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/explore" className="hover:text-violet-600">Explore</Link>
        <span>/</span>
        <span className="text-gray-900">{course.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>by <strong className="text-gray-700">{meta.author_name || 'Anonymous'}</strong></span>
              {meta.forked_from && <span className="text-gray-400">🔀 Forked</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                course.difficulty_level === 'beginner' ? 'bg-green-100 text-green-700' :
                course.difficulty_level === 'advanced' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {course.difficulty_level}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStar}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-1.5 ${
                starred
                  ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                  : 'border-gray-200 text-gray-600 hover:border-yellow-300 hover:bg-yellow-50'
              }`}
            >
              {starred ? '⭐' : '☆'} Star ({meta.star_count || 0})
            </button>
            <button
              onClick={handleFork}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-violet-300 hover:bg-violet-50 transition-all flex items-center gap-1.5"
            >
              🔀 Fork ({meta.fork_count || 0})
            </button>
            {!isOwner && (
              <button
                onClick={handleEnroll}
                className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-all"
              >
                Enroll & Learn
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 leading-relaxed mb-6">{course.description}</p>

        {/* Tags */}
        {meta.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {meta.tags.map((tag: string) => (
              <Link
                key={tag}
                href={`/explore?tag=${tag}`}
                className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm hover:bg-violet-100 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">⭐ {meta.star_count || 0}</div>
            <div className="text-xs text-gray-500">Stars</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">🔀 {meta.fork_count || 0}</div>
            <div className="text-xs text-gray-500">Forks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">👥 {meta.enrollment_count || 0}</div>
            <div className="text-xs text-gray-500">Enrolled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">🕐 {Math.round(totalHours)}h</div>
            <div className="text-xs text-gray-500">Estimated</div>
          </div>
        </div>
      </div>

      {/* Goal */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-violet-700 uppercase tracking-wide mb-2">Learning Goal</h2>
        <p className="text-lg text-gray-900">{course.goal}</p>
      </div>

      {/* Roadmap / Milestones */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Course Roadmap ({milestones.length} milestones)
          </h2>
          <div className="space-y-4">
            {milestones.map((m, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-5 hover:border-violet-200 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{m.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{m.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>~{m.estimated_hours}h</span>
                      {m.concepts?.length > 0 && (
                        <span>{m.concepts.length} concepts</span>
                      )}
                    </div>
                    {m.concepts?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.concepts.map((c, ci) => (
                          <span key={ci} className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
