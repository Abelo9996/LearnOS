'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to courses page
    router.push('/courses');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-green-50">
      <div className="text-center">
        <div className="text-6xl mb-4">📚</div>
        <div className="text-xl text-gray-600">Redirecting to your courses...</div>
      </div>
    </div>
  );
}
