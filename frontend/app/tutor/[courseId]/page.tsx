'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getUserId } from '@/lib/userId';
import API_URL from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export default function TutorPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [userId, setUserId] = useState('');
  const [chatId, setChatId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);
  const [courseTitle, setCourseTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState('');

  // Quiz state
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  // Milestone picker
  const [milestones, setMilestones] = useState<any[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState('');
  const [showMilestonePicker, setShowMilestonePicker] = useState(true);
  const [customTopic, setCustomTopic] = useState('');

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (userId) loadCourseData();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCourseData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/courses/${params.courseId}`);
      if (res.ok) {
        const data = await res.json();
        setCourseTitle(data.course?.title || 'Course');
        if (data.roadmap?.milestones) {
          setMilestones(data.roadmap.milestones);
        }
      }
    } catch {
      // ignore
    }
    setStarting(false);
  };

  const startChat = async (milestoneId?: string, topicText?: string) => {
    setStarting(true);
    setShowMilestonePicker(false);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/ai/tutor/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          course_id: params.courseId,
          milestone_id: milestoneId || undefined,
          topic: topicText || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start chat');
      }

      const data = await res.json();
      setChatId(data.chat_id);
      setTopic(data.topic || '');
      setMessages([{ role: 'assistant', content: data.greeting }]);
    } catch (err: any) {
      setError(err.message);
      setShowMilestonePicker(true);
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !chatId) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/ai/tutor/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chat_id: chatId,
          message: userMsg,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to send message');
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const requestQuiz = async () => {
    if (!chatId) return;
    setQuizLoading(true);
    setQuiz(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/ai/tutor/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          chat_id: chatId,
          num_questions: 5,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to generate quiz');
      }

      const data = await res.json();
      setQuiz(data.quiz);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quizScore = () => {
    if (!quiz) return 0;
    let correct = 0;
    quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct_answer) correct++;
    });
    return correct;
  };

  // Milestone picker view
  if (showMilestonePicker && !chatId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 p-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <button onClick={() => router.push(`/courses/${params.courseId}`)} className="text-gray-600 hover:text-gray-800 font-medium mb-4">
              ← Back to Course
            </button>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">🤖 AI Tutor</h1>
            <p className="text-gray-600 mb-6">
              {courseTitle ? `Start a tutoring session for "${courseTitle}"` : 'Loading...'}
            </p>

            {starting && <p className="text-gray-500">Loading course data...</p>}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
            )}

            {!starting && milestones.length > 0 && (
              <div className="space-y-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-800">Choose a module to study:</h2>
                <div className="space-y-2">
                  {milestones.map((m, idx) => (
                    <button
                      key={m.milestone_id || idx}
                      onClick={() => startChat(m.milestone_id)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:border-purple-400 hover:shadow-md ${
                        m.completed ? 'bg-green-50 border-green-200' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          m.completed ? 'bg-green-500 text-white' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {m.completed ? '✓' : idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{m.title}</div>
                          <div className="text-sm text-gray-500">{m.concepts?.slice(0, 3).join(', ')}</div>
                        </div>
                        <span className="text-purple-600 text-sm font-medium">Study →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Or ask about anything:</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && customTopic.trim() && startChat(undefined, customTopic.trim())}
                  placeholder="e.g., 'Explain Stoic ethics' or 'Compare Epictetus and Seneca'"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button
                  onClick={() => customTopic.trim() && startChat(undefined, customTopic.trim())}
                  disabled={!customTopic.trim()}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
                >
                  Start →
                </button>
              </div>
            </div>

            <button
              onClick={() => startChat()}
              className="w-full mt-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transition-all"
            >
              ✨ Start General Tutoring Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/courses/${params.courseId}`)} className="text-gray-500 hover:text-gray-700">
              ←
            </button>
            <div>
              <h1 className="font-bold text-gray-900">🤖 AI Tutor</h1>
              <p className="text-xs text-gray-500">{topic || courseTitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={requestQuiz}
              disabled={quizLoading || !chatId}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors font-medium"
            >
              {quizLoading ? '⏳ Generating...' : '📝 Quiz Me'}
            </button>
            <button
              onClick={() => { setChatId(''); setMessages([]); setShowMilestonePicker(true); setQuiz(null); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              New Session
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-2">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
        </div>
      )}

      {/* Quiz Panel */}
      {quiz && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Quick Quiz</h2>
            <div className="space-y-6">
              {quiz.map((q, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-4 last:border-0">
                  <p className="font-semibold text-gray-900 mb-3">{idx + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const letter = opt.charAt(0);
                      const isSelected = quizAnswers[idx] === letter;
                      const isCorrect = quizSubmitted && letter === q.correct_answer;
                      const isWrong = quizSubmitted && isSelected && letter !== q.correct_answer;
                      return (
                        <button
                          key={opt}
                          onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [idx]: letter })}
                          disabled={quizSubmitted}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                            isCorrect ? 'border-green-500 bg-green-50' :
                            isWrong ? 'border-red-500 bg-red-50' :
                            isSelected ? 'border-purple-500 bg-purple-50' :
                            'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizSubmitted && (
                    <p className={`text-sm mt-2 ${quizAnswers[idx] === q.correct_answer ? 'text-green-700' : 'text-red-700'}`}>
                      {quizAnswers[idx] === q.correct_answer ? '✅ Correct!' : `❌ Correct answer: ${q.correct_answer}`} — {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {!quizSubmitted ? (
              <button
                onClick={() => setQuizSubmitted(true)}
                disabled={Object.keys(quizAnswers).length < quiz.length}
                className="w-full mt-4 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:bg-gray-300"
              >
                Submit Answers ({Object.keys(quizAnswers).length}/{quiz.length})
              </button>
            ) : (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-gray-900">{quizScore()}/{quiz.length}</p>
                <p className="text-gray-600">
                  {quizScore() === quiz.length ? '🎉 Perfect score!' :
                   quizScore() >= quiz.length * 0.8 ? '👏 Great job!' :
                   quizScore() >= quiz.length * 0.6 ? '👍 Not bad!' : '📚 Keep studying!'}
                </p>
                <button onClick={() => setQuiz(null)} className="mt-2 text-purple-600 hover:text-purple-700 font-medium">
                  Close Quiz
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {starting && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3 animate-pulse">🤖</div>
              <p>Starting tutoring session...</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white shadow-md text-gray-900'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: msg.role === 'assistant'
                      ? formatMarkdown(msg.content)
                      : escapeHtml(msg.content)
                  }}
                />
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-md rounded-2xl px-5 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {chatId && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question, explain a concept, or say 'quiz me'..."
                rows={1}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-purple-600 focus:border-transparent max-h-32"
                style={{ minHeight: '48px' }}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-5 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
              >
                {loading ? '...' : '→'}
              </button>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setInput('Explain this concept more simply')}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
              >
                Simplify
              </button>
              <button
                onClick={() => setInput('Give me a real-world example')}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
              >
                Example
              </button>
              <button
                onClick={() => setInput('What should I study next?')}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
              >
                What's next?
              </button>
              <button
                onClick={() => setInput('Challenge me with a harder question')}
                className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
              >
                Challenge me
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMarkdown(text: string): string {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-3 rounded-lg my-2 text-xs overflow-x-auto"><code>$1</code></pre>');
  // Inline code
  html = html.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm">$1</code>');
  // Headers
  html = html.replace(/^### (.*)/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.*)/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>');
  // List items
  html = html.replace(/^- (.*)/gm, '<li class="ml-4">• $1</li>');
  html = html.replace(/^\d+\. (.*)/gm, '<li class="ml-4">$&</li>');
  return html;
}
