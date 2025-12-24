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

interface WebResource {
  url: string;
  title: string;
  resource_type: string;
  description?: string;
  author?: string;
  platform?: string;
  estimated_time_minutes?: number;
  difficulty?: string;
  is_free?: boolean;
  rating?: number;
  why_recommended?: string;
}

interface LearningStep {
  step_id: string;
  order: number;
  title: string;
  description: string;
  learning_objectives: string[];
  key_concepts: string[];
  content: string;
  video_resources: WebResource[];
  reading_resources: WebResource[];
  interactive_resources: WebResource[];
  action_items: string[];
  practice_exercises: string[];
  quiz_questions?: any[];
  estimated_minutes: number;
  difficulty: string;
  completed: boolean;
  notes?: string;
}

interface Milestone {
  milestone_id: string;
  title: string;
  description: string;
  overview?: string;
  concepts: string[];
  estimated_hours: number;
  completed: boolean;
  completion_date?: string;
  web_resources?: WebResource[];
  learning_steps?: LearningStep[];
  why_important?: string;
  real_world_applications?: string[];
  recommended_projects?: string[];
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
  user_id: string;
  course_id: string;
  milestone_id: string;
  roadmap_id: string;
  assignment_type: string;
  title: string;
  description: string;
  learning_objectives: string[];
  instructions: string[];
  requirements: string[];
  questions: string[];
  starter_materials?: string;
  test_cases: any[];
  rubric: any[];
  hints: string[];
  resources: string[];
  estimated_time_hours: number;
  difficulty: string;
  status: string;
  submission?: string;
  submission_date?: string;
  score?: number;
  feedback?: string;
  created_at: string;
  completed_at?: string;
  ai_model: string;
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
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/api/courses/${params.courseId}`);
      
      if (response.ok) {
        const data = await response.json();
        setCourse(data.course);
        setRoadmap(data.roadmap);
        setAssignments(data.assignments || []);
        setSessions(data.recent_sessions || []);
        setStats(data.stats);
      } else {
        setError('Failed to load course');
      }
    } catch (err) {
      setError('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    if (!userId || !course) return;
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/ai/assignments/list/${userId}?course_id=${course.course_id}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
        alert(`✅ Loaded ${data.assignments?.length || 0} assignments`);
      } else {
        alert('Failed to fetch assignments');
      }
    } catch (err) {
      alert('Error fetching assignments');
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
      // Silent error
    } finally {
      setActionLoading(false);
    }
  };

  const generateMilestoneAssignment = async (milestone: Milestone) => {
    if (!userId || !course) {
      alert('User ID or course not found');
      return;
    }
    
    if (!roadmap) {
      alert('No roadmap found. Generate a roadmap first.');
      return;
    }
    
    setActionLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/ai/assignments/generate-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          course_id: course.course_id,
          milestone_id: milestone.milestone_id,
          roadmap_id: roadmap.roadmap_id,
          milestone_title: milestone.title,
          milestone_description: milestone.description || milestone.overview || '',
          concepts: milestone.concepts || [],
          learning_steps: milestone.learning_steps || [],
          difficulty: 'intermediate'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const assignment = data.assignment;
        
        // Format assignment display based on type
        let assignmentText = `
🎯 ${assignment.assignment_type.toUpperCase().replace('_', ' ')}
📚 ${assignment.title}

📝 ${assignment.description}

� Learning Objectives:
${assignment.learning_objectives.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n')}

📋 Instructions:
${assignment.instructions.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n')}

✅ Requirements:
${assignment.requirements.map((req: string) => `• ${req}`).join('\n')}
`;

        // Add questions if present (for essays, quizzes, reading analysis)
        if (assignment.questions && assignment.questions.length > 0) {
          assignmentText += `\n❓ Questions to Answer:\n${assignment.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}\n`;
        }

        assignmentText += `
💡 Hints:
${assignment.hints.map((hint: string) => `• ${hint}`).join('\n')}

⏱️ Estimated Time: ${assignment.estimated_time_hours} hours
📊 Difficulty: ${assignment.difficulty}

📌 Grading Rubric:
${assignment.rubric.map((r: any) => `• ${r.criterion} (${r.points} pts): ${r.description}`).join('\n')}

✅ Assignment saved! ID: ${data.assignment_id}
View it in the Assignments tab to start working on it.
        `.trim();
        
        alert(assignmentText);
        
        // Reload assignments list
        await fetchAssignments();
        
      } else {
        const errorData = await response.json();
        alert(`Failed to generate assignment: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate assignment';
      alert(`Error: ${errorMessage}`);
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
    
    setActionLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/ai/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          goal: course.goal,
          target_weeks: course.target_weeks
        })
      });
      
      const responseText = await response.text();
      
      if (response.ok) {
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid JSON response from server');
        }
        
        const newRoadmap = data.roadmap;
        
        if (!newRoadmap || !newRoadmap.roadmap_id) {
          throw new Error('Invalid roadmap data received');
        }
        
        // Link roadmap to course
        const updateResponse = await fetch(`http://localhost:8000/api/courses/${course.course_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roadmap_id: newRoadmap.roadmap_id
          })
        });
        
        if (!updateResponse.ok) {
          throw new Error('Failed to link roadmap to course');
        }
        
        // Small delay to ensure backend is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await loadCourseData();
        
        // Switch to roadmap tab
        if (roadmap) {
          setActiveTab('roadmap');
        }
        
        alert('✅ Roadmap generated successfully! Check the Roadmap tab.');
      } else {
        const errorData = JSON.parse(responseText);
        
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
      // Silent error
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
                  {/* Debug Info */}
                  {roadmap.milestones && roadmap.milestones.length > 0 && (
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                      <h3 className="font-bold text-blue-900 mb-2">📊 Roadmap Status:</h3>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div>✅ Total Modules: {roadmap.milestones.length}</div>
                        <div>📚 Total Lessons: {roadmap.milestones.reduce((sum, m) => sum + (m.learning_steps?.length || 0), 0)}</div>
                        {roadmap.milestones.every(m => !m.learning_steps || m.learning_steps.length === 0) && (
                          <div className="text-red-600 font-bold mt-2">
                            ⚠️ WARNING: No learning steps found! Check console logs.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                            
                            {/* Generate Assignment Button */}
                            <div className="mt-4 mb-4">
                              <button
                                onClick={() => generateMilestoneAssignment(milestone)}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
                              >
                                <span>🎯</span>
                                <span>{actionLoading ? 'Generating...' : 'Generate Assignment'}</span>
                              </button>
                              <p className="text-xs text-gray-500 mt-2">
                                Create a hands-on project to test your understanding of this module
                              </p>
                            </div>
                            
                            {/* Web Resources Section */}
                            {milestone.web_resources && milestone.web_resources.length > 0 && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  🌐 Learning Resources
                                </h4>
                                <div className="space-y-3">
                                  {milestone.web_resources.map((resource: any, resIdx: number) => (
                                    <a
                                      key={resIdx}
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all group"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="text-2xl">
                                          {resource.resource_type === 'video' && '🎥'}
                                          {resource.resource_type === 'article' && '📄'}
                                          {resource.resource_type === 'tutorial' && '📚'}
                                          {resource.resource_type === 'documentation' && '📖'}
                                          {resource.resource_type === 'course' && '🎓'}
                                          {resource.resource_type === 'interactive' && '💻'}
                                          {!['video', 'article', 'tutorial', 'documentation', 'course', 'interactive'].includes(resource.resource_type) && '🔗'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {resource.title}
                                          </div>
                                          {resource.description && (
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                              {resource.description}
                                            </p>
                                          )}
                                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                                            {resource.platform && (
                                              <span className="flex items-center gap-1">
                                                <span className="font-medium">{resource.platform}</span>
                                              </span>
                                            )}
                                            {resource.estimated_time_minutes && (
                                              <span>⏱️ {resource.estimated_time_minutes} min</span>
                                            )}
                                            {resource.difficulty && (
                                              <span className={`px-2 py-0.5 rounded-full ${
                                                resource.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                                                resource.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                              }`}>
                                                {resource.difficulty}
                                              </span>
                                            )}
                                            {resource.is_free && (
                                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                                Free
                                              </span>
                                            )}
                                          </div>
                                          {resource.why_recommended && (
                                            <p className="text-xs text-gray-500 mt-2 italic">
                                              💡 {resource.why_recommended}
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-gray-400 group-hover:text-blue-600 transition-colors">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Learning Steps - Detailed Lessons */}
                            {milestone.learning_steps && milestone.learning_steps.length > 0 ? (
                              <div className="mt-4 space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2 bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                                  📚 Learning Path ({milestone.learning_steps.length} lessons) - Click to expand
                                </h4>
                                {milestone.learning_steps
                                  .sort((a, b) => a.order - b.order)
                                  .map((step, stepIdx) => (
                                    <details key={step.step_id || stepIdx} className="group bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all">
                                      <summary className="cursor-pointer p-4 hover:bg-blue-50 rounded-lg transition-colors list-none select-none">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3 flex-1">
                                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                                              {step.order}
                                            </span>
                                            <div className="flex-1">
                                              <div className="font-semibold text-gray-900">{step.title}</div>
                                              <div className="text-sm text-gray-600">{step.description}</div>
                                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                <span>⏱️ {step.estimated_minutes} min</span>
                                                <span>📊 {step.difficulty}</span>
                                                {step.video_resources && step.video_resources.length > 0 && (
                                                  <span>🎥 {step.video_resources.length} videos</span>
                                                )}
                                                {step.reading_resources && step.reading_resources.length > 0 && (
                                                  <span>📄 {step.reading_resources.length} articles</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-blue-600 font-medium">Click to open</span>
                                            <svg className="w-5 h-5 text-blue-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </div>
                                        </div>
                                      </summary>
                                      
                                      <div className="p-4 pt-0 space-y-4 bg-white">
                                        {/* Learning Objectives */}
                                        {step.learning_objectives && step.learning_objectives.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">🎯 What You'll Learn:</h5>
                                            <ul className="space-y-1">
                                              {step.learning_objectives.map((obj, idx) => (
                                                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                                  <span className="text-green-500 mt-0.5">✓</span>
                                                  <span>{obj}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        
                                        {/* Content */}
                                        {step.content && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">📖 Lesson Content:</h5>
                                            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
                                              {step.content}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Video Resources */}
                                        {step.video_resources && step.video_resources.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">🎥 Videos to Watch:</h5>
                                            <div className="space-y-2">
                                              {step.video_resources.map((resource, idx) => (
                                                <a
                                                  key={idx}
                                                  href={resource.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
                                                >
                                                  <span className="text-xl">🎥</span>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600">{resource.title}</div>
                                                    {resource.platform && <div className="text-xs text-gray-500">{resource.platform} • {resource.estimated_time_minutes} min</div>}
                                                  </div>
                                                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                  </svg>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Reading Resources */}
                                        {step.reading_resources && step.reading_resources.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">📄 Articles & Docs:</h5>
                                            <div className="space-y-2">
                                              {step.reading_resources.map((resource, idx) => (
                                                <a
                                                  key={idx}
                                                  href={resource.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
                                                >
                                                  <span className="text-xl">📄</span>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600">{resource.title}</div>
                                                    {resource.platform && <div className="text-xs text-gray-500">{resource.platform} • {resource.estimated_time_minutes} min read</div>}
                                                  </div>
                                                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                  </svg>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Interactive Resources */}
                                        {step.interactive_resources && step.interactive_resources.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">💻 Practice Interactively:</h5>
                                            <div className="space-y-2">
                                              {step.interactive_resources.map((resource, idx) => (
                                                <a
                                                  key={idx}
                                                  href={resource.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
                                                >
                                                  <span className="text-xl">💻</span>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600">{resource.title}</div>
                                                    {resource.platform && <div className="text-xs text-gray-500">{resource.platform} • {resource.estimated_time_minutes} min</div>}
                                                  </div>
                                                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                  </svg>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Action Items */}
                                        {step.action_items && step.action_items.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">✅ Action Items:</h5>
                                            <ul className="space-y-1">
                                              {step.action_items.map((item, idx) => (
                                                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                                  <span className="text-blue-500 mt-0.5">→</span>
                                                  <span>{item}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        
                                        {/* Practice Exercises */}
                                        {step.practice_exercises && step.practice_exercises.length > 0 && (
                                          <div>
                                            <h5 className="font-semibold text-sm text-gray-900 mb-2">🏋️ Practice Exercises:</h5>
                                            <ul className="space-y-1">
                                              {step.practice_exercises.map((exercise, idx) => (
                                                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                                  <span className="text-purple-500 mt-0.5">★</span>
                                                  <span>{exercise}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </details>
                                  ))}
                              </div>
                            ) : (
                              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">
                                  ⚠️ No learning steps available. This might be a fallback roadmap. Configure AI settings for detailed content.
                                </p>
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">📝 Course Assignments</h2>
                <button
                  onClick={() => fetchAssignments()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  🔄 Refresh
                </button>
              </div>
              
              {assignments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-600 mb-4">No assignments yet</p>
                  <p className="text-sm text-gray-500">Generate assignments from your roadmap milestones</p>
                  <button
                    onClick={() => setActiveTab('roadmap')}
                    className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Go to Roadmap →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.assignment_id}
                      className={`border-2 rounded-xl p-6 ${
                        assignment.status === 'completed' || assignment.status === 'graded' 
                          ? 'bg-green-50 border-green-300' 
                          : assignment.status === 'submitted'
                          ? 'bg-blue-50 border-blue-300'
                          : 'border-gray-200 hover:border-purple-300 transition-colors'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold uppercase">
                              {assignment.assignment_type.replace('_', ' ')}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              assignment.status === 'completed' || assignment.status === 'graded'
                                ? 'bg-green-100 text-green-700'
                                : assignment.status === 'submitted'
                                ? 'bg-blue-100 text-blue-700'
                                : assignment.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {assignment.status.replace('_', ' ')}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">{assignment.title}</h3>
                        </div>
                        {(assignment.status === 'completed' || assignment.status === 'graded') && (
                          <span className="text-green-600 text-2xl">✓</span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4">{assignment.description}</p>
                      
                      {/* Learning Objectives */}
                      {assignment.learning_objectives && assignment.learning_objectives.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-700 mb-2">🎯 Learning Objectives:</h4>
                          <ul className="space-y-1">
                            {assignment.learning_objectives.slice(0, 3).map((obj, idx) => (
                              <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                                <span className="text-purple-500">→</span>
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Questions Preview (for essays, quizzes) */}
                      {assignment.questions && assignment.questions.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-xs font-semibold text-blue-900 mb-2">❓ Questions to Answer:</h4>
                          <ul className="space-y-1">
                            {assignment.questions.slice(0, 2).map((q, idx) => (
                              <li key={idx} className="text-xs text-blue-800">
                                {idx + 1}. {q.length > 100 ? q.substring(0, 100) + '...' : q}
                              </li>
                            ))}
                            {assignment.questions.length > 2 && (
                              <li className="text-xs text-blue-600 italic">
                                +{assignment.questions.length - 2} more questions...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>⏱️ {assignment.estimated_time_hours}h</span>
                          <span>📊 {assignment.difficulty}</span>
                          <span>📅 {new Date(assignment.created_at).toLocaleDateString()}</span>
                          {assignment.score !== undefined && (
                            <span className="text-green-600 font-semibold">
                              Score: {assignment.score}%
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            // TODO: Open assignment detail modal or page
                            alert(`Assignment Details:\n\n${JSON.stringify(assignment, null, 2)}`);
                          }}
                          className="text-sm text-purple-600 hover:text-purple-700 font-medium px-4 py-2 rounded-lg hover:bg-purple-50"
                        >
                          View Full Details →
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
