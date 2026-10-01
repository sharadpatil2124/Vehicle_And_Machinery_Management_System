export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5 border-b border-steel-200">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={[
            '-mb-px rounded-t px-3.5 py-2 text-sm font-semibold transition-colors border-b-2',
            active === tab.value
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-steel-500 hover:text-steel-800',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
