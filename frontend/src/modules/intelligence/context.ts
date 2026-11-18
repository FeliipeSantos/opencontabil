import { createContext, useContext } from 'react';

import type { Publication, Source, Subject } from '@/modules/intelligence/types';

export interface IntelligenceContextValue {
  sources: Source[];
  subjects: Subject[];
  sourceName: (id: string) => string;
  subjectName: (id: string) => string;
  /** Reloads sources and subjects (after saving settings or a collection). */
  reloadCatalog: () => Promise<void>;
  /** Changes whenever the open view must reload (a collection finished). */
  refreshKey: number;
  /**
   * Opens the detail panel and marks the publication (and `related`, the same act from other
   * sources) as read; onChange receives each publication whose favorite or read state changes.
   */
  openDetail: (publication: Publication, onChange?: (publication: Publication) => void, related?: Publication[]) => void;
}

export const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

export function useIntelligence(): IntelligenceContextValue {
  const context = useContext(IntelligenceContext);
  if (!context) throw new Error('useIntelligence must be used inside IntelligencePage');
  return context;
}
