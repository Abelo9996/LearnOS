'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';

interface Course {
  course_id: string;
  title: string;
  description: string;
  goal: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  progress_percentage: number;
  target_weeks: number;
  total_time_spent_minutes: number;
  sessions_count: number;
  concepts_mastered: string[];
  created_at: string;
  last_accessed: string;
  roadmap_id?: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (userId) {
      loadCourses();
    }
  }, [userId]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredCourses(courses);
    } else {
      setFilteredCourses(courses.filter(c => c.status === statusFilter));
    }
  }, [statusFilter, courses]);

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/api/courses/list/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
      } else {
        setError('Failed to load courses');
      }
    } catch (err) {
      setError('Failed to load courses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-300';
      case 'planning': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'planning': return '📋';
      case 'paused': return '⏸️';
      case 'completed': return '✅';
      case 'archived': return '📦';
      default: return '📚';
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📚 My Learning Courses
              </h1>
              <p className="text-gray-600 text-lg">
                Organized learning paths with AI-powered roadmaps, assignments, and insights
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/ai-settings')}
                className="text-purple-600 hover:text-purple-700 font-medium px-4 py-2 rounded-lg hover:bg-purple-50 transition-all"
              >
                ⚙️ Settings
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="text-sm text-blue-700 mb-1">Total Courses</div>
              <div className="text-3xl font-bold text-blue-900">{courses.length}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="text-sm text-green-700 mb-1">Active</div>
              <div className="text-3xl font-bold text-green-900">
                {courses.filter(c => c.status === 'active').length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="text-sm text-purple-700 mb-1">Completed</div>
              <div className="text-3xl font-bold text-purple-900">
                {courses.filter(c => c.status === 'completed').length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
              <div className="text-sm text-orange-700 mb-1">Total Study Time</div>
              <div className="text-3xl font-bold text-orange-900">
                {Math.round(courses.reduce((acc, c) => acc + c.total_time_spent_minutes, 0) / 60)}h
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({courses.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active ({courses.filter(c => c.status === 'active').length})
              </button>
              <button
                onClick={() => setStatusFilter('planning')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'planning'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Planning ({courses.filter(c => c.status === 'planning').length})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  statusFilter === 'completed'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed ({courses.filter(c => c.status === 'completed').length})
              </button>
            </div>
            
            <button
              onClick={() => router.push('/courses/create')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
            >
              ✨ Create New Course
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
            <div className="text-gray-500 text-lg">Loading courses...</div>
          </div>
        )}

        {/* Courses Grid */}
        {!loading && filteredCourses.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Courses Yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first course to start your personalized learning journey with AI-powered roadmaps!
            </p>
            <button
              onClick={() => router.push('/courses/create')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
            >
              ✨ Create Your First Course
            </button>
          </div>
        )}

        {!loading && filteredCourses.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.course_id}
                onClick={() => router.push(`/courses/${course.course_id}`)}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border-2 border-transparent hover:border-blue-300 p-6"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(course.status)}`}>
                    {getStatusIcon(course.status)} {course.status.toUpperCase()}
                  </span>
                  {course.roadmap_id && (
                    <span className="text-xs text-purple-600 font-semibold">🗺️ Has Roadmap</span>
                  )}
                </div>

                {/* Course Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {course.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {course.description}
                </p>

                {/* Goal */}
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <div className="text-xs font-semibold text-blue-700 mb-1">GOAL</div>
                  <div className="text-sm text-blue-900 line-clamp-2">{course.goal}</div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span className="font-bold">{Math.round(course.progress_percentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${course.progress_percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-600">Time</div>
                    <div className="text-sm font-bold text-gray-900">
                      {formatTime(course.total_time_spent_minutes)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-600">Sessions</div>
                    <div className="text-sm font-bold text-gray-900">{course.sessions_count}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-600">Concepts</div>
                    <div className="text-sm font-bold text-gray-900">{course.concepts_mastered.length}</div>
                  </div>
                </div>

                {/* Last Accessed */}
                <div className="mt-4 text-xs text-gray-500 text-center">
                  Last accessed: {new Date(course.last_accessed).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
