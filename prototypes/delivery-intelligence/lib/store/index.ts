// Public entry point of the store. Screens import from '@/lib/store'.
export * from './hooks';
export { DemoStoreProvider } from './provider';
export { createDemoStore, type AuditInput, type DemoStoreApi } from './store';
export { createDemoActions, type DemoActions, type RecordEvidenceInput } from './actions';
export { indexPortfolio, type PortfolioIndex } from './indexes';
