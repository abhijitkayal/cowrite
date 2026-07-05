export default function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-red-600">
          No access
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          You cannot open this link
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          This document link is not available for your role. Please use the
          correct shared link.
        </p>
        <a
          href="/documents"
          className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Go back to documents
        </a>
      </div>
    </main>
  );
}