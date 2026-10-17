import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

const SEARCH_THRESHOLD = 5;
const RECENT_COUNT = 5;
const MAX_RESULTS = 50;
const POPUP_HEIGHT = 320;

const fieldClasses = (invalid) =>
  [
    'w-full rounded border bg-white px-3 py-2 text-sm text-steel-900',
    'focus:outline-none focus:ring-2',
    'disabled:cursor-not-allowed disabled:bg-steel-50',
    invalid
      ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/30'
      : 'border-steel-200 focus:border-brand-600 focus:ring-brand-600/25',
  ].join(' ');

function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf(node.props.children);
  return '';
}

function collectOptions(children, list = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      collectOptions(child.props.children, list);
      return;
    }
    if (child.type !== 'option') return;
    const label = textOf(child.props.children);
    const value = child.props.value === undefined ? label : String(child.props.value);
    list.push({
      value,
      label,
      search: `${label} ${value}`.toLowerCase(),
      disabled: Boolean(child.props.disabled),
      added: child.props['data-added'],
      index: list.length,
    });
  });
  return list;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function compareAdded(a, b) {
  const known = [hasValue(a.added), hasValue(b.added)];
  if (!known[0] && !known[1]) return a.index - b.index;
  if (!known[0]) return 1;
  if (!known[1]) return -1;
  const x = Number(a.added);
  const y = Number(b.added);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return y - x || a.index - b.index;
  return String(b.added).localeCompare(String(a.added)) || a.index - b.index;
}

function matches(option, words) {
  return words.every((word) => option.search.includes(word));
}

function changeEvent(value, name, id) {
  const target = { value, name, id };
  return { target, currentTarget: target, type: 'change', preventDefault() {}, stopPropagation() {}, persist() {} };
}

function NativeSelect({ invalid = false, describedBy, className = '', children, ...props }) {
  return (
    <select aria-invalid={invalid || undefined} aria-describedby={describedBy} className={`${fieldClasses(invalid)} ${className}`} {...props}>
      {children}
    </select>
  );
}

function SearchableSelect({
  options,
  id,
  name,
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
  className = '',
  'aria-label': ariaLabel,
}) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState(null);

  const current = value == null ? '' : String(value);
  const selected = useMemo(() => options.find((o) => o.value === current) ?? null, [options, current]);
  const blanks = useMemo(() => options.filter((o) => o.value === ''), [options]);

  const recentView = useMemo(() => {
    if (!open) return null;
    const entries = options.filter((o) => o.value !== '');
    const dated = entries.filter((o) => hasValue(o.added));
    if (dated.length <= RECENT_COUNT) return null;
    return {
      dated,
      recent: [...dated].sort(compareAdded).slice(0, RECENT_COUNT),
      undated: entries.filter((o) => !hasValue(o.added)),
    };
  }, [open, options]);

  const trimmed = query.trim();
  const { shown, footer } = useMemo(() => {
    if (!open) return { shown: [], footer: null };
    const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      const found = [];
      let total = 0;
      for (const option of options) {
        if (!matches(option, words)) continue;
        total += 1;
        if (found.length < MAX_RESULTS) found.push(option);
      }
      if (!total) return { shown: found, footer: `No matches for “${trimmed}”.` };
      if (total > MAX_RESULTS) return { shown: found, footer: `Showing the first ${MAX_RESULTS} of ${total} matches. Keep typing to narrow it down.` };
      return { shown: found, footer: null };
    }
    if (!recentView) return { shown: options, footer: null };
    const { dated, recent, undated } = recentView;
    const pinned = selected && hasValue(selected.added) && !recent.includes(selected) ? [selected] : [];
    return {
      shown: [...blanks, ...pinned, ...recent, ...undated],
      footer:
        dated.length > recent.length + pinned.length
          ? `Showing the ${RECENT_COUNT} most recently added. Type to search all ${dated.length}.`
          : null,
    };
  }, [open, trimmed, options, recentView, selected, blanks]);

  const firstEnabled = (list, from = 0, step = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += step) if (!list[i].disabled) return i;
    return -1;
  };

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const upward = below < Math.min(POPUP_HEIGHT, 220) && above > below;
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - margin - width));
    setPosition({
      left,
      width,
      maxHeight: Math.max(160, Math.min(POPUP_HEIGHT, upward ? above : below)),
      ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, []);

  function openList(initialQuery = '') {
    if (disabled) return;
    setQuery(initialQuery);
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    setQuery('');
    setPosition(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(option) {
    if (!option || option.disabled) return;
    close();
    if (option.value !== current) onChange?.(changeEvent(option.value, name, id));
  }

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  const placed = position !== null;
  useEffect(() => {
    if (open && placed) inputRef.current?.focus();
  }, [open, placed]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (triggerRef.current?.contains(event.target) || popupRef.current?.contains(event.target)) return;
      setOpen(false);
      setQuery('');
      setPosition(null);
    };
    const onScroll = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      place();
    };
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = trimmed ? -1 : shown.findIndex((o) => o.value === current);
    setActive(selectedIndex >= 0 ? selectedIndex : Math.max(0, firstEnabled(shown)));
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function onTriggerKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openList(event.key);
    }
  }

  function onSearchKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = firstEnabled(shown, active + 1, 1);
      if (next >= 0) setActive(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = firstEnabled(shown, active - 1, -1);
      if (previous >= 0) setActive(previous);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  const activeOption = open ? shown[active] : null;

  return (
    <div className={`relative w-full ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={`${fieldClasses(invalid)} flex items-center gap-2 text-left`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? blanks[0]?.label ?? ''}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 fill-steel-500">
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      {open && (
        <div
          ref={popupRef}
          style={
            position
              ? { position: 'fixed', left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }
              : { position: 'fixed', visibility: 'hidden' }
          }
          className="z-50 flex flex-col overflow-hidden rounded border border-steel-200 bg-white shadow-lg"
        >
          <div className="border-b border-steel-100 p-2">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label={`Search ${ariaLabel ?? 'options'}`}
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeOption ? `${baseId}-option-${active}` : undefined}
              autoComplete="off"
              placeholder="Type to search…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              className="w-full rounded border border-steel-200 px-2.5 py-1.5 text-sm text-steel-900 placeholder:text-steel-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
            {shown.map((option, index) => {
              const isSelected = option.value === current;
              const isActive = index === active;
              return (
                <li
                  key={`${option.value}-${option.index}`}
                  id={`${baseId}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(option)}
                  className={[
                    'cursor-pointer px-3 py-2 text-sm',
                    option.disabled ? 'cursor-not-allowed text-steel-300' : isActive ? 'bg-brand-50 text-steel-900' : 'text-steel-900',
                    isSelected ? 'font-semibold text-brand-700' : '',
                  ].join(' ')}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>
          {footer && <p className="border-t border-steel-100 bg-steel-50 px-3 py-2 text-xs text-steel-500">{footer}</p>}
        </div>
      )}
    </div>
  );
}

export default function Select({ searchable, ...props }) {
  const options = collectOptions(props.children);
  const fromRecords = options.some((o) => hasValue(o.added));
  const entryCount = options.filter((o) => o.value !== '').length;
  const useSearch = searchable ?? (fromRecords || entryCount > SEARCH_THRESHOLD);
  if (useSearch) return <SearchableSelect {...props} options={options} />;
  return <NativeSelect {...props} />;
}
