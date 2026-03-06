'use client'
import { authFetch, API_URL } from '@/lib/api';

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
      const response = await authFetch(`${API_URL}/api/courses/list/${userId}`);
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
            <p className="text-gray-500 mt-1">
              Your learning paths with AI-powered roadmaps and assignments
            </p>
          </div>
          <button
            onClick={() => router.push('/courses/create')}
            className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm text-sm"
          >
            + Create Course
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Total Courses</div>
            <div className="text-2xl font-bold text-gray-900">{courses.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {courses.filter(c => c.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Completed</div>
            <div className="text-2xl font-bold text-violet-600">
              {courses.filter(c => c.status === 'completed').length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm text-gray-500 mb-1">Study Time</div>
            <div className="text-2xl font-bold text-indigo-600">
              {Math.round(courses.reduce((acc, c) => acc + c.total_time_spent_minutes, 0) / 60)}h
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All', count: courses.length },
                { key: 'active', label: 'Active', count: courses.filter(c => c.status === 'active').length },
                { key: 'planning', label: 'Planning', count: courses.filter(c => c.status === 'planning').length },
                { key: 'completed', label: 'Completed', count: courses.filter(c => c.status === 'completed').length },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === f.key
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push('/courses/create')}
              className="sm:hidden px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg"
            >
              + New Course
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Loading courses...
          </div>
        )}

        {/* Courses Grid */}
        {!loading && filteredCourses.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No courses yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first course to start learning with AI
            </p>
            <button
              onClick={() => router.push('/courses/create')}
              className="px-5 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-colors text-sm"
            >
              Create Your First Course
            </button>
          </div>
        )}

        {!loading && filteredCourses.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => (
              <div
                key={course.course_id}
                onClick={() => router.push(`/courses/${course.course_id}`)}
                className="bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer p-6"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(course.status)}`}>
                    {getStatusIcon(course.status)} {course.status}
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
                      className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all"
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
