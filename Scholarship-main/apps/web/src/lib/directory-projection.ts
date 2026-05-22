import {
  buildDirectoryContactHref,
  parseDirectoryContactMethods,
  stringifyDirectoryContactMethods,
  type DirectoryContactMethodRecord,
} from "@/lib/directory-contact-methods";

type CampusProjection = {
  id: string;
  code: string;
  metaKey?: string;
  name: string;
  slug?: string;
};

type ContactProjectionInput = {
  id: string;
  zone: string | null;
  role: string | null;
  name: string | null;
  email: string | null;
  phone?: string | null;
  source: string | null;
  campus: CampusProjection;
  methods?: DirectoryContactMethodRecord[];
};

export type DirectoryPublicMethod = DirectoryContactMethodRecord & {
  href: string | null;
};

export function projectDirectoryContact(input: ContactProjectionInput) {
  const canonicalMethods =
    input.methods?.length
      ? input.methods
          .map((method) => ({
            type: method.type,
            value: method.value,
            normalizedValue: method.normalizedValue,
            isPrimary: method.isPrimary,
            sortOrder: method.sortOrder,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : parseDirectoryContactMethods(input.email ?? input.phone ?? "");

  const methods: DirectoryPublicMethod[] = canonicalMethods.map((method) => ({
    ...method,
    href: buildDirectoryContactHref(method),
  }));

  return {
    id: input.id,
    zone: input.zone,
    role: input.role,
    name: input.name,
    contact:
      stringifyDirectoryContactMethods(methods) ||
      input.email ||
      input.phone ||
      null,
    email: input.email,
    source: input.source,
    campus: input.campus,
    methods,
  };
}
