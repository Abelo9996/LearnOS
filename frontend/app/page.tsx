'use client';

import { useRouter } from 'next/navigation';

const features = [
  { icon: '🗺️', title: 'AI Roadmaps', desc: 'GPT-4 generates personalized learning paths with milestones, resources, and timelines tailored to your goals.' },
  { icon: '📝', title: 'Smart Assignments', desc: 'Automatically generated assignments with rubrics, hints, and test cases — matched to your skill level.' },
  { icon: '📊', title: 'Progress Tracking', desc: 'Real-time analytics on your learning sessions, concepts mastered, and milestone completion.' },
  { icon: '🧠', title: 'Habit Analytics', desc: 'AI analyzes your learning patterns and suggests optimizations for peak performance.' },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
          <span>🚀</span> AI-Powered Learning Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          Master Anything with{' '}
          <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            LearnOS
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Tell us what you want to learn. Our AI creates personalized roadmaps, generates assignments, and tracks your progress — so you can focus on actually learning.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => router.push('/courses/create')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg rounded-xl hover:from-purple-700 hover:to-blue-700 shadow-lg transition-all hover:shadow-xl"
          >
            Start Learning →
          </button>
          <button
            onClick={() => router.push('/courses')}
            className="px-8 py-4 bg-white text-gray-700 font-bold text-lg rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all"
          >
            My Courses
          </button>
          <a
            href="https://github.com/Abelo9996/LearnOS"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold text-lg rounded-xl hover:from-green-500 hover:to-green-400 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
          >
            <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/></svg>
            Star on GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Create a Course', desc: 'Tell us your learning goal and timeline. Our AI designs a custom roadmap.' },
            { step: '2', title: 'Follow Your Path', desc: 'Work through milestones with curated resources, lessons, and practice exercises.' },
            { step: '3', title: 'Track & Improve', desc: 'Monitor your progress, complete assignments, and get AI-powered insights.' },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-gray-600 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-gray-500 text-sm">
          Built with AI · LearnOS v4.1
        </div>
      </footer>
    </div>
  );
}
