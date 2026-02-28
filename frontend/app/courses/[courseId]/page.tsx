'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';
import { useToast } from '@/components/Toast';
import API_URL from '@/lib/api';

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
}

interface LearningStep {
  step_id?: string;
  order: number;
  title: string;
  description: string;
  learning_objectives?: string[];
  key_concepts?: string[];
  content: string;
  video_resources?: any[];
  reading_resources?: any[];
  interactive_resources?: any[];
  action_items?: string[];
  practice_exercises?: string[];
  estimated_minutes?: number;
  difficulty?: string;
  completed?: boolean;
}

interface Milestone {
  milestone_id: string;
  title: string;
  description: string;
  overview?: string;
  concepts: string[];
  estimated_hours: number;
  completed: boolean;
  why_important?: string;
  real_world_applications?: string[];
  learning_steps?: LearningStep[];
  web_resources?: any[];
}

interface Assignment {
  assignment_id: string;
  title: string;
  description: string;
  assignment_type: string;
  status: string;
  estimated_time_hours: number;
  difficulty: string;
  learning_objectives?: string[];
  instructions?: string[];
  questions?: string[];
  rubric?: any[];
  hints?: string[];
  score?: number;
  created_at: string;
}

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const { toast } = useToast();

  const [userId, setUserId] = useState('');
  const [course, setCourse] = useState<Course | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roadmapId, setRoadmapId] = useState('');
  const [stats, setStats] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // UI state
  const [selectedModule, setSelectedModule] = useState<number>(0);
  const [selectedLesson, setSelectedLesson] = useState<number>(0);
  const [view, setView] = useState<'overview' | 'learn' | 'assignment'>('overview');

  // AI lesson generation
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');

  useEffect(() => { setUserId(getUserId()); }, []);
  useEffect(() => { if (userId) loadCourseData(); }, [userId]);

  const loadCourseData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/courses/${params.courseId}`);
      if (!res.ok) throw new Error('Failed to load course');
      const data = await res.json();
      setCourse(data.course);
      setStats(data.stats);

      if (data.roadmap?.milestones) {
        setMilestones(data.roadmap.milestones);
        setRoadmapId(data.roadmap.roadmap_id);
      }

      // Load assignments
      if (data.course?.course_id) {
        const aRes = await fetch(`${API_URL}/api/ai/assignments/list/${getUserId()}?course_id=${data.course.course_id}`);
        if (aRes.ok) {
          const aData = await aRes.json();
          setAssignments(aData.assignments || []);
        }
      }
    } catch {
      setError('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const generateRoadmap = async () => {
    if (!course) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/ai/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          goal: course.goal,
          target_weeks: course.target_weeks,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed');
      }
      const data = await res.json();
      // Link roadmap to course
      await fetch(`${API_URL}/api/courses/${course.course_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap_id: data.roadmap.roadmap_id }),
      });
      toast('Roadmap generated!', 'success');
      await loadCourseData();
    } catch (err: any) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const generateAssignment = async (milestone: Milestone) => {
    if (!course || !roadmapId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/assignments/generate-milestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          course_id: course.course_id,
          milestone_id: milestone.milestone_id,
          roadmap_id: roadmapId,
          milestone_title: milestone.title,
          milestone_description: milestone.description || milestone.overview || '',
          concepts: milestone.concepts || [],
          learning_steps: milestone.learning_steps || [],
          difficulty: 'intermediate',
        }),
      });
      if (res.ok) {
        toast('Assignment created!', 'success');
        await loadCourseData();
      } else {
        const err = await res.json();
        toast(err.detail || 'Failed', 'error');
      }
    } catch {
      toast('Failed to generate assignment', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleMilestone = async (milestoneId: string) => {
    if (!roadmapId) return;
    setActionLoading(true);
    try {
      await fetch(`${API_URL}/api/ai/roadmap/${roadmapId}/milestone/${milestoneId}/complete`, { method: 'PUT' });
      await loadCourseData();
    } finally {
      setActionLoading(false);
    }
  };

  const generateLessonContent = async (milestone: Milestone, step: LearningStep) => {
    setGeneratingLesson(true);
    setGeneratedContent('');
    try {
      const res = await fetch(`${API_URL}/api/ai/tutor/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          course_id: params.courseId,
          milestone_id: milestone.milestone_id,
          topic: step.title,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedContent(data.greeting);
        // Now ask for a full lesson
        const lessonRes = await fetch(`${API_URL}/api/ai/tutor/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            chat_id: data.chat_id,
            message: `Please give me a complete, detailed lesson on "${step.title}". Include: key concepts with explanations, real-world examples, and 3 practice questions at the end. Format with headers and bullet points.`,
          }),
        });
        if (lessonRes.ok) {
          const lessonData = await lessonRes.json();
          setGeneratedContent(lessonData.reply);
        }
      }
    } catch {
      setGeneratedContent('Failed to generate lesson. Check your AI settings.');
    } finally {
      setGeneratingLesson(false);
    }
  };

  const mod = milestones[selectedModule];
  const completedCount = milestones.filter((m) => m.completed).length;
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg animate-pulse">Loading course...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-gray-700 text-lg mb-4">{error || 'Course not found'}</p>
          <button onClick={() => router.push('/courses')} className="text-purple-600 font-medium hover:underline">
            ← Back to Courses
          </button>
        </div>
      </div>
    );
  }

  // No roadmap yet — show generation prompt
  if (milestones.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <button onClick={() => router.push('/courses')} className="text-gray-600 hover:text-gray-800 font-medium mb-6 block">
            ← Back to Courses
          </button>
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
            <p className="text-gray-600 text-lg mb-2">{course.goal}</p>
            <p className="text-gray-500 mb-8">Target: {course.target_weeks} weeks</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
            )}

            <p className="text-gray-600 mb-6">
              Let AI create a personalized curriculum with modules, lessons, and resources tailored to your learning goal.
            </p>
            <button
              onClick={generateRoadmap}
              disabled={actionLoading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold px-8 py-4 rounded-xl text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg"
            >
              {actionLoading ? (
                <span className="flex items-center gap-3 justify-center">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating curriculum...
                </span>
              ) : (
                '✨ Generate My Curriculum'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 overflow-y-auto">
        {/* Course header */}
        <div className="p-4 border-b border-gray-200">
          <button onClick={() => router.push('/courses')} className="text-xs text-gray-500 hover:text-gray-700 mb-2 block">
            ← All Courses
          </button>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">{course.title}</h1>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{completedCount}/{milestones.length} modules</span>
              <span className="font-bold">{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Module list */}
        <nav className="flex-1 p-2 space-y-1">
          {milestones.map((m, idx) => {
            const isActive = selectedModule === idx;
            const stepCount = m.learning_steps?.length || 0;
            return (
              <button
                key={m.milestone_id}
                onClick={() => { setSelectedModule(idx); setSelectedLesson(0); setView('overview'); setGeneratedContent(''); }}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-purple-50 border-2 border-purple-300'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                    m.completed
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {m.completed ? '✓' : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold leading-tight ${isActive ? 'text-purple-900' : 'text-gray-800'}`}>
                      {m.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stepCount > 0 ? `${stepCount} lessons` : ''} · {m.estimated_hours}h
                    </div>
                  </div>
                </div>

                {/* Sub-lessons (expanded when active) */}
                {isActive && stepCount > 0 && (
                  <div className="mt-2 ml-10 space-y-1">
                    {m.learning_steps!.sort((a, b) => a.order - b.order).map((step, sIdx) => (
                      <div
                        key={sIdx}
                        onClick={(e) => { e.stopPropagation(); setSelectedLesson(sIdx); setView('learn'); setGeneratedContent(''); }}
                        className={`text-xs p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedLesson === sIdx && view === 'learn'
                            ? 'bg-purple-100 text-purple-800 font-semibold'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {step.order}. {step.title}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-gray-200 space-y-2">
          <button
            onClick={() => router.push(`/tutor/${params.courseId}`)}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            🤖 Open AI Tutor Chat
          </button>
          <button
            onClick={() => router.push('/ai-settings')}
            className="w-full py-2 text-gray-600 hover:text-gray-800 text-xs font-medium hover:bg-gray-50 rounded-lg"
          >
            ⚙️ Settings
          </button>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 min-h-screen">
        {mod ? (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Module header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                  Module {selectedModule + 1} of {milestones.length}
                </span>
                {mod.completed && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">Completed</span>
                )}
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{mod.title}</h2>
              <p className="text-gray-600 text-lg">{mod.description}</p>

              {/* Module actions */}
              <div className="flex gap-3 mt-4 flex-wrap">
                <button
                  onClick={() => setView('overview')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'overview' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  📋 Overview
                </button>
                {mod.learning_steps && mod.learning_steps.length > 0 && (
                  <button
                    onClick={() => { setView('learn'); setSelectedLesson(0); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'learn' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    📖 Lessons ({mod.learning_steps.length})
                  </button>
                )}
                <button
                  onClick={() => setView('assignment')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'assignment' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  📝 Assignments ({assignments.filter(a => a.title?.toLowerCase().includes(mod.title.split(':').pop()?.trim().toLowerCase().slice(0, 10) || '')).length || 0})
                </button>
                <button
                  onClick={() => router.push(`/tutor/${params.courseId}?milestone=${mod.milestone_id}`)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
                >
                  🤖 Ask AI Tutor
                </button>
              </div>
            </div>

            {/* ─── OVERVIEW VIEW ─── */}
            {view === 'overview' && (
              <div className="space-y-6">
                {mod.overview && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-3">About This Module</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{mod.overview}</p>
                  </div>
                )}

                {mod.why_important && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="font-bold text-blue-900 mb-2">💡 Why This Matters</h3>
                    <p className="text-blue-800">{mod.why_important}</p>
                  </div>
                )}

                {mod.concepts && mod.concepts.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-3">Key Concepts</h3>
                    <div className="flex flex-wrap gap-2">
                      {mod.concepts.map((c, i) => (
                        <span key={i} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {mod.real_world_applications && mod.real_world_applications.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-3">🌍 Real-World Applications</h3>
                    <ul className="space-y-2">
                      {mod.real_world_applications.map((app, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className="text-green-500 mt-1">→</span>
                          <span>{app}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Lessons preview */}
                {mod.learning_steps && mod.learning_steps.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-900 mb-4">📚 Lessons in This Module</h3>
                    <div className="space-y-2">
                      {mod.learning_steps.sort((a, b) => a.order - b.order).map((step, i) => (
                        <button
                          key={i}
                          onClick={() => { setSelectedLesson(i); setView('learn'); setGeneratedContent(''); }}
                          className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {step.order}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{step.title}</div>
                            <div className="text-sm text-gray-500 mt-0.5">{step.description}</div>
                          </div>
                          <span className="text-purple-600 text-sm font-medium">Start →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Module completion */}
                <div className="flex gap-3">
                  <button
                    onClick={() => toggleMilestone(mod.milestone_id)}
                    disabled={actionLoading}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      mod.completed
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50`}
                  >
                    {mod.completed ? '↩️ Mark Incomplete' : '✅ Mark Module Complete'}
                  </button>
                  <button
                    onClick={() => generateAssignment(mod)}
                    disabled={actionLoading}
                    className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition-all"
                  >
                    📝 Generate Assignment
                  </button>
                </div>
              </div>
            )}

            {/* ─── LESSON VIEW ─── */}
            {view === 'learn' && mod.learning_steps && mod.learning_steps.length > 0 && (() => {
              const step = mod.learning_steps!.sort((a, b) => a.order - b.order)[selectedLesson];
              if (!step) return null;
              return (
                <div className="space-y-6">
                  {/* Lesson header */}
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>Lesson {selectedLesson + 1} of {mod.learning_steps!.length}</span>
                    {step.estimated_minutes && <span>· ⏱️ {step.estimated_minutes} min</span>}
                    {step.difficulty && <span>· 📊 {step.difficulty}</span>}
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>

                  {/* Learning objectives */}
                  {step.learning_objectives && step.learning_objectives.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <h4 className="font-bold text-green-900 mb-2">🎯 After this lesson, you will:</h4>
                      <ul className="space-y-1">
                        {step.learning_objectives.map((obj, i) => (
                          <li key={i} className="text-green-800 text-sm flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Lesson content */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="prose prose-gray max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {step.content || 'No pre-generated content. Click "Generate AI Lesson" below for a detailed lesson.'}
                    </div>
                  </div>

                  {/* AI-generated deep lesson */}
                  {!generatedContent && !generatingLesson && (
                    <button
                      onClick={() => generateLessonContent(mod, step)}
                      className="w-full py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-dashed border-purple-300 rounded-xl text-purple-700 font-semibold hover:from-purple-100 hover:to-blue-100 transition-all"
                    >
                      ✨ Generate Detailed AI Lesson
                    </button>
                  )}

                  {generatingLesson && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
                      <div className="animate-pulse text-4xl mb-3">🤖</div>
                      <p className="text-purple-700 font-medium">Generating your personalized lesson...</p>
                    </div>
                  )}

                  {generatedContent && (
                    <div className="bg-white rounded-xl border-2 border-purple-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg">🤖</span>
                        <h4 className="font-bold text-purple-900">AI-Generated Lesson</h4>
                      </div>
                      <div
                        className="prose prose-gray max-w-none text-gray-800 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(generatedContent) }}
                      />
                    </div>
                  )}

                  {/* Action items */}
                  {step.action_items && step.action_items.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                      <h4 className="font-bold text-yellow-900 mb-2">✅ Try This</h4>
                      <ul className="space-y-1">
                        {step.action_items.map((item, i) => (
                          <li key={i} className="text-yellow-800 text-sm flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">→</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Practice */}
                  {step.practice_exercises && step.practice_exercises.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                      <h4 className="font-bold text-purple-900 mb-2">🏋️ Practice</h4>
                      <ul className="space-y-2">
                        {step.practice_exercises.map((ex, i) => (
                          <li key={i} className="text-purple-800 text-sm">{i + 1}. {ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => { if (selectedLesson > 0) { setSelectedLesson(selectedLesson - 1); setGeneratedContent(''); } }}
                      disabled={selectedLesson === 0}
                      className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← Previous Lesson
                    </button>
                    {selectedLesson < (mod.learning_steps?.length || 0) - 1 ? (
                      <button
                        onClick={() => { setSelectedLesson(selectedLesson + 1); setGeneratedContent(''); }}
                        className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700"
                      >
                        Next Lesson →
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (selectedModule < milestones.length - 1) {
                            setSelectedModule(selectedModule + 1);
                            setSelectedLesson(0);
                            setView('overview');
                            setGeneratedContent('');
                          }
                        }}
                        disabled={selectedModule >= milestones.length - 1}
                        className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        Next Module →
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ─── ASSIGNMENTS VIEW ─── */}
            {view === 'assignment' && (
              <div className="space-y-6">
                {assignments.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <div className="text-5xl mb-4">📝</div>
                    <p className="text-gray-600 mb-4">No assignments yet for this course.</p>
                    <button
                      onClick={() => generateAssignment(mod)}
                      disabled={actionLoading}
                      className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Generating...' : '✨ Generate Assignment for This Module'}
                    </button>
                  </div>
                ) : (
                  assignments.map((a) => (
                    <div key={a.assignment_id} className={`bg-white rounded-xl border-2 p-6 ${
                      a.status === 'completed' || a.status === 'graded' ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold uppercase">
                          {a.assignment_type.replace('_', ' ')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          a.status === 'completed' || a.status === 'graded' ? 'bg-green-100 text-green-700'
                          : a.status === 'submitted' ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {a.status.replace('_', ' ')}
                        </span>
                        {a.score != null && <span className="text-sm font-bold text-green-600">Score: {a.score}%</span>}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{a.title}</h3>
                      <p className="text-gray-600 text-sm mb-3">{a.description}</p>

                      {a.learning_objectives && a.learning_objectives.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-xs font-bold text-gray-700 mb-1">Learning Objectives:</h4>
                          <ul className="text-xs text-gray-600 space-y-0.5">
                            {a.learning_objectives.slice(0, 3).map((o, i) => (
                              <li key={i}>• {o}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                        <span>⏱️ {a.estimated_time_hours}h</span>
                        <span>📊 {a.difficulty}</span>
                        <button
                          onClick={() => router.push(`/assignments/${a.assignment_id}`)}
                          className="ml-auto text-purple-600 font-semibold hover:underline"
                        >
                          View Details →
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {assignments.length > 0 && (
                  <button
                    onClick={() => generateAssignment(mod)}
                    disabled={actionLoading}
                    className="w-full py-3 border-2 border-dashed border-purple-300 rounded-xl text-purple-600 font-semibold hover:bg-purple-50 disabled:opacity-50"
                  >
                    {actionLoading ? 'Generating...' : '+ Generate Another Assignment'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a module from the sidebar
          </div>
        )}
      </main>
    </div>
  );
}

function formatMarkdown(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-3 rounded-lg my-2 text-sm overflow-x-auto"><code>$1</code></pre>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm">$1</code>');
  html = html.replace(/^### (.*)/gm, '<h3 class="font-bold text-lg mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*)/gm, '<h2 class="font-bold text-xl mt-4 mb-2">$1</h2>');
  html = html.replace(/^- (.*)/gm, '<li class="ml-4 mb-1">• $1</li>');
  html = html.replace(/^\d+\. (.*)/gm, '<li class="ml-4 mb-1">$&</li>');
  return html;
}
