import { validateCanonicalQuoteRequest } from "@relead/domain/calculator/schemas";
import type { QuoteRepository } from "@relead/domain/calculator/quote-repository";
import type { CanonicalQuoteRequest } from "@relead/domain/calculator/types";

async function getDefaultRepository(): Promise<QuoteRepository> {
  const { prismaQuoteRepository } = await import("@relead/domain/calculator/quote-repository");
  return prismaQuoteRepository;
}

export async function resolveCanonicalQuote(input: CanonicalQuoteRequest, repo?: QuoteRepository) {
  validateCanonicalQuoteRequest(input);
  const activeRepo = repo ?? (await getDefaultRepository());
  return activeRepo.resolveCanonicalQuote(input);
}
