export default function Spinner({ label = 'Loading' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-8 text-steel-500">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-steel-300 border-t-brand-600"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
