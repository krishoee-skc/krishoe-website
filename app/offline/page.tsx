"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📡</div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          You're Offline
        </h1>

        <p className="text-gray-600 mb-6">
          Check your internet connection. Cached pages are still available.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 text-left">
          <h2 className="font-semibold text-gray-900 mb-3">💡 Available Offline:</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✅ Dashboard & Profile</li>
            <li>✅ Payslips & Earnings</li>
            <li>✅ Attendance Records</li>
            <li>✅ Production Details</li>
            <li>✅ Shop (browsing only)</li>
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Go Home
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-200 text-gray-900 py-3 rounded-lg font-medium hover:bg-gray-300"
          >
            Go Back
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Auto-refresh when connection restored
        </p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('online', () => {
              document.querySelector('h1').textContent = 'Back Online!';
              setTimeout(() => window.location.reload(), 1000);
            });
          `,
        }}
      />
    </div>
  );
}
