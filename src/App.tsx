import { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ChecksPanel } from './components/ChecksPanel';
import { DecodeModal } from './components/DecodeModal';
import { Header, Hero } from './components/Header';
import { Inspector } from './components/Inspector';
import { ItineraryPanel } from './components/ItineraryPanel';
import { LinkPanel } from './components/LinkPanel';
import { PastePanel } from './components/PastePanel';
import { HowItWorks } from './components/HowItWorks';
import { Button, Card, CopyButton } from './components/ui';
import { loadAirportTable, lookupAirport } from './lib/airports';
import { analyze } from './lib/analyze';
import { cabinForClass } from './lib/classes';
import { makeSegment, parseItinerary, type ParseStats } from './lib/parse';
import { EXAMPLES } from './lib/samples';
import { DEFAULT_BUILD_OPTIONS, type BuildOptions, type Issue, type Segment } from './lib/types';

const SLICE_THRESHOLD_HOURS = 24;

export default function App() {
  const bootstrap = useMemo(() => parseItinerary(EXAMPLES[0].text), []);

  const [text, setText] = useState(EXAMPLES[0].text);
  const [segments, setSegments] = useState<Segment[]>(bootstrap.segments);
  const [parseIssues, setParseIssues] = useState<Issue[]>(bootstrap.issues);
  const [stats, setStats] = useState<ParseStats | null>(bootstrap.stats);
  const [options, setOptions] = useState<BuildOptions>(DEFAULT_BUILD_OPTIONS);
  const [threshold, setThreshold] = useState(SLICE_THRESHOLD_HOURS);
  const [yearOverride, setYearOverride] = useState<number | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [decodeOpen, setDecodeOpen] = useState(false);

  const parsedKey = useRef(`${EXAMPLES[0].text}|null`);

  useEffect(() => {
    let cancelled = false;
    loadAirportTable()
      .then(() => !cancelled && setDbReady(true))
      .catch((error: unknown) => !cancelled && setDbError(String(error)));
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-parse the paste (debounced) whenever the text or the year pin changes.
  useEffect(() => {
    const key = `${text}|${yearOverride}`;
    if (key === parsedKey.current) return;
    const handle = window.setTimeout(() => {
      const result = parseItinerary(text, { yearOverride });
      setSegments(result.segments);
      setParseIssues(result.issues);
      setStats(result.stats);
      parsedKey.current = key;
    }, 320);
    return () => window.clearTimeout(handle);
  }, [text, yearOverride]);

  const analysis = useMemo(() => {
    if (!dbReady) return null;
    return analyze(segments, options, {
      lookup: lookupAirport,
      thresholdHours: threshold,
      parseIssues,
      now: new Date(),
    });
  }, [segments, options, threshold, parseIssues, dbReady]);

  const hasManualSlices = segments.some(
    (s) => s.newSliceOverride === true || s.newSliceOverride === false,
  );

  const patchSegment = (id: string, patch: Partial<Segment>) => {
    setSegments((prev) =>
      prev.map((segment) => {
        if (segment.id !== id) return segment;
        const next: Segment = { ...segment, ...patch };
        if (patch.bookingClass !== undefined) {
          next.classConflict = undefined;
          if (patch.cabin === undefined) {
            const derived = cabinForClass(patch.bookingClass);
            if (derived) next.cabin = derived;
          }
        }
        return next;
      }),
    );
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((segment) => segment.id !== id));
  };

  const moveSegment = (id: string, dir: -1 | 1) => {
    setSegments((prev) => {
      const index = prev.findIndex((segment) => segment.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addSegment = () => {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        makeSegment({
          carrier: 'AA',
          origin: last?.destination ?? '',
          destination: '',
          depDate: last?.depDate ?? new Date().toISOString().slice(0, 10),
          cabin: last?.cabin ?? 'ECONOMY',
        }),
      ];
    });
  };

  const resetSlices = () => {
    setSegments((prev) => prev.map((segment) => ({ ...segment, newSliceOverride: null })));
  };

  const patchOptions = (patch: Partial<BuildOptions>) =>
    setOptions((prev) => ({ ...prev, ...patch }));

  const link = analysis?.link;

  return (
    <div className="relative z-10 min-h-screen">
      <div className="mx-auto w-full max-w-[1440px] px-3 pb-28 sm:px-5 lg:px-8 lg:pb-14">
        <Header onInspect={() => setDecodeOpen(true)} />
        <Hero />

        {dbError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-[12px] font-medium text-red-200">Airport database failed to load</p>
              <p className="text-[10.5px] text-red-200/60">{dbError}</p>
            </div>
          </div>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_436px]">
          <div className="space-y-4">
            <PastePanel
              text={text}
              onTextChange={setText}
              stats={stats}
              yearOverride={yearOverride}
              onYearOverride={setYearOverride}
              threshold={threshold}
              onThreshold={setThreshold}
            />

            {analysis ? (
              <ItineraryPanel
                plan={analysis.plan}
                hasManualSlices={hasManualSlices}
                onPatch={patchSegment}
                onRemove={removeSegment}
                onMove={moveSegment}
                onAdd={addSegment}
                onResetSlices={resetSlices}
              />
            ) : (
              <LoadingCard lines={3} />
            )}

            {analysis && <ChecksPanel issues={analysis.issues} segments={segments} />}
          </div>

          <aside className="space-y-4">
            {analysis && link ? (
              <>
                <LinkPanel analysis={analysis} options={options} onOptionsChange={patchOptions} />
                <Inspector link={link} />
              </>
            ) : (
              <LoadingCard lines={5} />
            )}
          </aside>
        </div>

        <HowItWorks />

        <footer className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 pt-4 text-[10.5px] text-faint">
          <span className="font-medium text-muted">El 3asool Scoop</span>
          <span className="text-faint/50">·</span>
          <span>Built for travel agents who sell AA-marketed itineraries.</span>
          <span className="ml-auto flex items-center gap-2">
            <span dir="rtl" className="text-faint/70">
              العسول سكوب
            </span>
            <span className="text-faint/40">|</span>
            <span>Not affiliated with American Airlines. Everything runs in your browser.</span>
          </span>
        </footer>
      </div>

      {analysis?.canBuild && link && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 px-3 py-2 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
            >
              Open on aa.com
            </Button>
            <CopyButton value={link.url} disabled={!analysis.canBuild} />
          </div>
        </div>
      )}

      <DecodeModal
        open={decodeOpen}
        initial={link?.url ?? ''}
        onClose={() => setDecodeOpen(false)}
      />
    </div>
  );
}

function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card className="p-4">
      <div className="mb-3 h-3 w-32 rounded bg-panel-3" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-8 rounded-lg bg-panel-2">
            <div className="h-full w-full rounded-lg shimmer" />
          </div>
        ))}
      </div>
    </Card>
  );
}
