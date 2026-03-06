'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const API_URL = `${BASE_URL}/api`

interface User {
  id: string
  email: string
  username: string
  display_name: string
  role: string
  tier: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  accessToken: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored token on mount
    const token = localStorage.getItem('access_token')
    if (token) {
      setAccessToken(token)
      fetchUser(token)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async (token: string) => {
    try {
      const response = await axios.get(`${API_URL}/auth/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(response.data)
    } catch (err) {
      localStorage.removeItem('access_token')
      setAccessToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    })
    const { access_token, user: userData } = response.data
    localStorage.setItem('access_token', access_token)
    setAccessToken(access_token)
    setUser(userData)
  }

  const register = async (email: string, username: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email,
      username,
      password,
      display_name: username,
      accept_terms: true
    })
    const { access_token, user: userData } = response.data
    localStorage.setItem('access_token', access_token)
    setAccessToken(access_token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, accessToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
