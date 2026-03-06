'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';

interface Assignment {
  assignment_id: string;
  title: string;
  description: string;
  assignment_type: string;
  difficulty: string;
  estimated_time_hours: number;
  status: string;
  learning_objectives: string[];
  instructions: string[];
  requirements: string[];
  questions: string[];
  hints: string[];
  rubric: any[];
  resources: string[];
  starter_materials?: string;
  starter_code?: string;
  submission?: string;
  score?: number;
  feedback?: string;
  created_at: string;
  completed_at?: string;
}

export default function AssignmentDetailPage({ params }: { params: { assignmentId: string } }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAssignment();
  }, [params.assignmentId]);

  const loadAssignment = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ai/assignments/${params.assignmentId}`);
      if (res.ok) {
        const data = await res.json();
        setAssignment(data);
        if (data.submission) setSubmission(data.submission);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!submission.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/ai/assignments/${params.assignmentId}/submit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission }),
      });
      if (res.ok) {
        await loadAssignment();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">Loading assignment...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-red-800">
          Assignment not found.
          <button onClick={() => router.back()} className="block mt-4 text-red-600 hover:text-red-700 font-medium">← Go Back</button>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    graded: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 font-medium mb-4">← Back</button>
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full uppercase">
              {assignment.assignment_type.replace('_', ' ')}
            </span>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusColors[assignment.status] || 'bg-gray-100 text-gray-700'}`}>
              {assignment.status.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{assignment.title}</h1>
          <p className="text-gray-600 text-lg">{assignment.description}</p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>⏱️ {assignment.estimated_time_hours}h estimated</span>
            <span>📊 {assignment.difficulty}</span>
            <span>📅 {new Date(assignment.created_at).toLocaleDateString()}</span>
            {assignment.score != null && (
              <span className="text-green-600 font-bold">Score: {assignment.score}%</span>
            )}
          </div>
        </div>

        {/* Learning Objectives */}
        {assignment.learning_objectives?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🎯 Learning Objectives</h2>
            <ul className="space-y-2">
              {assignment.learning_objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {assignment.instructions?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Instructions</h2>
            <ol className="space-y-2 list-decimal list-inside">
              {assignment.instructions.map((inst, i) => (
                <li key={i} className="text-gray-700">{inst}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Requirements */}
        {assignment.requirements?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">✅ Requirements</h2>
            <ul className="space-y-2">
              {assignment.requirements.map((req, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Questions */}
        {assignment.questions?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">❓ Questions</h2>
            <ol className="space-y-3 list-decimal list-inside">
              {assignment.questions.map((q, i) => (
                <li key={i} className="text-gray-700">{q}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Starter Materials */}
        {(assignment.starter_materials || assignment.starter_code) && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📦 Starter Materials</h2>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
              {assignment.starter_code || assignment.starter_materials}
            </pre>
          </div>
        )}

        {/* Rubric */}
        {assignment.rubric?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📌 Grading Rubric</h2>
            <div className="space-y-3">
              {assignment.rubric.map((r: any, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-900">{r.criterion || r.category}</span>
                    <span className="text-sm font-bold text-purple-600">{r.points || r.weight} pts</span>
                  </div>
                  <p className="text-sm text-gray-600">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hints */}
        {assignment.hints?.length > 0 && (
          <details className="bg-white rounded-2xl shadow-xl p-6">
            <summary className="text-xl font-bold text-gray-900 cursor-pointer">💡 Hints (click to reveal)</summary>
            <ul className="mt-4 space-y-2">
              {assignment.hints.map((hint, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="text-yellow-500">💡</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Feedback */}
        {assignment.feedback && (
          <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-green-900 mb-2">📝 Feedback</h2>
            <p className="text-green-800">{assignment.feedback}</p>
          </div>
        )}

        {/* Submission */}
        {assignment.status !== 'completed' && assignment.status !== 'graded' && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">✍️ Your Submission</h2>
            <textarea
              value={submission}
              onChange={(e) => setSubmission(e.target.value)}
              rows={10}
              placeholder="Write your submission here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !submission.trim()}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? '⏳ Submitting...' : '🚀 Submit Assignment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
