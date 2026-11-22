/**
 * One builder per slide kind. Each returns one SlideSpec (more only when a
 * builder must split content); pagination and text fitting happen afterwards
 * in compose/paginate.ts.
 */
import type { SlideKind } from '../../types';
import type { SlideBuilder } from '../kit';
import { contents, cover, decisions, howToRead, recordIndex } from './common';
import { tdFindings, tdOutcomes, tdPlan, tdReadiness, tdVerdict } from './deliverable';
import { tdJiraMap, tdPdlc, tdPod, tdRaid, tdStatus } from './deliverable-more';
import { nodeDeliverables, nodeDisagreements, nodeOverview, nodePlan, nodeRisks } from './node';
import { outcomeCriteria, outcomeEvidence, outcomeSummary, outcomeWork } from './outcome';
import { portfolioDisagreements, portfolioHeadline, portfolioProgrammes, portfolioRag, portfolioStages } from './portfolio';
import { portfolioBrief, portfolioFindings, portfolioHubs, portfolioQuarter } from './portfolio-more';

export const BUILDERS: Readonly<Record<SlideKind, SlideBuilder>> = {
  cover,
  contents,
  'how-to-read': howToRead,
  decisions,
  'record-index': recordIndex,
  'portfolio-headline': portfolioHeadline,
  'portfolio-rag': portfolioRag,
  'portfolio-disagreements': portfolioDisagreements,
  'portfolio-programmes': portfolioProgrammes,
  'portfolio-stages': portfolioStages,
  'portfolio-findings': portfolioFindings,
  'portfolio-quarter': portfolioQuarter,
  'portfolio-hubs': portfolioHubs,
  'portfolio-brief': portfolioBrief,
  'node-overview': nodeOverview,
  'node-deliverables': nodeDeliverables,
  'node-plan': nodePlan,
  'node-risks': nodeRisks,
  'node-disagreements': nodeDisagreements,
  'td-verdict': tdVerdict,
  'td-readiness': tdReadiness,
  'td-outcomes': tdOutcomes,
  'td-findings': tdFindings,
  'td-plan': tdPlan,
  'td-raid': tdRaid,
  'td-pdlc': tdPdlc,
  'td-pod': tdPod,
  'td-jira-map': tdJiraMap,
  'td-status': tdStatus,
  'outcome-summary': outcomeSummary,
  'outcome-criteria': outcomeCriteria,
  'outcome-work': outcomeWork,
  'outcome-evidence': outcomeEvidence,
};
