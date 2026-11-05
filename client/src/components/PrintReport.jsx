import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

function fileDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function PrintCell({ value }) {
  if (!Array.isArray(value)) return value;
  return value.filter(Boolean).map((line, index) => (
    <span key={index} className={index ? 'block text-neutral-600' : 'block'}>
      {line}
    </span>
  ));
}

function PrintDocument({ report, onDone }) {
  const { user, organization } = useAuth();
  const { logoUrl } = useBranding();
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const previousTitle = document.title;
    const images = [...ref.current.querySelectorAll('img')];

    Promise.all(images.map((image) => image.decode().catch(() => {}))).then(() => {
      if (cancelled) return;
      document.title = `${report.title} ${fileDate(report.generatedAt)}`;
      window.addEventListener('afterprint', onDone, { once: true });
      window.print();
    });

    return () => {
      cancelled = true;
      window.removeEventListener('afterprint', onDone);
      document.title = previousTitle;
    };
  }, [report, onDone]);

  return createPortal(
    <div ref={ref} data-print-report className="hidden text-[11px] leading-snug text-black [page:report] print:block">
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-12 max-w-40 object-contain" />}
          <div>
            <p className="text-base font-bold">{organization?.organizationName}</p>
            <h1 className="text-sm font-semibold">{report.title}</h1>
          </div>
        </div>
        <div className="shrink-0 text-right text-neutral-600">
          <p>Generated {report.generatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {user?.name && <p>by {user.name}</p>}
        </div>
      </header>

      {report.filters.length ? (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {report.filters.map((filter) => (
            <div key={filter.label} className="flex gap-1">
              <dt className="font-semibold">{filter.label}:</dt>
              <dd>{filter.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-neutral-600">No filters applied.</p>
      )}

      {report.summary && (
        <dl className="mt-3 flex flex-wrap gap-3">
          {report.summary.map((item) => (
            <div key={item.label} className="border border-neutral-300 px-3 py-2">
              <dt className="text-[10px] font-semibold tracking-wide text-neutral-600 uppercase">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {report.sections.map((section) => (
        <section key={section.title} className="mt-4">
          <h2 className="mb-1 text-xs font-semibold">
            {section.title} ({section.rows.length})
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black">
                {section.columns.map((column) => (
                  <th key={column.key} scope="col" className={`px-1.5 py-1 align-bottom font-semibold ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? (
                <tr>
                  <td colSpan={section.columns.length} className="px-1.5 py-3 text-center text-neutral-600">
                    {section.emptyMessage}
                  </td>
                </tr>
              ) : (
                section.rows.map((row) => (
                  <tr key={section.getRowKey(row)} className="break-inside-avoid border-b border-neutral-300">
                    {section.columns.map((column) => (
                      <td key={column.key} className={`px-1.5 py-1 align-top ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                        <PrintCell value={column.render(row)} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>,
    document.body
  );
}

export default function PrintReportButton({ buildReport, onError }) {
  const [report, setReport] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const clearReport = useCallback(() => setReport(null), []);

  async function handleClick() {
    onError(null);
    setPreparing(true);
    try {
      const generatedAt = new Date();
      setReport({ ...(await buildReport(generatedAt)), generatedAt });
    } catch (err) {
      onError(err.message);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <>
      <Button variant="secondary" loading={preparing} onClick={handleClick} title="Opens the print dialog — choose Save as PDF to download">
        Print / Download
      </Button>
      {report && <PrintDocument report={report} onDone={clearReport} />}
    </>
  );
}
