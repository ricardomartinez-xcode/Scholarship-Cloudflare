import {
  resolveScholarshipQuote,
  type ScholarshipQuoteInput,
} from "@/lib/scholarship-quote-service";
import type { CanonicalQuoteRequest } from "@relead/domain/calculator/types";

export interface QuoteRepository {
  resolveCanonicalQuote(input: CanonicalQuoteRequest): ReturnType<typeof resolveScholarshipQuote>;
}

export const prismaQuoteRepository: QuoteRepository = {
  resolveCanonicalQuote(input) {
    return resolveScholarshipQuote(input as ScholarshipQuoteInput);
  },
};
