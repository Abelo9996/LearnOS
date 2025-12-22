'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';

interface LearningSession {
  session_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  concepts_covered: string[];
  engagement_level?: 'low' | 'medium' | 'high';
  attention_score?: number;
  questions_answered?: number;
  correct_answers?: number;
  mastery_gained?: number;
  interruptions?: number;
  completed?: boolean;
}

interface Adaptation {
  adaptation_id: string;
  adaptation_type: string;
  current_behavior: string;
  observed_pattern: string;
  suggested_change: string;
  reasoning: string;
  expected_benefit: string;
  confidence: number;
  status: string;
  priority?: string;
}

interface Insight {
  insight_id: string;
  insight_type: string;
  title: string;
  description: string;
  suggested_actions: string[];
  priority: string;
}

export default function HabitsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'sessions' | 'adaptations' | 'insights'>('sessions');
  
  // Session tracking
  const [currentSession, setCurrentSession] = useState<LearningSession | null>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [sessionForm, setSessionForm] = useState({
    concepts: '',
    questions: 0,
    correct: 0,
    interruptions: 0
  });
  
  // Adaptations
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [generatingAdaptations, setGeneratingAdaptations] = useState(false);
  
  // Insights
  const [insights, setInsights] = useState<Insight[]>([]);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'sessions') {
        await loadSessions();
      } else if (activeTab === 'adaptations') {
        await loadAdaptations();
      } else if (activeTab === 'insights') {
        await loadInsights();
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/ai/habits/sessions/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  };

  const loadAdaptations = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/ai/habits/adaptations/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setAdaptations(data.adaptations || []);
      }
    } catch (err) {
      console.error('Error loading adaptations:', err);
    }
  };

  const loadInsights = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/ai/habits/insights/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (err) {
      console.error('Error loading insights:', err);
    }
  };

  const startSession = async () => {
    setError('');
    try {
      const response = await fetch('http://localhost:8000/api/ai/habits/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to start session');
      }
    } catch (err) {
      setError('Failed to start session');
    }
  };

  const endSession = async () => {
    if (!currentSession) return;
    setError('');

    try {
      const concepts = sessionForm.concepts.split(',').map(c => c.trim()).filter(c => c);
      
      const response = await fetch(
        `http://localhost:8000/api/ai/habits/session/${currentSession.session_id}/end?` +
        `concepts_covered=${encodeURIComponent(JSON.stringify(concepts))}&` +
        `questions_answered=${sessionForm.questions}&` +
        `correct_answers=${sessionForm.correct}&` +
        `interruptions=${sessionForm.interruptions}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        setCurrentSession(null);
        setSessionForm({ concepts: '', questions: 0, correct: 0, interruptions: 0 });
        await loadSessions();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to end session');
      }
    } catch (err) {
      setError('Failed to end session');
    }
  };

  const generateAdaptations = async () => {
    setGeneratingAdaptations(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/ai/habits/adaptations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId,
          adaptation_types: [],
          days_to_analyze: 30
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAdaptations(data.adaptations || []);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to generate adaptations');
      }
    } catch (err) {
      setError('Failed to generate adaptations');
    } finally {
      setGeneratingAdaptations(false);
    }
  };

  const generateInsights = async () => {
    setGeneratingInsights(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/ai/habits/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId,
          insight_types: [],
          time_frame: 'past_week'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to generate insights');
      }
    } catch (err) {
      setError('Failed to generate insights');
    } finally {
      setGeneratingInsights(false);
    }
  };

  const updateAdaptationStatus = async (adaptationId: string, status: string) => {
    try {
      await fetch(
        `http://localhost:8000/api/ai/habits/adaptations/${adaptationId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      );
      await loadAdaptations();
    } catch (err) {
      console.error('Error updating adaptation:', err);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'bg-red-100 text-red-800 border-red-300';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getSessionDuration = () => {
    if (!currentSession) return '0m';
    const start = new Date(currentSession.start_time);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - start.getTime()) / 60000);
    return formatDuration(minutes);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                📊 Learning Habits & Insights
              </h1>
              <p className="text-gray-600">
                Track your learning patterns and get AI-powered recommendations
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/ai-settings')}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'sessions'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              📅 Sessions
            </button>
            <button
              onClick={() => setActiveTab('adaptations')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'adaptations'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              🔄 AI Adaptations
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'insights'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              💡 AI Insights
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}

        {/* Sessions Tab */}
        {!loading && activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Session Control */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Current Session</h2>
              
              {!currentSession ? (
                <button
                  onClick={startSession}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:from-green-600 hover:to-blue-700 transition-all"
                >
                  ▶️ Start Learning Session
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-bold text-green-700">
                        🟢 Session in Progress
                      </span>
                      <span className="text-2xl font-bold text-green-600">
                        {getSessionDuration()}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Concepts studied (comma-separated)"
                        value={sessionForm.concepts}
                        onChange={(e) => setSessionForm({...sessionForm, concepts: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="number"
                          placeholder="Questions"
                          value={sessionForm.questions}
                          onChange={(e) => setSessionForm({...sessionForm, questions: parseInt(e.target.value) || 0})}
                          className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="number"
                          placeholder="Correct"
                          value={sessionForm.correct}
                          onChange={(e) => setSessionForm({...sessionForm, correct: parseInt(e.target.value) || 0})}
                          className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="number"
                          placeholder="Breaks"
                          value={sessionForm.interruptions}
                          onChange={(e) => setSessionForm({...sessionForm, interruptions: parseInt(e.target.value) || 0})}
                          className="px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={endSession}
                    className="w-full bg-gradient-to-r from-red-500 to-orange-600 text-white font-bold py-3 px-6 rounded-xl hover:from-red-600 hover:to-orange-700 transition-all"
                  >
                    ⏹️ End Session
                  </button>
                </div>
              )}
            </div>

            {/* Sessions List */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
              
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No sessions recorded yet</p>
                  <p className="text-sm mt-2">Start your first learning session to begin tracking!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.session_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {new Date(session.start_time).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            ⏱️ Duration: {formatDuration(session.duration_minutes || 0)}
                          </div>
                          {session.questions_answered && session.questions_answered > 0 && (
                            <div className="text-sm text-gray-600">
                              📊 Accuracy: {session.correct_answers}/{session.questions_answered} 
                              ({Math.round((session.correct_answers || 0) / session.questions_answered * 100)}%)
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {session.concepts_covered && session.concepts_covered.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {session.concepts_covered.map((concept, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {concept}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Adaptations Tab */}
        {!loading && activeTab === 'adaptations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">AI-Powered Adaptations</h2>
                <button
                  onClick={generateAdaptations}
                  disabled={generatingAdaptations}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold py-2 px-6 rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 transition-all"
                >
                  {generatingAdaptations ? '⏳ Generating...' : '✨ Generate Adaptations'}
                </button>
              </div>

              {adaptations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">No adaptations yet</p>
                  <p className="text-sm">
                    Click "Generate Adaptations" to get AI-powered recommendations<br />
                    based on your learning patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adaptations.map((adaptation) => (
                    <div
                      key={adaptation.adaptation_id}
                      className={`border-2 rounded-xl p-6 ${getPriorityColor(adaptation.priority || 'medium')}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-xs font-semibold uppercase text-gray-600 mb-1">
                            {adaptation.adaptation_type}
                          </div>
                          <h3 className="font-bold text-lg text-gray-900 mb-2">
                            {adaptation.suggested_change}
                          </h3>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 bg-white rounded-full">
                          {Math.round(adaptation.confidence * 100)}% confidence
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-700 mb-1">Current Pattern:</div>
                          <div className="text-sm text-gray-600">{adaptation.current_behavior}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-semibold text-gray-700 mb-1">Reasoning:</div>
                          <div className="text-sm text-gray-600">{adaptation.reasoning}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-semibold text-gray-700 mb-1">Expected Benefit:</div>
                          <div className="text-sm text-gray-600">{adaptation.expected_benefit}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => updateAdaptationStatus(adaptation.adaptation_id, 'accepted')}
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 text-sm font-medium"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => updateAdaptationStatus(adaptation.adaptation_id, 'rejected')}
                          className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 text-sm font-medium"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {!loading && activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">AI Insights</h2>
                <button
                  onClick={generateInsights}
                  disabled={generatingInsights}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-2 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 transition-all"
                >
                  {generatingInsights ? '⏳ Generating...' : '💡 Generate Insights'}
                </button>
              </div>

              {insights.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">No insights yet</p>
                  <p className="text-sm">
                    Click "Generate Insights" to get AI-powered analysis<br />
                    of your learning progress and patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {insights.map((insight) => (
                    <div
                      key={insight.insight_id}
                      className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-xs font-semibold uppercase text-gray-600 mb-1">
                            {insight.insight_type}
                          </div>
                          <h3 className="font-bold text-lg text-gray-900 mb-2">
                            {insight.title}
                          </h3>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${getPriorityColor(insight.priority || 'medium')}`}>
                          {insight.priority} priority
                        </span>
                      </div>

                      <p className="text-gray-700 mb-4">{insight.description}</p>

                      {insight.suggested_actions && insight.suggested_actions.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold text-gray-700 mb-2">Suggested Actions:</div>
                          <ul className="space-y-1">
                            {insight.suggested_actions.map((action, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start">
                                <span className="mr-2">•</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
