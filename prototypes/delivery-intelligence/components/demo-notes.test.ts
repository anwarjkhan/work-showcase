import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every explanatory demo note must sit inside a <DemoNote>, so the labels toggle
 * can hide it. Add a phrase here when a new note is written. Case-sensitive on
 * purpose: the same words in a section description or register row are content.
 */
const NOTE_PHRASES = [
  'Nothing is executed.',
  'no model is called',
  'not official gates',
  'not presented as official gates',
  'Scripted agent, no live model',
  'Every slide is printed with',
  'Placeholder figures, not measured',
  'illustrative for the prototype',
  'Provider: scripted, no external call',
  'not a language model. A named human',
  'The portfolio-system status is not changed by this view.',
  'Arrow keys move, Right and Left open and close',
  'terms.app.demoNotice}.',
];

const root = path.resolve(__dirname);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith('.tsx') && !full.endsWith('.test.tsx') ? [full] : [];
  });
}

/** [start, end) ranges of every <DemoNote ...>...</DemoNote> in the source. */
function demoNoteRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const open = /<DemoNote\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    const close = src.indexOf('</DemoNote>', m.index);
    if (close !== -1) ranges.push([m.index, close]);
  }
  return ranges;
}

describe('demo notes', () => {
  it('keeps every known demo-note phrase inside a DemoNote', () => {
    const offenders: string[] = [];
    let found = 0;
    for (const file of tsxFiles(root)) {
      const src = readFileSync(file, 'utf8');
      const ranges = demoNoteRanges(src);
      for (const phrase of NOTE_PHRASES) {
        let at = src.indexOf(phrase);
        while (at !== -1) {
          found += 1;
          if (!ranges.some(([a, b]) => at >= a && at < b)) offenders.push(`${path.relative(root, file)}: "${phrase}"`);
          at = src.indexOf(phrase, at + 1);
        }
      }
    }
    expect(found, 'the phrase list should match real notes').toBeGreaterThanOrEqual(NOTE_PHRASES.length - 1);
    expect(offenders).toEqual([]);
  });

  it('every phrase in the list still exists somewhere (keeps the list honest)', () => {
    const all = tsxFiles(root).map((f) => readFileSync(f, 'utf8')).join('\n');
    const missing = NOTE_PHRASES.filter((p) => !all.includes(p));
    expect(missing).toEqual([]);
  });
});
