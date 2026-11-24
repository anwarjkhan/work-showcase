/**
 * Reference data: hubs, people, pods, agent identities and sprints.
 * All people are fictional. Names are drawn from regional pools by the seeded
 * stream, except for a small hand-written cast the story is pinned to.
 */
import { PRESENTER_PERSON_ID } from '@/lib/config/story';
import type { AgentId, AgentIdentity, Hub, Person, PersonRole, Pod, ReviewRoleId, Sprint } from '@/lib/types';
import { addDays, SPRINT_COUNT, SPRINT_START, sprintIdForIndex } from './dates';
import type { Rng } from './random';

export type ProgrammeKey = 'ccr' | 'frtb' | 'ledger' | 'data' | 'stress' | 'limits';

// ---------------------------------------------------------------------------
// Hubs: 18 delivery hubs on six continents
// ---------------------------------------------------------------------------

export const HUBS: Hub[] = [
  { id: 'hub-ldn', name: 'London', city: 'London', country: 'United Kingdom', continent: 'europe', latitude: 51.5072, longitude: -0.1276, timeZone: 'Europe/London' },
  { id: 'hub-fra', name: 'Frankfurt', city: 'Frankfurt', country: 'Germany', continent: 'europe', latitude: 50.1109, longitude: 8.6821, timeZone: 'Europe/Berlin' },
  { id: 'hub-war', name: 'Warsaw', city: 'Warsaw', country: 'Poland', continent: 'europe', latitude: 52.2297, longitude: 21.0122, timeZone: 'Europe/Warsaw' },
  { id: 'hub-dub', name: 'Dublin', city: 'Dublin', country: 'Ireland', continent: 'europe', latitude: 53.3498, longitude: -6.2603, timeZone: 'Europe/Dublin' },
  { id: 'hub-nyc', name: 'New York', city: 'New York', country: 'United States', continent: 'north-america', latitude: 40.7128, longitude: -74.006, timeZone: 'America/New_York' },
  { id: 'hub-tor', name: 'Toronto', city: 'Toronto', country: 'Canada', continent: 'north-america', latitude: 43.6532, longitude: -79.3832, timeZone: 'America/Toronto' },
  { id: 'hub-chi', name: 'Chicago', city: 'Chicago', country: 'United States', continent: 'north-america', latitude: 41.8781, longitude: -87.6298, timeZone: 'America/Chicago' },
  { id: 'hub-sao', name: 'São Paulo', city: 'São Paulo', country: 'Brazil', continent: 'south-america', latitude: -23.5505, longitude: -46.6333, timeZone: 'America/Sao_Paulo' },
  { id: 'hub-bog', name: 'Bogotá', city: 'Bogotá', country: 'Colombia', continent: 'south-america', latitude: 4.711, longitude: -74.0721, timeZone: 'America/Bogota' },
  { id: 'hub-sgp', name: 'Singapore', city: 'Singapore', country: 'Singapore', continent: 'asia', latitude: 1.3521, longitude: 103.8198, timeZone: 'Asia/Singapore' },
  { id: 'hub-mum', name: 'Mumbai', city: 'Mumbai', country: 'India', continent: 'asia', latitude: 19.076, longitude: 72.8777, timeZone: 'Asia/Kolkata' },
  { id: 'hub-blr', name: 'Bengaluru', city: 'Bengaluru', country: 'India', continent: 'asia', latitude: 12.9716, longitude: 77.5946, timeZone: 'Asia/Kolkata' },
  { id: 'hub-hkg', name: 'Hong Kong', city: 'Hong Kong', country: 'Hong Kong', continent: 'asia', latitude: 22.3193, longitude: 114.1694, timeZone: 'Asia/Hong_Kong' },
  { id: 'hub-tyo', name: 'Tokyo', city: 'Tokyo', country: 'Japan', continent: 'asia', latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' },
  { id: 'hub-jnb', name: 'Johannesburg', city: 'Johannesburg', country: 'South Africa', continent: 'africa', latitude: -26.2041, longitude: 28.0473, timeZone: 'Africa/Johannesburg' },
  { id: 'hub-nbo', name: 'Nairobi', city: 'Nairobi', country: 'Kenya', continent: 'africa', latitude: -1.2921, longitude: 36.8219, timeZone: 'Africa/Nairobi' },
  { id: 'hub-syd', name: 'Sydney', city: 'Sydney', country: 'Australia', continent: 'oceania', latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' },
  { id: 'hub-mel', name: 'Melbourne', city: 'Melbourne', country: 'Australia', continent: 'oceania', latitude: -37.8136, longitude: 144.9631, timeZone: 'Australia/Melbourne' },
];

// ---------------------------------------------------------------------------
// Name pools (fictional combinations)
// ---------------------------------------------------------------------------

type Region = 'west-europe' | 'north-america' | 'south-america' | 'south-asia' | 'east-asia' | 'africa' | 'oceania';

const HUB_REGION: Record<string, Region> = {
  'hub-ldn': 'west-europe', 'hub-fra': 'west-europe', 'hub-war': 'west-europe', 'hub-dub': 'west-europe',
  'hub-nyc': 'north-america', 'hub-tor': 'north-america', 'hub-chi': 'north-america',
  'hub-sao': 'south-america', 'hub-bog': 'south-america',
  'hub-mum': 'south-asia', 'hub-blr': 'south-asia',
  'hub-sgp': 'east-asia', 'hub-hkg': 'east-asia', 'hub-tyo': 'east-asia',
  'hub-jnb': 'africa', 'hub-nbo': 'africa',
  'hub-syd': 'oceania', 'hub-mel': 'oceania',
};

const NAME_POOLS: Record<Region, { first: string[]; last: string[] }> = {
  'west-europe': {
    first: ['Lena', 'Matthias', 'Sofia', 'Henrik', 'Aoife', 'Ciaran', 'Katarzyna', 'Piotr', 'Jonas', 'Elodie', 'Tomasz', 'Greta', 'Niall', 'Marta', 'Anselm', 'Ines', 'Dominik', 'Saoirse', 'Pieter', 'Harriet', 'Callum', 'Imogen', 'Rhys', 'Fiona'],
    last: ['Brandt', 'Kowalczyk', 'Lindqvist', 'Fairbairn', 'Moriarty', 'Haverkamp', 'Nowak', 'Delacroix', 'Reinholt', 'Zielinski', 'Ashcroft', 'Brennan', 'Hartmann', 'Sorensen', 'Whitlock', 'Marchetti', 'Eklund', 'Llewellyn', 'Pemberton', 'Hargreaves', 'Fairweather', 'Cartwright', 'Vandermeer', 'Quinlan'],
  },
  'north-america': {
    first: ['Marcus', 'Tessa', 'Dwayne', 'Camille', 'Devon', 'Rosalind', 'Ethan', 'Naomi', 'Luca', 'Gabriela', 'Wyatt', 'Imani', 'Theo', 'Simone', 'Caleb', 'Odette', 'Malik', 'Harper', 'Delia', 'Winston', 'Marisol', 'Graham', 'Noelle', 'Jasper'],
    last: ['Okafor', 'Tran', 'Castellano', 'Beaumont', 'Whitaker', 'Abernathy', 'Delgado', 'Fontaine', 'Kowal', 'Sinclair', 'Prescott', 'Alvarado', 'Hollis', 'Bellamy', 'Quigley', 'Rahman', 'Thibault', 'Ostrander', 'Mercado', 'Lindgren', 'Baptiste', 'Hargrove', 'Yoon', 'Pellegrino'],
  },
  'south-america': {
    first: ['Thiago', 'Valentina', 'Mateus', 'Camila', 'Santiago', 'Luciana', 'Rodrigo', 'Mariana', 'Andrés', 'Isabela', 'Joaquín', 'Renata', 'Fabiola', 'Emilio', 'Daniela', 'Gustavo'],
    last: ['Almeida', 'Quintero', 'Barbosa', 'Cardona', 'Figueiredo', 'Montenegro', 'Salazar', 'Pereira', 'Villanueva', 'Cordeiro', 'Restrepo', 'Albuquerque', 'Arango', 'Teixeira', 'Valencia', 'Nascimento'],
  },
  'south-asia': {
    first: ['Aarav', 'Ananya', 'Vikram', 'Meera', 'Rohan', 'Kavya', 'Siddharth', 'Nisha', 'Arjun', 'Pooja', 'Karthik', 'Divya', 'Imran', 'Shreya', 'Rahul', 'Lakshmi', 'Farhan', 'Tanvi', 'Naveen', 'Ishita'],
    last: ['Iyer', 'Menon', 'Kapoor', 'Deshpande', 'Rao', 'Banerjee', 'Chaudhary', 'Nair', 'Joshi', 'Venkatesan', 'Khanna', 'Mukherjee', 'Pillai', 'Sethi', 'Gokhale', 'Bhatt', 'Ansari', 'Reddy', 'Krishnan', 'Malhotra'],
  },
  'east-asia': {
    first: ['Wei Jie', 'Mei Ling', 'Haruto', 'Yuki', 'Kenji', 'Sakura', 'Jia Hui', 'Chi Ming', 'Hana', 'Daiki', 'Priscilla', 'Farid', 'Siti', 'Ravi', 'Li Na', 'Takumi', 'Xin Yi', 'Hiroshi', 'Aisha', 'Jun Hao'],
    last: ['Tan', 'Lim', 'Wong', 'Chan', 'Nakagawa', 'Hayashi', 'Ng', 'Yamamoto', 'Cheung', 'Ong', 'Koh', 'Matsuda', 'Lau', 'Ishikawa', 'Teo', 'Fujimoto', 'Abdullah', 'Pang', 'Sato', 'Goh'],
  },
  africa: {
    first: ['Thabo', 'Naledi', 'Amara', 'Kwame', 'Zanele', 'Chidi', 'Wanjiru', 'Sipho', 'Folake', 'Tendai', 'Nandi', 'Baraka', 'Lindiwe', 'Kofi', 'Achieng', 'Jabu'],
    last: ['Dlamini', 'Okoye', 'Mwangi', 'Nkosi', 'Adeyemi', 'Kamau', 'Mokoena', 'Otieno', 'Botha', 'Mensah', 'Ndlovu', 'Achebe', 'Wambui', 'Khumalo', 'Owusu', 'van der Merwe'],
  },
  oceania: {
    first: ['Lachlan', 'Matilda', 'Mitchell', 'Zara', 'Hamish', 'Isla', 'Tane', 'Aroha', 'Jarrah', 'Keira', 'Angus', 'Briony', 'Ruairi', 'Marlee', 'Cooper', 'Freya'],
    last: ['Thorne', 'McAllister', 'Nguyen', 'Rawlings', 'Papadopoulos', 'Whitfield', 'Harrington', 'Te Rangi', 'Sutherland', 'Kovacs', 'Redmond', 'Prowse', 'Tomkins', 'Haddad', 'Barnett', 'Lockyer'],
  },
};

// ---------------------------------------------------------------------------
// Pods
// ---------------------------------------------------------------------------

interface PodSpec {
  id: string;
  name: string;
  hubId: string;
  focus: string;
  /** Hubs whose two satellite people belong to this pod. */
  remoteHubs: string[];
}

export const POD_SPECS: PodSpec[] = [
  { id: 'pod-risk-ldn', name: 'Counterparty risk analytics', hubId: 'hub-ldn', focus: 'Exposure calculation and stress reconciliation for counterparty credit risk', remoteHubs: [] },
  { id: 'pod-xva-nyc', name: 'Exposure and collateral', hubId: 'hub-nyc', focus: 'Collateral, margin calls and valuation adjustment sensitivities', remoteHubs: ['hub-chi', 'hub-bog'] },
  { id: 'pod-frtb-fra', name: 'FRTB capital engine', hubId: 'hub-fra', focus: 'Standardised approach and default risk capital calculation', remoteHubs: [] },
  { id: 'pod-ledger-dub', name: 'Ledger services', hubId: 'hub-dub', focus: 'General ledger, subledger posting and period-end close', remoteHubs: [] },
  { id: 'pod-data-sgp', name: 'Market data services', hubId: 'hub-sgp', focus: 'Market and reference data publication', remoteHubs: [] },
  { id: 'pod-plat-mum', name: 'Data platform engineering', hubId: 'hub-mum', focus: 'Ingestion, quality rules and streaming on the shared data platform', remoteHubs: [] },
  { id: 'pod-qa-blr', name: 'Test automation and validation', hubId: 'hub-blr', focus: 'Automated testing, independent validation and eligibility testing', remoteHubs: [] },
  { id: 'pod-ctrl-war', name: 'Controls and regulatory reporting', hubId: 'hub-war', focus: 'Control evidence, reporting packs and netting data', remoteHubs: [] },
  { id: 'pod-stress-tor', name: 'Stress testing models', hubId: 'hub-tor', focus: 'Scenario libraries, stress runs and reverse stress testing', remoteHubs: ['hub-sao'] },
  { id: 'pod-pricing-hkg', name: 'Price verification', hubId: 'hub-hkg', focus: 'Independent price verification and valuation controls', remoteHubs: ['hub-tyo'] },
  { id: 'pod-ref-jnb', name: 'Reference data', hubId: 'hub-jnb', focus: 'Legal entity and instrument reference data', remoteHubs: ['hub-nbo'] },
  { id: 'pod-ux-syd', name: 'Desk tooling', hubId: 'hub-syd', focus: 'Desk dashboards, exports and self-service tooling', remoteHubs: ['hub-mel'] },
];

/** Catalogue agents rotated across pods. Pod 1 (index 0) gets the status agent, so its identity is "ai-status-01". */
const AGENT_ROTATION: AgentId[] = [
  'status-reporting',
  'release-readiness',
  'outcome-mapping',
  'control-evidence-check',
  'raid-quality',
  'dependency-discovery',
  'requirements-structuring',
];

const AGENT_CODE: Record<AgentId, string> = {
  'requirements-structuring': 'reqs',
  'outcome-mapping': 'outmap',
  'control-evidence-check': 'ctrl',
  'release-readiness': 'rel',
  'raid-quality': 'raid',
  'dependency-discovery': 'dep',
  'status-reporting': 'status',
  'portfolio-reconciliation': 'recon',
  'executive-briefing': 'brief',
};

// ---------------------------------------------------------------------------
// Hand-written cast
// ---------------------------------------------------------------------------

interface FixedPerson {
  id: string;
  name: string;
  title: string;
  roles: PersonRole[];
  hubId: string;
}

const FIXED_PEOPLE: FixedPerson[] = [
  { id: PRESENTER_PERSON_ID, name: 'Anwar Khan', title: 'Head of delivery (presenter)', roles: ['delivery-lead', 'business-owner', 'requirements-owner', 'design-reviewer', 'release-owner', 'control-owner', 'independent-validator', 'investment-owner'], hubId: 'hub-ldn' },
  { id: 'p-owner-1', name: 'Priya Raman', title: 'Programme lead, counterparty credit risk', roles: ['programme-lead', 'investment-owner'], hubId: 'hub-ldn' },
  { id: 'p-owner-2', name: 'Henrik Lindqvist', title: 'Programme lead, FRTB', roles: ['programme-lead', 'investment-owner'], hubId: 'hub-fra' },
  { id: 'p-owner-3', name: 'Aoife Brennan', title: 'Programme lead, finance ledger', roles: ['programme-lead', 'investment-owner'], hubId: 'hub-dub' },
  { id: 'p-owner-4', name: 'Jia Hui Koh', title: 'Programme lead, shared data platform', roles: ['programme-lead', 'investment-owner'], hubId: 'hub-sgp' },
  { id: 'p-owner-5', name: 'Camille Fontaine', title: 'Head of stress testing tooling', roles: ['investment-owner', 'business-owner'], hubId: 'hub-tor' },
  { id: 'p-ctl-1', name: 'Jordan Ellis', title: 'Control owner', roles: ['control-owner', 'risk-manager'], hubId: 'hub-nyc' },
  { id: 'p-val-1', name: 'Mei Lin Tan', title: 'Independent validator', roles: ['independent-validator'], hubId: 'hub-sgp' },
];

interface PoolSeat {
  id: string;
  hubId: string;
  title: string;
  roles: PersonRole[];
}

/** Role holders generated from the name pools; ids are stable, names are seeded. */
const POOL_SEATS: PoolSeat[] = [
  { id: 'p-req-1', hubId: 'hub-ldn', title: 'Requirements owner', roles: ['requirements-owner'] },
  { id: 'p-req-2', hubId: 'hub-fra', title: 'Requirements owner', roles: ['requirements-owner'] },
  { id: 'p-req-3', hubId: 'hub-sgp', title: 'Requirements owner', roles: ['requirements-owner', 'analyst'] },
  { id: 'p-dsg-1', hubId: 'hub-ldn', title: 'Design reviewer', roles: ['design-reviewer'] },
  { id: 'p-dsg-2', hubId: 'hub-dub', title: 'Design reviewer', roles: ['design-reviewer'] },
  { id: 'p-dsg-3', hubId: 'hub-mum', title: 'Design reviewer', roles: ['design-reviewer'] },
  { id: 'p-ctl-2', hubId: 'hub-war', title: 'Control owner', roles: ['control-owner'] },
  { id: 'p-ctl-3', hubId: 'hub-sgp', title: 'Control owner', roles: ['control-owner', 'risk-manager'] },
  { id: 'p-val-2', hubId: 'hub-blr', title: 'Independent validator', roles: ['independent-validator'] },
  { id: 'p-val-3', hubId: 'hub-ldn', title: 'Independent validator', roles: ['independent-validator'] },
  { id: 'p-biz-1', hubId: 'hub-ldn', title: 'Business owner, credit', roles: ['business-owner'] },
  { id: 'p-biz-2', hubId: 'hub-nyc', title: 'Business owner, collateral', roles: ['business-owner'] },
  { id: 'p-biz-3', hubId: 'hub-dub', title: 'Business owner, finance', roles: ['business-owner'] },
  { id: 'p-biz-4', hubId: 'hub-fra', title: 'Business owner, market risk', roles: ['business-owner'] },
  { id: 'p-rel-1', hubId: 'hub-ldn', title: 'Release owner', roles: ['release-owner'] },
  { id: 'p-rel-2', hubId: 'hub-mum', title: 'Release owner', roles: ['release-owner'] },
  { id: 'p-rel-3', hubId: 'hub-tor', title: 'Release owner', roles: ['release-owner'] },
  { id: 'p-risk-1', hubId: 'hub-fra', title: 'Risk manager', roles: ['risk-manager'] },
  { id: 'p-risk-2', hubId: 'hub-ldn', title: 'Risk manager', roles: ['risk-manager'] },
];

const LOCAL_TITLES: Array<{ title: string; roles: PersonRole[] }> = [
  { title: 'Senior engineer', roles: ['engineer'] },
  { title: 'Engineer', roles: ['engineer'] },
  { title: 'Data engineer', roles: ['engineer'] },
  { title: 'Test analyst', roles: ['analyst'] },
  { title: 'Business analyst', roles: ['analyst'] },
];

export interface Cast {
  presenterId: string;
  /** Programme lead (owner of the investment request) per programme. */
  owners: Record<ProgrammeKey, string>;
  /** Candidate holders per review role. */
  pools: Record<ReviewRoleId, string[]>;
}

export interface Reference {
  hubs: Hub[];
  people: Person[];
  pods: Pod[];
  agentIdentities: AgentIdentity[];
  sprints: Sprint[];
  cast: Cast;
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

export function buildReference(root: Rng): Reference {
  const rng = root.fork('reference');
  const used = new Set<string>(FIXED_PEOPLE.map((p) => p.name));

  const makeName = (hubId: string): string => {
    const pool = NAME_POOLS[HUB_REGION[hubId] ?? 'west-europe'];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const name = `${rng.pick(pool.first)} ${rng.pick(pool.last)}`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    throw new Error('Name pool exhausted');
  };

  const people: Person[] = [];
  for (const fixed of FIXED_PEOPLE) {
    people.push({ id: fixed.id, name: fixed.name, title: fixed.title, roles: fixed.roles, hubId: fixed.hubId, podId: null, initials: initialsOf(fixed.name) });
  }
  for (const seat of POOL_SEATS) {
    const name = makeName(seat.hubId);
    people.push({ id: seat.id, name, title: seat.title, roles: seat.roles, hubId: seat.hubId, podId: null, initials: initialsOf(name) });
  }

  const pods: Pod[] = [];
  const agentIdentities: AgentIdentity[] = [];

  POD_SPECS.forEach((spec, podIndex) => {
    const short = spec.id.slice(4);
    const memberIds: string[] = [];

    // Four local people: the first is the pod's delivery lead.
    for (let i = 1; i <= 4; i += 1) {
      const id = `p-${short}-${i}`;
      const name = makeName(spec.hubId);
      const seat = i === 1 ? { title: 'Delivery lead', roles: ['delivery-lead', 'engineer'] as PersonRole[] } : rng.pick(LOCAL_TITLES);
      people.push({ id, name, title: seat.title, roles: seat.roles, hubId: spec.hubId, podId: spec.id, initials: initialsOf(name) });
      memberIds.push(id);
    }
    // Two satellite people per remote hub, attached to this pod.
    for (const remoteHub of spec.remoteHubs) {
      for (let r = 1; r <= 2; r += 1) {
        const id = `p-${short}-${remoteHub.slice(4)}-${r}`;
        const name = makeName(remoteHub);
        const seat = rng.pick(LOCAL_TITLES);
        people.push({ id, name, title: seat.title, roles: seat.roles, hubId: remoteHub, podId: spec.id, initials: initialsOf(name) });
        memberIds.push(id);
      }
    }

    const agentIdentityIds: string[] = [];
    for (const rotation of [podIndex % AGENT_ROTATION.length, (podIndex + 3) % AGENT_ROTATION.length]) {
      const agentId = AGENT_ROTATION[rotation] as AgentId;
      const nn = String(podIndex + 1).padStart(2, '0');
      const id = `ai-${AGENT_CODE[agentId]}-${nn}`;
      agentIdentities.push({ id, agentId, handle: `agent-${AGENT_CODE[agentId]}-${nn}`, podId: spec.id, hubId: spec.hubId, accountableOwnerId: `p-${short}-1` });
      agentIdentityIds.push(id);
    }

    pods.push({ id: spec.id, name: spec.name, hubId: spec.hubId, focus: spec.focus, memberIds, agentIdentityIds, leadId: `p-${short}-1` });
  });

  const sprints: Sprint[] = Array.from({ length: SPRINT_COUNT }, (_, i) => ({
    id: sprintIdForIndex(i),
    name: `2027 S${String(i + 1).padStart(2, '0')}`,
    index: i + 1,
    start: addDays(SPRINT_START, i * 14),
    end: addDays(SPRINT_START, i * 14 + 13),
  }));

  const cast: Cast = {
    presenterId: PRESENTER_PERSON_ID,
    owners: { ccr: 'p-owner-1', frtb: 'p-owner-2', ledger: 'p-owner-3', data: 'p-owner-4', stress: 'p-owner-5', limits: PRESENTER_PERSON_ID },
    pools: {
      'requirements-owner': ['p-req-1', 'p-req-2', 'p-req-3'],
      'design-reviewer': ['p-dsg-1', 'p-dsg-2', 'p-dsg-3'],
      'control-owner': ['p-ctl-1', 'p-ctl-2', 'p-ctl-3'],
      'independent-validator': ['p-val-1', 'p-val-2', 'p-val-3'],
      'business-owner': ['p-biz-1', 'p-biz-2', 'p-biz-3', 'p-biz-4'],
      'release-owner': ['p-rel-1', 'p-rel-2', 'p-rel-3'],
    },
  };

  return { hubs: HUBS, people, pods, agentIdentities, sprints, cast };
}
