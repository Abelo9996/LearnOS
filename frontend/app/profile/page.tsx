'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface UserProfile {
  id: string
  email: string
  username: string
  display_name: string
  role: string
  tier: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  useEffect(() => {
    if (token) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setProfile(response.data)
      setDisplayName(response.data.display_name || '')
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
      await axios.put(
        `${API_URL}/auth/users/me`,
        { display_name: displayName },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-blue-900">Please log in to view your profile</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-900">Failed to load profile</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-8">My Profile 👤</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        {/* Account Info */}
        <div className="mb-8 pb-8 border-b border-gray-200">
          <h2 className="text-xl font-bold mb-4">Account Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900 font-medium">{profile.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <p className="text-gray-900 font-medium">{profile.username}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {profile.role || 'learner'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {profile.tier || 'free'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Display Name */}
        <form onSubmit={handleSaveProfile} className="mb-8">
          <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Your name"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg mb-4 text-sm ${
              message.includes('successfully')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Quick Links */}
        <div className="pt-8 border-t border-gray-200">
          <h2 className="text-xl font-bold mb-4">Quick Links</h2>
          <div className="space-y-2">
            <a href="/llm-config" className="block text-indigo-600 hover:text-indigo-700 font-medium">
              → LLM Configuration
            </a>
            <a href="/content-generation" className="block text-indigo-600 hover:text-indigo-700 font-medium">
              → Generate Content
            </a>
            <a href="/progress" className="block text-indigo-600 hover:text-indigo-700 font-medium">
              → View Progress
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
