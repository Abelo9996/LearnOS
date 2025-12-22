'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';

interface Course {
  course_id: string;
  title: string;
  description: string;
  goal: string;
  status: string;
  progress_percentage: number;
  target_weeks: number;
  total_time_spent_minutes: number;
  sessions_count: number;
  concepts_mastered: string[];
  roadmap_id?: string;
  created_at: string;
  custom_preferences?: {
    assignment_ids?: string[];
    [key: string]: any;
  };
}

interface Milestone {
  milestone_id: string;
  title: string;
  description: string;
  concepts: string[];
  estimated_hours: number;
  completed: boolean;
  completion_date?: string;
}

interface Roadmap {
  roadmap_id: string;
  title: string;
  description: string;
  milestones: Milestone[];
  estimated_weeks: number;
}

interface Assignment {
  assignment_id: string;
  title: string;
  description: string;
  difficulty: number;
  completed: boolean;
  estimated_hours: number;
}

interface Session {
  session_id: string;
  start_time: string;
  duration_minutes: number;
  concepts_covered: string[];
}

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'roadmap' | 'assignments' | 'sessions' | 'settings'>('overview');
  
  const [course, setCourse] = useState<Course | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | React.ReactNode>('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (userId) {
      loadCourseData();
    }
  }, [userId, params.courseId]);

  const loadCourseData = async () => {
    console.log('📚 Loading course data for:', params.courseId);
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/api/courses/${params.courseId}`);
      console.log('📥 Course data response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Course data received:', data);
        console.log('🗺️ Roadmap in response:', data.roadmap ? 'YES' : 'NO');
        
        setCourse(data.course);
        setRoadmap(data.roadmap);
        setAssignments(data.assignments || []);
        setSessions(data.recent_sessions || []);
        setStats(data.stats);
        
        console.log('✅ State updated - Roadmap:', data.roadmap ? 'SET' : 'NULL');
      } else {
        setError('Failed to load course');
        console.error('❌ Failed to load course');
      }
    } catch (err) {
      setError('Failed to load course');
      console.error('💥 Error loading course:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMilestone = async (milestoneId: string) => {
    if (!roadmap) return;
    setActionLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/ai/roadmap/${roadmap.roadmap_id}/milestone/${milestoneId}/complete`,
        { method: 'PUT' }
      );
      if (response.ok) {
        await loadCourseData();
      }
    } catch (err) {
      console.error('Error toggling milestone:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const generateAssignment = async (concept: string) => {
    setActionLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:8000/api/ai/assignments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          concept,
          difficulty: 'intermediate',
          include_test_cases: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assignment = data.assignment;
        
        // Link assignment to course
        if (course) {
          await fetch(`http://localhost:8000/api/courses/${course.course_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              custom_preferences: {
                assignment_ids: [...(course.custom_preferences?.assignment_ids || []), assignment.assignment_id]
              }
            })
          });
        }
        
        await loadCourseData();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to generate assignment');
      }
    } catch (err) {
      setError('Failed to generate assignment');
    } finally {
      setActionLoading(false);
    }
  };

  const generateRoadmapForCourse = async () => {
    if (!course) {
      alert('No course data available');
      return;
    }
    
    console.log('🚀 Generate Roadmap button clicked!');
    console.log('Course ID:', course.course_id);
    console.log('User ID:', userId);
    console.log('Goal:', course.goal);
    console.log('Target weeks:', course.target_weeks);
    
    setActionLoading(true);
    setError('');
    
    try {
      console.log('📡 Calling roadmap generation API...');
      const response = await fetch('http://localhost:8000/api/ai/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          goal: course.goal,
          target_weeks: course.target_weeks
        })
      });
      
      console.log('📥 Roadmap API response status:', response.status);
      console.log('📥 Roadmap API response headers:', response.headers);
      
      // Get response text first for debugging
      const responseText = await response.text();
      console.log('📄 Raw response text:', responseText);
      
      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON:', parseError);
          throw new Error('Invalid JSON response from server');
        }
        
        console.log('✅ FULL ROADMAP RESPONSE:');
        console.log(JSON.stringify(data, null, 2));
        console.log('📊 Roadmap data:', data);
        console.log('🗺️ Roadmap object:', data.roadmap);
        console.log('🆔 Roadmap ID:', data.roadmap?.roadmap_id);
        console.log('📋 Roadmap goal:', data.roadmap?.goal);
        console.log('📍 Number of milestones:', data.roadmap?.milestones?.length);
        
        const newRoadmap = data.roadmap;
        
        if (!newRoadmap) {
          console.error('❌ No roadmap in response!');
          throw new Error('No roadmap in response');
        }
        
        if (!newRoadmap.roadmap_id) {
          console.error('❌ Roadmap has no ID!');
          console.error('Roadmap object:', newRoadmap);
          throw new Error('Invalid roadmap data received - no roadmap_id');
        }
        
        console.log('✅ Roadmap validated successfully');
        console.log('🔗 Linking roadmap to course...');
        const updateResponse = await fetch(`http://localhost:8000/api/courses/${course.course_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roadmap_id: newRoadmap.roadmap_id
          })
        });
        
        console.log('📥 Course update response status:', updateResponse.status);
        
        if (updateResponse.ok) {
          const updateData = await updateResponse.json();
          console.log('✅ FULL COURSE UPDATE RESPONSE:');
          console.log(JSON.stringify(updateData, null, 2));
          console.log('📚 Updated course:', updateData.course);
          console.log('🗺️ Updated course roadmap_id:', updateData.course?.roadmap_id);
        } else {
          console.error('❌ Failed to link roadmap to course');
          const errorData = await updateResponse.json();
          console.error('Error details:', errorData);
        }
        
        // Small delay to ensure backend is ready
        console.log('⏱️ Waiting 500ms before reload...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🔄 Reloading course data...');
        await loadCourseData();
        
        console.log('🎉 Roadmap generation complete!');
        console.log('📊 Current roadmap state:', roadmap);
        console.log('📚 Current course state:', course);
        
        // Force tab to roadmap view if successful
        if (roadmap) {
          console.log('✨ Switching to roadmap tab');
          setActiveTab('roadmap');
        } else {
          console.warn('⚠️ Roadmap state is still null after reload!');
        }
        
        alert('✅ Roadmap generated successfully! Check the Roadmap tab.');
      } else {
        const errorData = JSON.parse(responseText);
        console.error('❌ Roadmap generation failed');
        console.error('Status:', response.status);
        console.error('Error response:', errorData);
        console.error('Raw error text:', responseText);
        
        const errorMsg = errorData.detail || 'Failed to generate roadmap';
        
        if (errorMsg.includes('not configured') || errorMsg.includes('API key')) {
          setError(
            <span>
              AI not configured. Please{' '}
              <a 
                href="/ai-settings" 
                className="underline font-semibold hover:text-red-800"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/ai-settings');
                }}
              >
                set up your OpenAI API key
              </a>
              {' '}first.
            </span>
          );
        } else {
          setError(errorMsg);
        }
      }
    } catch (err) {
      console.error('💥 Error during roadmap generation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate roadmap';
      setError(errorMessage);
      alert('❌ Error: ' + errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const updateCourseStatus = async (status: string) => {
    if (!course) return;
    setActionLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/courses/${course.course_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        await loadCourseData();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-gray-500 text-lg">Loading course...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
            <div className="text-red-800 text-lg mb-4">{error || 'Course not found'}</div>
            <button
              onClick={() => router.push('/courses')}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              ← Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <button
            onClick={() => router.push('/courses')}
            className="text-gray-600 hover:text-gray-800 font-medium mb-4"
          >
            ← Back to Courses
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-4xl font-bold text-gray-900">{course.title}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(course.status)}`}>
                  {course.status.toUpperCase()}
                </span>
              </div>
              <p className="text-gray-600 text-lg mb-4">{course.description}</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-blue-700 mb-1">LEARNING GOAL</div>
                <div className="text-blue-900">{course.goal}</div>
              </div>
            </div>
            
            <div className="ml-6">
              <button
                onClick={() => router.push('/ai-settings')}
                className="text-purple-600 hover:text-purple-700 font-medium px-4 py-2 rounded-lg hover:bg-purple-50"
              >
                ⚙️ Settings
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-semibold">Overall Progress</span>
              <span className="font-bold text-lg">{Math.round(course.progress_percentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full transition-all"
                style={{ width: `${course.progress_percentage}%` }}
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="text-sm text-blue-700 mb-1">Study Time</div>
              <div className="text-2xl font-bold text-blue-900">{formatTime(course.total_time_spent_minutes)}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="text-sm text-green-700 mb-1">Sessions</div>
              <div className="text-2xl font-bold text-green-900">{course.sessions_count}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="text-sm text-purple-700 mb-1">Concepts Mastered</div>
              <div className="text-2xl font-bold text-purple-900">{course.concepts_mastered.length}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
              <div className="text-sm text-orange-700 mb-1">
                {stats?.total_milestones ? 'Milestones' : 'Target'}
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {stats?.total_milestones ? `${stats.completed_milestones}/${stats.total_milestones}` : `${course.target_weeks}w`}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl mb-6">
          <div className="flex border-b overflow-x-auto">
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'roadmap', label: '🗺️ Roadmap', icon: '🗺️' },
              { id: 'assignments', label: '📝 Assignments', icon: '📝' },
              { id: 'sessions', label: '⏱️ Sessions', icon: '⏱️' },
              { id: 'settings', label: '⚙️ Settings', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 px-6 py-4 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">📈 Quick Stats</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Total Time Invested</span>
                    <span className="font-bold text-gray-900">{formatTime(course.total_time_spent_minutes)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Learning Sessions</span>
                    <span className="font-bold text-gray-900">{course.sessions_count}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Concepts Mastered</span>
                    <span className="font-bold text-gray-900">{course.concepts_mastered.length}</span>
                  </div>
                  {stats && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-700">Milestones Completed</span>
                        <span className="font-bold text-gray-900">
                          {stats.completed_milestones}/{stats.total_milestones}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-700">Assignments Done</span>
                        <span className="font-bold text-gray-900">
                          {stats.completed_assignments}/{stats.total_assignments}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 Next Steps</h2>
                <div className="space-y-3">
                  {roadmap && roadmap.milestones.filter(m => !m.completed).slice(0, 3).map((milestone) => (
                    <div key={milestone.milestone_id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                      <div className="font-semibold text-gray-900 mb-1">{milestone.title}</div>
                      <div className="text-sm text-gray-600 mb-2">{milestone.description}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">⏱️ {milestone.estimated_hours}h</span>
                        <button
                          onClick={() => setActiveTab('roadmap')}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View in Roadmap →
                        </button>
                      </div>
                    </div>
                  ))}
                  {roadmap && roadmap.milestones.filter(m => !m.completed).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>🎉 All milestones completed!</p>
                    </div>
                  )}
                  {!roadmap && (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">🗺️</div>
                      <p className="text-gray-600 mb-4">No roadmap yet</p>
                      <button
                        onClick={() => setActiveTab('roadmap')}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Generate Roadmap →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Roadmap Tab */}
          {activeTab === 'roadmap' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">🗺️ Learning Roadmap</h2>
                {roadmap && (
                  <span className="text-sm text-gray-600">
                    {roadmap.milestones.filter(m => m.completed).length} of {roadmap.milestones.length} completed
                  </span>
                )}
              </div>

              {!roadmap && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🗺️</div>
                  <p className="text-gray-600 mb-4">No roadmap generated yet</p>
                  <p className="text-sm text-gray-500 mb-6">
                    Generate an AI-powered learning roadmap for this course
                  </p>
                  <button
                    onClick={generateRoadmapForCourse}
                    disabled={actionLoading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {actionLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating with AI...
                      </span>
                    ) : (
                      '✨ Generate Roadmap with AI'
                    )}
                  </button>
                </div>
              )}

              {roadmap && (
                <div className="space-y-4">
                  {roadmap.milestones.map((milestone, index) => (
                    <div
                      key={milestone.milestone_id}
                      className={`border-2 rounded-xl p-6 transition-all ${
                        milestone.completed
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            milestone.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {milestone.completed ? '✓' : index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{milestone.title}</h3>
                            <p className="text-gray-600 mb-3">{milestone.description}</p>
                            
                            {milestone.concepts && milestone.concepts.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {milestone.concepts.map((concept, idx) => (
                                  <span
                                    key={idx}
                                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                                  >
                                    {concept}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            <div className="text-sm text-gray-500">
                              ⏱️ Estimated: {milestone.estimated_hours} hours
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleMilestone(milestone.milestone_id)}
                          disabled={actionLoading}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                            milestone.completed
                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50`}
                        >
                          {milestone.completed ? '↩️ Mark Incomplete' : '✓ Mark Complete'}
                        </button>
                        {!milestone.completed && milestone.concepts && milestone.concepts.length > 0 && (
                          <button
                            onClick={() => generateAssignment(milestone.concepts[0])}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
                          >
                            📝 Generate Assignment
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📝 Course Assignments</h2>
              
              {assignments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-600 mb-4">No assignments yet</p>
                  <p className="text-sm text-gray-500">Generate assignments from your roadmap milestones</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.assignment_id}
                      className={`border-2 rounded-xl p-6 ${
                        assignment.completed ? 'bg-green-50 border-green-300' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-900 flex-1">{assignment.title}</h3>
                        {assignment.completed && <span className="text-green-600 text-xl">✓</span>}
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{assignment.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          ⏱️ {assignment.estimated_hours}h • 
                          Difficulty: {Math.round(assignment.difficulty * 100)}%
                        </span>
                        <button
                          onClick={() => router.push(`/ai-assignments#${assignment.assignment_id}`)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">⏱️ Learning Sessions</h2>
                <button
                  onClick={() => router.push('/habits')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All Sessions →
                </button>
              </div>
              
              {sessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⏱️</div>
                  <p className="text-gray-600 mb-4">No sessions recorded yet</p>
                  <button
                    onClick={() => router.push('/habits')}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Start Your First Session
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.session_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {new Date(session.start_time).toLocaleString()}
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {formatTime(session.duration_minutes)}
                        </span>
                      </div>
                      {session.concepts_covered && session.concepts_covered.length > 0 && (
                        <div className="flex flex-wrap gap-1">
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
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">⚙️ Course Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Course Status</label>
                  <select
                    value={course.status}
                    onChange={(e) => updateCourseStatus(e.target.value)}
                    disabled={actionLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="planning">📋 Planning</option>
                    <option value="active">🟢 Active</option>
                    <option value="paused">⏸️ Paused</option>
                    <option value="completed">✅ Completed</option>
                    <option value="archived">📦 Archived</option>
                  </select>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Course Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="font-medium">{new Date(course.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target Duration:</span>
                      <span className="font-medium">{course.target_weeks} weeks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Course ID:</span>
                      <span className="font-mono text-xs">{course.course_id}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-red-900 mb-4">Danger Zone</h3>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to archive this course?')) {
                        updateCourseStatus('archived');
                        router.push('/courses');
                      }
                    }}
                    className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 font-medium"
                  >
                    🗑️ Archive Course
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
