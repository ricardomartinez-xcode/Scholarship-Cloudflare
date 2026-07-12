import { AdminConfigModule } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getPublicRouteTagsForModule,
  PUBLIC_ROUTE_CACHE_TAGS,
} from "@/lib/public-route-cache";

describe("public route cache tags", () => {
  it("invalidates every quote catalog affected by an academic-offer import", () => {
    expect(getPublicRouteTagsForModule(AdminConfigModule.OFFER)).toEqual([
      PUBLIC_ROUTE_CACHE_TAGS.oferta,
      PUBLIC_ROUTE_CACHE_TAGS.planes,
      PUBLIC_ROUTE_CACHE_TAGS.formatos,
      PUBLIC_ROUTE_CACHE_TAGS.campuses,
    ]);
  });
});
