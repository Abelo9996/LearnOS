'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'
import Link from 'next/link'

interface Course {
  course_id: string
  title: string
  description: string
  goal: string
  difficulty_level: string
  star_count: number
  fork_count: number
  enrollment_count: number
  author_name: string
  author_avatar: string
  category: string
  tags: string[]
  short_description: string
  published_at: string
  forked_from?: string
  user_id: string
}

interface Category {
  slug: string
  name: string
  description: string
  icon: string
  course_count: number
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  )
}

function ExploreContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())

  // Filters
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [category, setCategory] = useState(searchParams.get('cat') || 'all')
  const [sort, setSort] = useState(searchParams.get('sort') || 'stars')

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category && category !== 'all') params.set('category', category)
      if (search) params.set('search', search)
      params.set('sort', sort)
      params.set('limit', '20')

      const res = await fetch(`${API_URL}/api/marketplace/explore?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCourses(data.courses || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Failed to load courses:', err)
    } finally {
      setLoading(false)
    }
  }, [category, search, sort])

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/categories`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  const loadStarred = async () => {
    if (!user) return
    try {
      const userId = getUserId()
      const res = await authFetch(`${API_URL}/api/marketplace/starred/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setStarredIds(new Set((data.courses || []).map((c: any) => c.course_id)))
      }
    } catch (err) { /* ignore */ }
  }

  useEffect(() => {
    loadCategories()
    loadStarred()
  }, [user])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  const handleStar = async (courseId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { router.push('/login'); return }

    const userId = getUserId()
    const isStarred = starredIds.has(courseId)
    const endpoint = isStarred ? 'unstar' : 'star'

    try {
      await authFetch(`${API_URL}/api/marketplace/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, course_id: courseId }),
      })

      setStarredIds(prev => {
        const next = new Set(prev)
        if (isStarred) next.delete(courseId)
        else next.add(courseId)
        return next
      })

      // Update local course star count
      setCourses(prev => prev.map(c =>
        c.course_id === courseId
          ? { ...c, star_count: c.star_count + (isStarred ? -1 : 1) }
          : c
      ))
    } catch (err) {
      console.error('Star action failed:', err)
    }
  }

  const handleFork = async (courseId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { router.push('/login'); return }

    const userId = getUserId()
    try {
      const res = await authFetch(`${API_URL}/api/marketplace/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, course_id: courseId }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/courses/${data.course.course_id}`)
      }
    } catch (err) {
      console.error('Fork failed:', err)
    }
  }

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-700'
      case 'intermediate': return 'bg-yellow-100 text-yellow-700'
      case 'advanced': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore Courses</h1>
        <p className="text-gray-500">Discover community-created courses. Star, fork, and learn.</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCourses()}
              placeholder="Search courses..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            />
            <span className="absolute left-3 top-3 text-gray-400">🔍</span>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500"
          >
            <option value="stars">Most Starred</option>
            <option value="newest">Newest</option>
            <option value="trending">Trending</option>
            <option value="enrolled">Most Enrolled</option>
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar: Categories */}
        <div className="hidden lg:block w-56 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Categories</h3>
          <div className="space-y-1">
            <button
              onClick={() => setCategory('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                category === 'all' ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All Courses
            </button>
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setCategory(cat.slug)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  category === cat.slug ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>
                  <span className="mr-1.5">{cat.icon}</span>
                  {cat.name}
                </span>
                {cat.course_count > 0 && (
                  <span className="text-xs text-gray-400">{cat.course_count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Course Grid */}
        <div className="flex-1">
          {/* Mobile category pills */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                category === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => setCategory(cat.slug)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                  category === cat.slug ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Results info */}
          <div className="text-sm text-gray-500 mb-4">
            {total} course{total !== 1 ? 's' : ''} found
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No courses found</h3>
              <p className="text-gray-500 mb-6">
                {search ? `No results for "${search}". Try different keywords.` : 'Be the first to publish a course in this category!'}
              </p>
              {user && (
                <Link
                  href="/courses/create"
                  className="px-5 py-2.5 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors text-sm"
                >
                  Create a Course
                </Link>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {courses.map(course => (
                <Link
                  key={course.course_id}
                  href={`/explore/${course.course_id}`}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:border-violet-300 hover:shadow-md hover:shadow-violet-50 transition-all duration-300 group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                        {course.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          by {course.author_name || 'Anonymous'}
                        </span>
                        {course.forked_from && (
                          <span className="text-xs text-gray-400">🔀 forked</span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${getDifficultyColor(course.difficulty_level)}`}>
                      {course.difficulty_level}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {course.short_description || course.description}
                  </p>

                  {/* Tags */}
                  {course.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {course.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer: Stars / Forks / Enroll */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <button
                        onClick={(e) => handleStar(course.course_id, e)}
                        className={`flex items-center gap-1 hover:text-yellow-600 transition-colors ${
                          starredIds.has(course.course_id) ? 'text-yellow-500' : ''
                        }`}
                      >
                        {starredIds.has(course.course_id) ? '⭐' : '☆'} {course.star_count}
                      </button>
                      <button
                        onClick={(e) => handleFork(course.course_id, e)}
                        className="flex items-center gap-1 hover:text-violet-600 transition-colors"
                      >
                        🔀 {course.fork_count}
                      </button>
                      <span className="flex items-center gap-1">
                        👥 {course.enrollment_count}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {categories.find(c => c.slug === course.category)?.icon} {categories.find(c => c.slug === course.category)?.name || course.category}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
