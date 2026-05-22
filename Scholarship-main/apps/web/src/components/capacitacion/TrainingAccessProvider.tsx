"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  TrainingOrganizationAccess,
  TrainingPermissionFlags,
  TrainingViewer,
} from "@/lib/training-access";

type TrainingAccessResponse = {
  success: true;
  viewer: TrainingViewer;
  selectedOrganizationId: string | null;
  organizations: TrainingOrganizationAccess[];
  permissions: TrainingPermissionFlags;
};

type TrainingAccessContextValue = {
  viewer: TrainingViewer | null;
  selectedOrganizationId: string | null;
  organizations: TrainingOrganizationAccess[];
  permissions: TrainingPermissionFlags;
  isLoading: boolean;
  error: string | null;
  selectOrganization: (organizationId: string) => void;
  refreshAccess: () => void;
};

const EMPTY_PERMISSIONS: TrainingPermissionFlags = {
  canAccessCapacitacion: false,
  canViewRolplay: false,
  canJoinRolplay: false,
  canCreateRooms: false,
};

const TrainingAccessContext = createContext<TrainingAccessContextValue | null>(null);

async function fetchTrainingAccess(
  organizationId?: string | null,
): Promise<TrainingAccessResponse> {
  const query = organizationId
    ? `?orgId=${encodeURIComponent(organizationId)}`
    : "";
  const response = await fetch(`/api/capacitacion/permissions${query}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar los permisos de capacitación.");
  }

  return response.json() as Promise<TrainingAccessResponse>;
}

export function TrainingAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [viewer, setViewer] = useState<TrainingViewer | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [requestedOrganizationId, setRequestedOrganizationId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<TrainingOrganizationAccess[]>([]);
  const [permissions, setPermissions] = useState<TrainingPermissionFlags>(EMPTY_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await fetchTrainingAccess(requestedOrganizationId);
        if (cancelled) {
          return;
        }

        setViewer(payload.viewer);
        setSelectedOrganizationId(payload.selectedOrganizationId);
        setOrganizations(payload.organizations);
        setPermissions(payload.permissions);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setViewer(null);
        setSelectedOrganizationId(null);
        setOrganizations([]);
        setPermissions(EMPTY_PERMISSIONS);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los permisos de capacitación.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [requestedOrganizationId, refreshToken]);

  const value = useMemo<TrainingAccessContextValue>(
    () => ({
      viewer,
      selectedOrganizationId,
      organizations,
      permissions,
      isLoading,
      error,
      selectOrganization: (organizationId: string) => {
        setRequestedOrganizationId(organizationId);
      },
      refreshAccess: () => {
        setRefreshToken((current) => current + 1);
      },
    }),
    [error, isLoading, organizations, permissions, selectedOrganizationId, viewer],
  );

  return (
    <TrainingAccessContext.Provider value={value}>
      {children}
    </TrainingAccessContext.Provider>
  );
}

export function useTrainingAccess() {
  const context = useContext(TrainingAccessContext);
  if (!context) {
    throw new Error("useTrainingAccess must be used within TrainingAccessProvider");
  }
  return context;
}
