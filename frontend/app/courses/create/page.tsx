'use client'
import { authFetch, API_URL } from '@/lib/api';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';

export default function CreateCoursePage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal: '',
    difficulty_level: 'intermediate',
    target_weeks: 12,
    generate_roadmap: true
  });

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const response = await authFetch(`${API_URL}/api/courses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...formData
        })
      });

      if (response.ok) {
        const data = await response.json();
        const course = data.course;
        
        // Redirect to course page
        router.push(`/courses/${course.course_id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to create course');
      }
    } catch (err) {
      setError('Failed to create course');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.title && formData.description;
    if (step === 2) return formData.goal;
    if (step === 3) return true;
    return false;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/courses')}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium mb-4 inline-block"
          >
            ← Back to Courses
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Course</h1>
          <p className="text-gray-500 mt-1">Build your personalized learning journey with AI</p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between">
            {[
              { s: 1, label: 'Course Info' },
              { s: 2, label: 'Your Goal' },
              { s: 3, label: 'Settings' },
            ].map(({ s, label }, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    step >= s ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {s}
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden sm:inline">{label}</span>
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 mx-3 ${
                    step > s ? 'bg-violet-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
            {/* Step 1: Course Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    📚 What do you want to learn?
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Give your course a title and brief description
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g., Full-Stack Web Development, Machine Learning Fundamentals"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe what this course will cover and why you want to learn it..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 2: Goal */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    🎯 What's your specific goal?
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Be as specific as possible. This helps AI create a better roadmap for you.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Learning Goal *
                  </label>
                  <textarea
                    value={formData.goal}
                    onChange={(e) => setFormData({...formData, goal: e.target.value})}
                    placeholder="e.g., Build a full-stack e-commerce application with React, Node.js, and PostgreSQL"
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tip: Include what you want to build, technologies you want to use, or skills you want to master
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Settings */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    ⚙️ Configure Your Course
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Customize your learning pace and difficulty
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({...formData, difficulty_level: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="beginner">Beginner - I'm new to this</option>
                    <option value="intermediate">Intermediate - I have some background</option>
                    <option value="advanced">Advanced - I want deep expertise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Target Timeline (weeks)
                  </label>
                  <input
                    type="number"
                    value={formData.target_weeks}
                    onChange={(e) => setFormData({...formData, target_weeks: parseInt(e.target.value) || 12})}
                    min="1"
                    max="52"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    How many weeks do you want to dedicate to this course?
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.generate_roadmap}
                      onChange={(e) => setFormData({...formData, generate_roadmap: e.target.checked})}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="ml-3">
                      <div className="font-bold text-purple-900">
                        ✨ Generate AI-Powered Roadmap
                      </div>
                      <div className="text-sm text-purple-700">
                        Let AI create a personalized learning path with milestones and resources
                      </div>
                    </div>
                  </label>
                </div>

                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                  <h3 className="font-bold text-blue-900 mb-3">📋 Course Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold">Title:</span> {formData.title}</div>
                    <div><span className="font-semibold">Goal:</span> {formData.goal}</div>
                    <div><span className="font-semibold">Level:</span> {formData.difficulty_level}</div>
                    <div><span className="font-semibold">Timeline:</span> {formData.target_weeks} weeks</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
              >
                ← Previous
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="ml-auto px-6 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Next →
              </button>
            )}
            {step === 3 && (
              <button
                type="submit"
                disabled={creating || !canProceed()}
                className="ml-auto px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {creating ? '⏳ Creating Course...' : '✨ Create Course'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
