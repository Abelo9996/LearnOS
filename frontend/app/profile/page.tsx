'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { authFetch, API_URL } from '@/lib/api'
import Link from 'next/link'

interface UserProfile {
  id: string
  email: string
  username: string
  display_name: string
  role: string
  tier: string
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      fetchProfile()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading])

  const fetchProfile = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/auth/users/me`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setDisplayName(data.display_name || '')
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const res = await authFetch(`${API_URL}/api/auth/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      })
      if (res.ok) {
        setMessage('Profile updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const err = await res.json()
        setMessage(err.detail || 'Failed to update profile')
      }
    } catch {
      setMessage('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">Please log in to view your profile</p>
        <Link href="/login" className="text-violet-600 hover:text-violet-700 font-medium">Sign In</Link>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Failed to load profile</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Avatar Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-2xl font-bold">
              {profile.display_name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profile.display_name || profile.username}</h2>
              <p className="text-violet-200 text-sm">{profile.email}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Account Info */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Username</label>
                <p className="text-gray-900 font-medium">{profile.username}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Email</label>
                <p className="text-gray-900 font-medium">{profile.email}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Role</label>
                <span className="inline-block px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
                  {profile.role || 'learner'}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Plan</label>
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {profile.tier || 'free'}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Display Name */}
          <form onSubmit={handleSaveProfile} className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Profile</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                placeholder="Your display name"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm ${
                message.includes('successfully')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all text-sm"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          {/* Quick Links */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/settings/agents" className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-sm font-medium text-gray-700">
                ⚙️ AI Settings
              </Link>
              <Link href="/courses" className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-sm font-medium text-gray-700">
                📚 My Courses
              </Link>
              <Link href="/certificates" className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-sm font-medium text-gray-700">
                🏅 Certificates
              </Link>
              <Link href="/explore" className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-sm font-medium text-gray-700">
                🔍 Explore
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
