/**
 * The guided demo script: the eleven steps of DESIGN.md section 3 as typed data.
 *
 * Text may contain tokens that are filled from the data when it is shown, so the
 * presenter reads the real reference and title of each story deliverable:
 *   {heroRef} {heroTitle}  the main storyline deliverable
 *   {flowRef} {flowTitle}  the deliverable used for the workflow walk-through
 * Use `resolveDemoStep` (or `fillDemoTokens`) to get display text.
 *
 * Durations are indicative, in seconds; they add up to about eight minutes.
 */
import { hrefs } from './routes';
import { HERO_DELIVERABLE_ID, WORKFLOW_DELIVERABLE_ID } from './story';

export interface DemoStep {
  /** 1-based step number, as in DESIGN.md section 3. */
  n: number;
  title: string;
  /** Short name of the screen, for the step list. */
  screen: string;
  /** Route, with a hash where the screen supports one. Relative, no trailing slash needed. */
  route: string;
  /** One sentence for the presenter to say aloud. */
  point: string;
  /** Two or three short prompts: what to do on this screen. */
  prompts: readonly string[];
  /** Indicative time on this step, in seconds. */
  seconds: number;
}

export const DEMO_STEPS: readonly DemoStep[] = [
  {
    n: 1,
    title: 'The whole book at a glance',
    screen: 'Portfolio',
    route: '/',
    point: 'Every number here is computed from the underlying records, and in several places the reported status and the evidence disagree.',
    prompts: ['Point at the reported against evidence-based status chart.', 'Open the status disagreements list.', 'Note the three measures are shown separately.'],
    seconds: 35,
  },
  {
    n: 2,
    title: 'How the simplified model works',
    screen: 'Hierarchy',
    route: '/hierarchy',
    point: 'The portfolio system owns everything down to Outcome; Jira owns the work below it, and one deliverable can have several Epics.',
    prompts: ['Show the book-of-record boundary band.', 'Expand {heroRef} to show its three Epics.', 'Point out the standalone route for low-risk work.'],
    seconds: 35,
  },
  {
    n: 3,
    title: 'One deliverable, three measures',
    screen: 'Deliverable detail',
    route: `/deliverables/${HERO_DELIVERABLE_ID}`,
    point: '{heroRef}, {heroTitle}, is reported Green with 82% of the work done, yet only 1 of 4 outcomes is accepted and it is not ready to release.',
    prompts: ['Read the reported and evidence-based status side by side.', 'Open "why the evidence says" and the reasons behind readiness.', 'Show that each reason links to a record.'],
    seconds: 55,
  },
  {
    n: 4,
    title: 'The late dependency crosses hubs',
    screen: 'Global',
    route: '/global#hero',
    point: 'The market-data dependency for {heroRef} comes from a hub on another continent and is nine days late.',
    prompts: ['Read the callout about the nine-day delay.', 'Select a hub to see its pods and deliverables.', 'Switch to the list view for the same facts without the map.'],
    seconds: 40,
  },
  {
    n: 5,
    title: 'The knock-on effect on the quarter',
    screen: 'Plan',
    route: '/plan',
    point: 'The late dependency pushes the forecast for {heroRef} past what the quarter has committed to.',
    prompts: ['Find {heroRef} and its forecast against plan.', 'Switch between the quarter, month and sprint zooms.', 'Open the deliverable from its bar.'],
    seconds: 35,
  },
  {
    n: 6,
    title: 'The five lifecycle stages',
    screen: 'Lifecycle',
    route: '/lifecycle',
    point: 'The same portfolio sits across five lifecycle stages, with an agent assist and a named human review at each one.',
    prompts: ['Run along the five stage columns and the two-way connectors.', 'Point at the agents listed for a stage.', 'Open {flowRef} to walk it through.'],
    seconds: 35,
  },
  {
    n: 7,
    title: 'Walk one deliverable through the stages',
    screen: 'PDLC workflow',
    route: `/lifecycle/${WORKFLOW_DELIVERABLE_ID}`,
    point: '{flowRef}, {flowTitle}, moves forward only when a named person approves each review, and a failed test sends it back.',
    prompts: ['Follow the highlighted next step, starting with the stage agent.', 'Approve the review, then simulate a failing test result.', 'Take the move-back offer, then rerun until readiness shows Ready.'],
    seconds: 75,
  },
  {
    n: 8,
    title: 'Run an agent, approve its changes',
    screen: 'Agent centre',
    route: '/agents#run-raid-quality',
    point: 'The agent only proposes; a named person approves, and the findings count drops everywhere the moment they do.',
    prompts: ['Press Run for RAID quality across the portfolio.', 'Approve one proposal and read the effect strip.', 'Try approving as the item’s assignee to show the refusal.'],
    seconds: 75,
  },
  {
    n: 9,
    title: 'A status report where every sentence is cited',
    screen: 'Deliverable detail',
    route: `/deliverables/${HERO_DELIVERABLE_ID}#status`,
    point: 'The weekly status for {heroRef} is drafted from the records, and every sentence carries a citation you can open.',
    prompts: ['Press Draft weekly status.', 'Open one citation marker to show the cited record.', 'Say that nothing is sent without a human reading it.'],
    seconds: 30,
  },
  {
    n: 10,
    title: 'We own the templates',
    screen: 'Blueprint',
    route: '/blueprint',
    point: 'This is the target template that makes the model repeatable: a Deliverable ID on every Epic and an Outcome ID on every story.',
    prompts: ['Compare the current templates with the target.', 'Show the new fields and the many-Epics-to-one-deliverable pattern.'],
    seconds: 25,
  },
  {
    n: 11,
    title: 'What we would measure, and the ask',
    screen: 'Pilot evidence',
    route: '/evidence',
    point: 'We would measure effort, exceptions and draft acceptance against a baseline, and we are asking for authority to run the pilot.',
    prompts: ['Note every figure is a placeholder until measured.', 'State the ask.'],
    seconds: 40,
  },
];

export const DEMO_TOTAL_SECONDS = DEMO_STEPS.reduce((sum, s) => sum + s.seconds, 0);

/** Values for the text tokens. */
export interface DemoTokens {
  heroRef: string;
  heroTitle: string;
  flowRef: string;
  flowTitle: string;
}

export function fillDemoTokens(text: string, tokens: DemoTokens): string {
  return text.replace(/\{(heroRef|heroTitle|flowRef|flowTitle)\}/g, (_, key: keyof DemoTokens) => tokens[key]);
}

export interface ResolvedDemoStep extends Omit<DemoStep, 'point' | 'prompts'> {
  point: string;
  prompts: readonly string[];
  /** Route with a trailing slash before the hash, as the static export serves it. */
  href: string;
}

/** Splits a script route into a path with trailing slash and an optional hash. */
export function demoHref(route: string): string {
  const [path, hash] = route.split('#');
  const base = !path || path === '/' ? '/' : path.replace(/\/+$/, '') + '/';
  return hash ? `${base}#${hash}` : base;
}

export function resolveDemoStep(step: DemoStep, tokens: DemoTokens): ResolvedDemoStep {
  return {
    ...step,
    point: fillDemoTokens(step.point, tokens),
    prompts: step.prompts.map((p) => fillDemoTokens(p, tokens)),
    href: demoHref(step.route),
  };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Keeps the story links in one place for tests and documentation. */
export const DEMO_STORY_LINKS = {
  hero: hrefs.deliverable(HERO_DELIVERABLE_ID),
  workflow: hrefs.workflow(WORKFLOW_DELIVERABLE_ID),
};
