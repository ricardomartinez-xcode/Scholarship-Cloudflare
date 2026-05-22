import { describe, expect, it } from "vitest";

import { normalizeOfferDraftSnapshot } from "@/lib/offer-draft-snapshot";

describe("normalizeOfferDraftSnapshot", () => {
  it("derives cycles and visible cycles from offerings for legacy snapshots", () => {
    const normalized = normalizeOfferDraftSnapshot({
      campuses: [],
      programs: [],
      offerings: [
        {
          id: "off-1",
          campusId: "camp-1",
          programId: "prog-1",
          cycle: "C2",
          track: null,
          delivery: "ONLINE",
          escolarizado: false,
          ejecutivo: false,
          escolarizadoSchedule: null,
          ejecutivoSchedule: null,
          lineOfBusiness: null,
          isActive: true,
          archivedReason: null,
          updatedBy: null,
        },
      ],
    });

    expect(normalized.cycles).toEqual(["C2"]);
    expect(normalized.visibleCycles).toEqual(["C2"]);
  });

  it("keeps a safe default when a legacy snapshot has no cycle metadata at all", () => {
    const normalized = normalizeOfferDraftSnapshot({
      campuses: [],
      programs: [],
      offerings: [],
    });

    expect(normalized.cycles).toEqual([]);
    expect(normalized.visibleCycles).toEqual(["C1"]);
  });
});
