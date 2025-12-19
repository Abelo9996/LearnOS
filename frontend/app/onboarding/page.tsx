'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface OnboardingQuestion {
  id: string;
  question: string;
  question_type: 'multiple_choice' | 'scale' | 'text';
  options?: string[];
  category: string;
}

interface LearnerProfile {
  user_id: string;
  learning_style: string;
  expertise_level: string;
  assessment_style: string;
  baseline_attention_minutes: number;
  current_attention_minutes: number;
  target_attention_minutes: number;
  pace_preference: string;
  content_depth: string;
  prefers_video_resources: boolean;
  prefers_reading_resources: boolean;
  prefers_interactive_tools: boolean;
  learning_goals: string[];
  created_at: string;
  updated_at: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<'start' | 'questions' | 'profile'>('start');
  const [sessionId, setSessionId] = useState<string>('');
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const startOnboarding = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: `user_${Date.now()}` })
      });

      if (!response.ok) {
        throw new Error('Failed to start onboarding');
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setStep('questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (questionId: string, answer: string) => {
    setResponses({ ...responses, [questionId]: answer });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitOnboarding = async () => {
    setLoading(true);
    setError('');

    try {
      const formattedResponses = questions.map(q => ({
        question_id: q.id,
        answer: responses[q.id] || ''
      }));

      const response = await fetch('http://localhost:8000/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          responses: formattedResponses
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit onboarding');
      }

      const data = await response.json();
      setProfile(data.profile);
      setInsights(data.insights);
      setStep('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  if (step === 'start') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to LearnOS 🎓
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Let's personalize your learning experience! We'll ask you a few questions 
              to understand your learning style, expertise level, and preferences.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">What we'll discover:</h2>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">👀</span>
                  <span className="text-gray-700">Your preferred learning style (visual, reading, hands-on)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">📊</span>
                  <span className="text-gray-700">Your current expertise level</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✍️</span>
                  <span className="text-gray-700">How you like to be assessed</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">⏱️</span>
                  <span className="text-gray-700">Your attention span and learning pace</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">🎯</span>
                  <span className="text-gray-700">Your learning goals and preferences</span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              ⏱️ This will take approximately 10 minutes
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <button
              onClick={startOnboarding}
              disabled={loading}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg
                hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-colors shadow-lg hover:shadow-xl"
            >
              {loading ? 'Starting...' : 'Start Onboarding →'}
            </button>

            <p className="text-sm text-gray-500 mt-6">
              Already have a profile?{' '}
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Skip to learning
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'questions' && currentQuestion) {
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const currentResponse = responses[currentQuestion.id];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Progress Bar */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className="text-sm text-gray-600">{currentQuestion.category}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {currentQuestion.question}
            </h2>

            {/* Multiple Choice */}
            {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleResponse(currentQuestion.id, option)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all
                      ${currentResponse === option
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center
                        ${currentResponse === option ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}
                      >
                        {currentResponse === option && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-gray-800">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Scale */}
            {currentQuestion.question_type === 'scale' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => handleResponse(currentQuestion.id, value.toString())}
                      className={`flex-1 py-6 rounded-lg border-2 font-semibold text-lg transition-all
                        ${currentResponse === value.toString()
                          ? 'border-blue-600 bg-blue-600 text-white shadow-lg scale-105'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-700'
                        }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-sm text-gray-600 px-2">
                  <span>Not at all</span>
                  <span>Very much</span>
                </div>
              </div>
            )}

            {/* Text Input */}
            {currentQuestion.question_type === 'text' && (
              <textarea
                value={currentResponse || ''}
                onChange={(e) => handleResponse(currentQuestion.id, e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-600 
                  focus:outline-none min-h-[120px] text-gray-800"
              />
            )}

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={previousQuestion}
                disabled={currentQuestionIndex === 0}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400
                  disabled:cursor-not-allowed font-medium"
              >
                ← Previous
              </button>

              {!isLastQuestion ? (
                <button
                  onClick={nextQuestion}
                  disabled={!currentResponse}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold
                    hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                    transition-colors"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={submitOnboarding}
                  disabled={loading || !currentResponse}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold
                    hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                    transition-colors"
                >
                  {loading ? 'Analyzing...' : 'Complete Onboarding ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'profile' && profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Your Learning Profile is Ready!
              </h1>
              <p className="text-gray-600">
                We've created a personalized learning experience just for you
              </p>
            </div>

            {/* Profile Summary */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-2">Learning Style</h3>
                <p className="text-2xl font-bold text-blue-600 capitalize">
                  {profile.learning_style.replace('_', ' ')}
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-2">Expertise Level</h3>
                <p className="text-2xl font-bold text-purple-600 capitalize">
                  {profile.expertise_level.replace('_', ' ')}
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-2">Assessment Style</h3>
                <p className="text-2xl font-bold text-green-600 capitalize">
                  {profile.assessment_style.replace('_', ' ')}
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-2">Learning Pace</h3>
                <p className="text-2xl font-bold text-orange-600 capitalize">
                  {profile.pace_preference}
                </p>
              </div>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="text-2xl mr-2">💡</span>
                  Your Personalized Insights
                </h3>
                <ul className="space-y-3">
                  {insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-blue-600 mr-2">✓</span>
                      <span className="text-gray-700">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Attention Span */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Attention Span Goal</h3>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Current</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {profile.current_attention_minutes} min
                  </p>
                </div>
                <div className="text-4xl text-gray-400">→</div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Target</p>
                  <p className="text-2xl font-bold text-green-600">
                    {profile.target_attention_minutes} min
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/')}
                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg
                  hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
              >
                Start Learning →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
