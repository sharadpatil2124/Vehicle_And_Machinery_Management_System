import { useId } from 'react';

export default function Field({ label, error, hint, required = false, children }) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-steel-700">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </label>

      {children({
        id,
        invalid: Boolean(error),
        describedBy: error ? errorId : hint ? hintId : undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-steel-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
