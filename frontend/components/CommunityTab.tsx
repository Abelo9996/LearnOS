'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import { getUserId } from '@/lib/userId'

interface Discussion {
  discussion_id: string
  user_id: string
  title: string
  content: string
  upvotes: number
  reply_count: number
  pinned: boolean
  created_at: string
  display_name?: string
}

interface LeaderboardEntry {
  user_id: string
  display_name?: string
  progress_percentage: number
  current_streak: number
  total_time_minutes?: number
}

interface Activity {
  activity_id: string
  user_id: string
  activity_type: string
  title: string
  description: string
  created_at: string
}

interface CommunityTabProps {
  courseId: string
}

export default function CommunityTab({ courseId }: CommunityTabProps) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'discussions' | 'leaderboard' | 'activity'>('discussions')
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [newPost, setNewPost] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [courseId, tab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'discussions') {
        const res = await fetch(`${API_URL}/api/social/discussions/${courseId}`)
        if (res.ok) {
          const data = await res.json()
          setDiscussions(data.discussions || [])
        }
      } else if (tab === 'leaderboard') {
        const res = await fetch(`${API_URL}/api/social/leaderboard/${courseId}`)
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data.leaderboard || [])
        }
      } else if (tab === 'activity') {
        const res = await fetch(`${API_URL}/api/social/activity?course_id=${courseId}`)
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities || [])
        }
      }
    } catch (err) {
      console.error('Failed to load social data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePost = async () => {
    if (!user || !newPost.trim()) return
    const userId = getUserId()
    await authFetch(`${API_URL}/api/social/discussions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        user_id: userId,
        title: newTitle,
        content: newPost,
        display_name: user.display_name || user.username,
      }),
    })
    setNewPost('')
    setNewTitle('')
    setShowCompose(false)
    loadData()
  }

  const handleVote = async (discussionId: string) => {
    if (!user) return
    const userId = getUserId()
    await authFetch(`${API_URL}/api/social/discussions/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, discussion_id: discussionId, vote: 1 }),
    })
    loadData()
  }

  const timeAgo = (dateStr: string) => {
    const now = new Date()
    const then = new Date(dateStr)
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['discussions', 'leaderboard', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t
                ? 'text-violet-700 border-b-2 border-violet-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'discussions' && '💬 '}
            {t === 'leaderboard' && '🏆 '}
            {t === 'activity' && '📡 '}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* DISCUSSIONS */}
        {tab === 'discussions' && (
          <div>
            {user && (
              <div className="mb-4">
                {showCompose ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                    <textarea
                      value={newPost}
                      onChange={e => setNewPost(e.target.value)}
                      placeholder="Share your thoughts, ask a question..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handlePost}
                        disabled={!newPost.trim()}
                        className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-all"
                      >
                        Post
                      </button>
                      <button
                        onClick={() => { setShowCompose(false); setNewPost(''); setNewTitle('') }}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCompose(true)}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-400 hover:border-violet-300 hover:text-gray-600 transition-all"
                  >
                    Start a discussion...
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : discussions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-gray-500">No discussions yet. Be the first to start one!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {discussions.map(d => (
                  <div
                    key={d.discussion_id}
                    className={`border rounded-lg p-4 ${d.pinned ? 'border-violet-200 bg-violet-50' : 'border-gray-100'}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleVote(d.discussion_id)}
                        className="flex flex-col items-center text-gray-400 hover:text-violet-600 transition-colors mt-1"
                      >
                        <span className="text-xs">▲</span>
                        <span className="text-sm font-medium">{d.upvotes}</span>
                      </button>
                      <div className="flex-1 min-w-0">
                        {d.title && (
                          <h4 className="font-semibold text-gray-900 text-sm mb-1">
                            {d.pinned && <span className="text-violet-600 mr-1">📌</span>}
                            {d.title}
                          </h4>
                        )}
                        <p className="text-sm text-gray-600">{d.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{timeAgo(d.created_at)}</span>
                          {d.reply_count > 0 && <span>💬 {d.reply_count} replies</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div>
            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-3xl mb-2">🏆</div>
                <p className="text-gray-500">No learners yet. Enroll to appear on the leaderboard!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      i < 3 ? 'bg-gradient-to-r from-violet-50 to-transparent' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">
                        {entry.display_name || entry.user_id.slice(0, 8)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>🔥 {entry.current_streak || 0} day streak</span>
                        {entry.total_time_minutes && (
                          <span>⏱️ {Math.round(entry.total_time_minutes / 60)}h</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-violet-600">
                        {Math.round(entry.progress_percentage || 0)}%
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-1 mt-1">
                        <div
                          className="bg-violet-500 h-1 rounded-full"
                          style={{ width: `${entry.progress_percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY */}
        {tab === 'activity' && (
          <div>
            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-3xl mb-2">📡</div>
                <p className="text-gray-500">No activity yet. Start learning to see updates!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map(a => (
                  <div key={a.activity_id} className="flex items-start gap-3 py-2">
                    <div className="text-lg">
                      {a.activity_type === 'discussion_post' && '💬'}
                      {a.activity_type === 'discussion_reply' && '↩️'}
                      {a.activity_type === 'milestone_complete' && '✅'}
                      {a.activity_type === 'course_star' && '⭐'}
                      {a.activity_type === 'course_fork' && '🔀'}
                      {a.activity_type === 'enrollment' && '👤'}
                      {!['discussion_post', 'discussion_reply', 'milestone_complete', 'course_star', 'course_fork', 'enrollment'].includes(a.activity_type) && '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{a.title}</p>
                      {a.description && (
                        <p className="text-xs text-gray-500 truncate">{a.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
