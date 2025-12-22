'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RoadmapPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to courses - roadmaps are now course-centric
    router.push('/courses');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🗺️</div>
        <p className="text-gray-600 text-lg">Redirecting to Courses...</p>
        <p className="text-sm text-gray-500 mt-2">Roadmaps are now part of individual courses</p>
      </div>
    </div>
  );
}
