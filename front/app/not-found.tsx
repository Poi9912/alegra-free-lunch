'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center space-y-6">
        {/* Big Icon: Paper with Exclamation Mark */}
        <div className="flex justify-center">
          <div className="p-4 bg-[#708238]/10 rounded-2xl">
            <svg
              className="w-16 h-16 text-[#708238]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              {/* Clean Document Outline with Folded Corner */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v6h6" />

              {/* Exclamation Mark */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v3m0 3h.01" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Page Not Found</h1>
          <p className="text-sm text-stone-500">
            The resource or page you are looking for does not exist or has been relocated.
          </p>
        </div>

        {/* Redirect Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Go Back
          </button>
          <Link
            href="/dashboard"
            className="flex-1 py-2.5 px-4 bg-[#708238] hover:bg-[#5c6e2e] text-white font-semibold rounded-xl text-xs transition-colors shadow-sm text-center flex items-center justify-center"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}