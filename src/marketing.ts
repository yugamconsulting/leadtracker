// src/types/marketing.ts
export type MarketingProof = {
  revisions: string;
  hours: string;
  releaseCadence: string;
  updatedOn: string;
};
export type MarketingRoadmap = {
  inProgress: string[];
  next: string[];
  planned: string[];
};
export type MarketingChangelogItem = {
  title: string;
  detail: string;
};
export type MarketingContent = {
  proof: MarketingProof;
  changelog: MarketingChangelogItem[];
  roadmap: MarketingRoadmap;
};
