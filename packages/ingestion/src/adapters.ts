import type { NormalizedBlogPostInput } from '@virtual-mandi/shared';

export type AdapterInput = Omit<NormalizedBlogPostInput, 'initialStatus'> & {
  initialStatus?: 'DRAFT';
};

export interface ContentIngestionAdapter {
  readonly source: NormalizedBlogPostInput['source'];
  collect(): AsyncIterable<unknown>;
}

export interface WebsiteIngestionAdapter extends ContentIngestionAdapter {
  readonly source: 'WEBSITE';
}

export interface WhatsAppIngestionAdapter extends ContentIngestionAdapter {
  readonly source: 'WHATSAPP';
}

export class FixtureBlogPostAdapter implements WebsiteIngestionAdapter {
  readonly source = 'WEBSITE' as const;

  constructor(private readonly fixture: AdapterInput) {}

  async *collect(): AsyncIterable<unknown> {
    yield { ...this.fixture, source: this.source, initialStatus: 'DRAFT' };
  }
}
