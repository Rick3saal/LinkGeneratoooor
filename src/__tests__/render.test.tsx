import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChecksPanel } from '../components/ChecksPanel';
import { Inspector } from '../components/Inspector';
import { ItineraryPanel } from '../components/ItineraryPanel';
import { LinkPanel } from '../components/LinkPanel';
import { analyze } from '../lib/analyze';
import { parseItinerary } from '../lib/parse';
import { EX1, EX2, EX3, NOW, lookup, options } from './fixtures';

function build(text: string) {
  const parsed = parseItinerary(text, { now: NOW });
  const analysis = analyze(parsed.segments, options, {
    lookup,
    thresholdHours: 24,
    parseIssues: parsed.issues,
    now: NOW,
  });
  return { parsed, analysis };
}

describe('analysis over the real examples', () => {
  it('is buildable with nothing worse than info', () => {
    for (const example of [EX1, EX2, EX3]) {
      const { analysis } = build(example.text);
      expect(analysis.canBuild).toBe(true);
      expect(analysis.counts.error).toBe(0);
      expect(analysis.link.url).toBe(example.url);
    }
  });

  it('flags a mixed cabin without blocking', () => {
    const text = `1 AA 100 J 01DEC JFK LHR 0700 1900 CABIN-BUSINESS
2 AA 101 Y 08DEC LHR JFK 1100 1400 CABIN-ECONOMY`;
    const { analysis } = build(text);
    expect(analysis.canBuild).toBe(true);
    expect(analysis.plan.mixedCabin).toBe(true);
    expect(analysis.issues.map((i) => i.code)).toContain('mixed-cabin');
  });
});

describe('components render', () => {
  it('renders the itinerary, checks, link and inspector', () => {
    const { parsed, analysis } = build(EX2.text);
    const noop = () => undefined;

    const html = renderToStaticMarkup(
      <>
        <ItineraryPanel
          plan={analysis.plan}
          hasManualSlices={false}
          onPatch={noop}
          onRemove={noop}
          onMove={noop}
          onAdd={noop}
          onResetSlices={noop}
        />
        <ChecksPanel issues={analysis.issues} segments={parsed.segments} />
        <LinkPanel
          analysis={analysis}
          options={options}
          onOptionsChange={noop}
        />
        <Inspector link={analysis.link} />
      </>,
    );

    expect(html).toContain('The itinerary');
    expect(html).toContain('Open on aa.com');
    expect(html).toContain('Inside the link');
    expect(html).toContain('JFK');
  });

  it('renders an empty itinerary without crashing', () => {
    const { analysis } = build('');
    const noop = () => undefined;
    const html = renderToStaticMarkup(
      <ItineraryPanel
        plan={analysis.plan}
        hasManualSlices={false}
        onPatch={noop}
        onRemove={noop}
        onMove={noop}
        onAdd={noop}
        onResetSlices={noop}
      />,
    );
    expect(html).toContain('No segments yet');
  });
});
