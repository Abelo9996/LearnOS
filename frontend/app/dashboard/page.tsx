'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'
import Link from 'next/link'

interface Course {
  course_id: string
  title: string
  description: string
  status: string
  progress_percentage: number
  total_time_spent_minutes: number
  sessions_count: number
  last_accessed: string
  roadmap_id?: string
}

interface FeaturedCourse {
  course_id: string
  title: string
  description: string
  goal: string
  star_count: number
  enrollment_count: number
  author_name: string
  category: string
  tags: string[]
  difficulty_level: string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [featured, setFeatured] = useState<FeaturedCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    try {
      const userId = getUserId()
      const [coursesRes, featuredRes] = await Promise.all([
        authFetch(`${API_URL}/api/courses/list/${userId}`),
        fetch(`${API_URL}/api/marketplace/featured`),
      ])

      if (coursesRes.ok) {
        const data = await coursesRes.json()
        setCourses(data.courses || [])
      }

      if (featuredRes.ok) {
        const data = await featuredRes.json()
        setFeatured(data.trending || [])
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) return null

  const activeCourses = courses.filter(c => c.status === 'active')
  const totalMinutes = courses.reduce((acc, c) => acc + (c.total_time_spent_minutes || 0), 0)
  const totalSessions = courses.reduce((acc, c) => acc + (c.sessions_count || 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.display_name || user.username} 👋
        </h1>
        <p className="text-gray-500 mt-1">Here's your learning overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">My Courses</div>
          <div className="text-2xl font-bold text-gray-900">{courses.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Active</div>
          <div className="text-2xl font-bold text-green-600">{activeCourses.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Study Time</div>
          <div className="text-2xl font-bold text-violet-600">{Math.round(totalMinutes / 60)}h</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm text-gray-500 mb-1">Sessions</div>
          <div className="text-2xl font-bold text-indigo-600">{totalSessions}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: My Courses */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">My Courses</h2>
            <Link href="/courses" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              Loading...
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📚</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No courses yet</h3>
              <p className="text-gray-500 mb-4">Create your first course or explore community courses</p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/courses/create"
                  className="px-5 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors text-sm"
                >
                  Create Course
                </Link>
                <Link
                  href="/explore"
                  className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
                >
                  Explore
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.slice(0, 5).map(course => (
                <Link
                  key={course.course_id}
                  href={`/courses/${course.course_id}`}
                  className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-violet-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{course.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          course.status === 'active' ? 'bg-green-100 text-green-700' :
                          course.status === 'completed' ? 'bg-violet-100 text-violet-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {course.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{course.description}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0 w-24">
                      <div className="text-right text-sm font-medium text-gray-900 mb-1">
                        {Math.round(course.progress_percentage)}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${course.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Actions + Trending */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/courses/create"
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-violet-300 hover:shadow-sm transition-all"
              >
                <div className="text-2xl mb-1">✨</div>
                <div className="text-sm font-medium text-gray-900">New Course</div>
              </Link>
              <Link
                href="/explore"
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-violet-300 hover:shadow-sm transition-all"
              >
                <div className="text-2xl mb-1">🔍</div>
                <div className="text-sm font-medium text-gray-900">Explore</div>
              </Link>
              <Link
                href="/ai-settings"
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-violet-300 hover:shadow-sm transition-all"
              >
                <div className="text-2xl mb-1">⚙️</div>
                <div className="text-sm font-medium text-gray-900">AI Settings</div>
              </Link>
              <Link
                href="/profile"
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-violet-300 hover:shadow-sm transition-all"
              >
                <div className="text-2xl mb-1">👤</div>
                <div className="text-sm font-medium text-gray-900">Profile</div>
              </Link>
            </div>
          </div>

          {/* Trending Courses */}
          {featured.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Trending</h2>
                <Link href="/explore" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                  See all →
                </Link>
              </div>
              <div className="space-y-3">
                {featured.slice(0, 3).map(course => (
                  <Link
                    key={course.course_id}
                    href={`/explore/${course.course_id}`}
                    className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 transition-all"
                  >
                    <h4 className="font-medium text-gray-900 text-sm mb-1 truncate">{course.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>⭐ {course.star_count}</span>
                      <span>👥 {course.enrollment_count}</span>
                      <span className="truncate">by {course.author_name || 'Anonymous'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
