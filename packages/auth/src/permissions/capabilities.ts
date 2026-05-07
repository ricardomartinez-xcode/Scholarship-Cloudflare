import { AdminCapability } from "@prisma/client";

export const CAPABILITIES = Object.values(AdminCapability);

export type Capability = AdminCapability;
