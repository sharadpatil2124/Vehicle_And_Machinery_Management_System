export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-steel-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded border border-steel-200 bg-white px-7 py-8 shadow-sm">
          <h1 className="text-center text-2xl font-bold tracking-[0.06em] text-brand-600">VMMS</h1>
          <p className="mt-1 mb-6 text-center text-sm text-steel-500">{subtitle}</p>

          <h2 className="sr-only">{title}</h2>
          {children}
        </div>

        {footer && <p className="mt-4 text-center text-sm text-steel-500">{footer}</p>}
      </div>
    </div>
  );
}
