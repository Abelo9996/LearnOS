'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';

interface AIFeatures {
  ai_assignments: boolean;
  ai_roadmaps: boolean;
  habit_adaptation: boolean;
  content_retrieval: boolean;
  socratic_enhancement: boolean;
  progress_insights: boolean;
}

export default function AISettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [configured, setConfigured] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [features, setFeatures] = useState<AIFeatures>({
    ai_assignments: true,
    ai_roadmaps: true,
    habit_adaptation: true,
    content_retrieval: true,
    socratic_enhancement: true,
    progress_insights: true
  });

  useEffect(() => {
    // Get consistent userId
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (userId) {
      checkConfigStatus();
    }
  }, [userId]);

  const checkConfigStatus = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/ai/config/status/${userId}`);
      const data = await response.json();
      
      setConfigured(data.configured);
      setAiAvailable(data.ai_available);
      
      if (data.configured && data.features) {
        setFeatures(data.features);
        setModel(data.model || 'gpt-4');
      }
    } catch (err) {
      console.error('Error checking config status:', err);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:8000/api/ai/config/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          api_key: apiKey,
          model: model,
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error('Failed to configure OpenAI');
      }

      const data = await response.json();
      setConfigured(true);
      setAiAvailable(data.ai_available);
      setSuccess('OpenAI configured successfully! AI features are now enabled.');
      setApiKey(''); // Clear API key from display
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:8000/api/ai/config/test/${userId}`);
      const data = await response.json();

      if (data.success) {
        setSuccess('✓ OpenAI connection working perfectly!');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Test failed. Please check your configuration.');
    } finally {
      setTesting(false);
    }
  };

  const handleToggleFeatures = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/ai/config/toggle-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...features
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update features');
      }

      setSuccess('Feature settings updated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveConfig = async () => {
    if (!confirm('Are you sure you want to remove OpenAI configuration? This will disable all AI features.')) {
      return;
    }

    try {
      await fetch(`http://localhost:8000/api/ai/config/remove/${userId}`, {
        method: 'DELETE'
      });
      
      setConfigured(false);
      setAiAvailable(false);
      setSuccess('OpenAI configuration removed. AI features disabled.');
    } catch (err) {
      setError('Failed to remove configuration');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🤖 AI Settings
              </h1>
              <p className="text-gray-600">
                Configure OpenAI GPT-4 to unlock powerful AI features
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back
            </button>
          </div>

          {/* Status Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
            configured && aiAvailable 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              configured && aiAvailable ? 'bg-green-600' : 'bg-gray-400'
            }`} />
            <span className="font-medium">
              {configured && aiAvailable ? 'AI Enabled' : 'AI Not Configured'}
            </span>
          </div>
        </div>

        {/* Configuration Form */}
        {!configured && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🔑 Configure OpenAI API
            </h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Need an API key?</strong> Visit{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  OpenAI Platform
                </a>{' '}
                to create one. Your key is stored securely and only used for your learning.
              </p>
            </div>

            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OpenAI API Key *
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                  <option value="gpt-4">GPT-4 (Recommended)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster, cheaper)</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold
                  hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                  transition-colors"
              >
                {loading ? 'Configuring...' : 'Enable AI Features'}
              </button>
            </form>
          </div>
        )}

        {/* AI Features (when configured) */}
        {configured && (
          <>
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ⚙️ AI Feature Toggles
              </h2>
              <p className="text-gray-600 mb-6">
                Enable or disable individual AI features based on your preferences.
              </p>

              <div className="space-y-4">
                {Object.entries(features).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {getFeatureDescription(key)}
                      </p>
                    </div>
                    <button
                      onClick={() => setFeatures({ ...features, [key]: !value })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {success}
                </div>
              )}

              <button
                onClick={handleToggleFeatures}
                disabled={loading}
                className="w-full mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold
                  hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Saving...' : 'Save Feature Settings'}
              </button>
            </div>

            {/* Test & Manage */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                🔧 Test & Manage
              </h2>

              <div className="flex gap-4">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold
                    hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  onClick={handleRemoveConfig}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-semibold
                    hover:bg-red-700 transition-colors"
                >
                  Remove Configuration
                </button>
              </div>
            </div>
          </>
        )}

        {/* Benefits Section */}
        <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl shadow-xl p-8 mt-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ✨ What AI Features Unlock
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white bg-opacity-70 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Custom Assignments</h3>
              <p className="text-sm text-gray-700">
                GPT-4 generates unique coding assignments tailored to your expertise and learning style
              </p>
            </div>
            <div className="bg-white bg-opacity-70 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🗺️ Dynamic Roadmaps</h3>
              <p className="text-sm text-gray-700">
                AI creates personalized learning paths with milestones and time estimates
              </p>
            </div>
            <div className="bg-white bg-opacity-70 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🔄 Habit Adaptation</h3>
              <p className="text-sm text-gray-700">
                Analyzes your patterns and suggests optimal learning times and strategies
              </p>
            </div>
            <div className="bg-white bg-opacity-70 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">📚 Smart Content</h3>
              <p className="text-sm text-gray-700">
                Finds and summarizes the best articles, videos, and tutorials for each concept
              </p>
            </div>
            <div className="bg-white bg-opacity-70 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">💡 Progress Insights</h3>
              <p className="text-sm text-gray-700">
                AI analyzes your learning data to provide actionable insights and recommendations
              </p>
            </div>
            <div className="bg-white bg-opacity-70 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">🎓 Enhanced Learning</h3>
              <p className="text-sm text-gray-700">
                Improves Socratic dialogue and provides deeper explanations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFeatureDescription(featureKey: string): string {
  const descriptions: Record<string, string> = {
    ai_assignments: 'Generate custom coding assignments with GPT-4',
    ai_roadmaps: 'Create personalized learning roadmaps',
    habit_adaptation: 'Get AI-powered habit analysis and suggestions',
    content_retrieval: 'Find and summarize relevant learning content',
    socratic_enhancement: 'Enhance Socratic dialogue with AI',
    progress_insights: 'Receive AI-generated progress insights'
  };
  return descriptions[featureKey] || 'AI-powered feature';
}
