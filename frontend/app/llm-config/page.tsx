'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

interface AIConfig {
  provider: string
  model: string
  api_key_set: boolean
  api_key_masked: string
  base_url: string | null
  available_providers: { id: string; name: string; docs_url: string }[]
  available_models: string[]
  mock_mode: boolean
}

interface LLMProvider {
  provider: string
  model: string
  enabled: boolean
  total_requests: number
  capabilities: string[]
}

interface UsageStats {
  total_tokens: number
  total_cost: number
  request_count: number
  by_provider: Record<string, any>
}

export default function LLMConfigPage() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Settings form state
  const [selectedProvider, setSelectedProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'default' : 'default'

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [configRes, provRes, usageRes] = await Promise.allSettled([
        axios.get(`${API_URL}/ai/config/status/${userId}`),
        axios.get(`${API_URL}/llm/providers`),
        axios.get(`${API_URL}/llm/usage`),
      ])

      if (configRes.status === 'fulfilled') {
        const c = configRes.value.data
        setConfig(c)
        setSelectedProvider(c.provider)
        setModel(c.model)
      }
      if (provRes.status === 'fulfilled') {
        setProviders(provRes.value.data.providers || [])
      }
      if (usageRes.status === 'fulfilled') {
        setUsageStats(usageRes.value.data)
      }
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      const payload: any = { provider: selectedProvider, model }
      if (apiKey) payload.api_key = apiKey
      const r = await axios.post(`${API_URL}/ai/config/update/${userId}`, payload)
      setConfig(r.data)
      setApiKey('')
      setModel(r.data.model)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await axios.post(`${API_URL}/ai/config/test/${userId}`)
      setTestResult(r.data)
    } catch {
      setTestResult({ success: false, error: 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleClearKey = async () => {
    setSaving(true)
    try {
      const r = await axios.post(`${API_URL}/ai/config/update/${userId}`, { api_key: '' })
      setConfig(r.data)
    } catch {} finally { setSaving(false) }
  }

  const handleProviderChange = async (p: string) => {
    setSelectedProvider(p)
    // Get models for new provider
    try {
      const r = await axios.post(`${API_URL}/ai/config/update/${userId}`, { provider: p })
      setConfig(r.data)
      setModel(r.data.model)
    } catch {}
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">AI Settings ⚙️</h1>
      <p className="text-gray-500 mb-8">Configure your LLM provider, API key, and model</p>

      {/* Status Banner */}
      {config && (
        <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
          config.mock_mode
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-green-50 border border-green-200'
        }`}>
          <span className="text-xl">{config.mock_mode ? '🔧' : '✅'}</span>
          <div>
            <p className={`text-sm font-medium ${config.mock_mode ? 'text-yellow-800' : 'text-green-800'}`}>
              {config.mock_mode ? 'Mock Mode — No API key configured' : `Connected — ${config.provider} / ${config.model}`}
            </p>
          </div>
        </div>
      )}

      {/* Usage Stats */}
      {usageStats && (usageStats.total_tokens > 0 || usageStats.request_count > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-gray-500 text-xs font-medium mb-1">Total Tokens</div>
            <div className="text-2xl font-bold">{usageStats.total_tokens?.toLocaleString() || '0'}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-gray-500 text-xs font-medium mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-green-600">${usageStats.total_cost?.toFixed(3) || '0.00'}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-gray-500 text-xs font-medium mb-1">Requests</div>
            <div className="text-2xl font-bold text-blue-600">{usageStats.request_count || 0}</div>
          </div>
        </div>
      )}

      {/* Settings Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold mb-6">Configuration</h2>

        {/* Provider */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {config?.available_providers.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`p-3 rounded-lg text-sm font-medium text-left border transition-all ${
                  selectedProvider === p.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        {selectedProvider !== 'ollama' && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            {config?.api_key_set && !apiKey && (
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <span className="font-mono">{showKey ? config.api_key_masked : '••••••••••••••••'}</span>
                <button onClick={() => setShowKey(!showKey)} className="underline">{showKey ? 'hide' : 'show'}</button>
                <button onClick={handleClearKey} className="text-red-400 underline ml-2">clear</button>
              </div>
            )}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={config?.api_key_set ? 'Enter new key to replace...' : 'Paste your API key...'}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 font-mono text-sm pr-16"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-gray-100 text-gray-500"
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Get your key at{' '}
              <a
                href={config?.available_providers.find(p => p.id === selectedProvider)?.docs_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-indigo-500"
              >
                {selectedProvider} dashboard
              </a>
            </p>
          </div>
        )}

        {/* Model */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm"
          >
            {config?.available_models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`rounded-lg p-3 mb-4 text-sm ${
            testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {testResult.success
              ? `✅ Connection successful${testResult.response ? ` — "${testResult.response}"` : ''}`
              : `❌ ${testResult.error}`
            }
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '⏳ Saving...' : '💾 Save Settings'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || (config?.mock_mode && selectedProvider !== 'ollama')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              testing || (config?.mock_mode && selectedProvider !== 'ollama')
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {testing ? '⏳ Testing...' : '🔌 Test Connection'}
          </button>
        </div>
      </div>

      {/* Registered Providers */}
      {providers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Registered Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {providers.map(p => (
              <div key={`${p.provider}-${p.model}`} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold">{p.provider}</h3>
                    <p className="text-sm text-gray-500">{p.model}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {p.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{p.total_requests} requests</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Info */}
      <div className="rounded-xl p-4 mt-4 bg-gray-50 text-xs text-gray-500">
        <p className="font-medium mb-1">🔒 Security</p>
        <ul className="space-y-0.5 ml-3">
          <li>• Keys stored locally on the server only</li>
          <li>• Keys never returned in API responses (always masked)</li>
          <li>• Changes take effect immediately, no restart needed</li>
        </ul>
      </div>
    </div>
  )
}
