"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FacebookLoginStatusResponse = {
  status?: "connected" | "not_authorized" | "unknown" | string;
  authResponse?: {
    accessToken?: string;
    expiresIn?: number;
    signedRequest?: string;
    userID?: string;
    code?: string;
  };
};

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        callback: (response: FacebookLoginStatusResponse | undefined) => void,
        params: Record<string, unknown>,
      ) => void;
      getLoginStatus: (callback: (response: FacebookLoginStatusResponse) => void) => void;
      AppEvents?: {
        logPageView?: () => void;
      };
      XFBML?: {
        parse?: () => void;
      };
    };
    fbAsyncInit?: () => void;
    checkLoginState?: () => void;
    statusChangeCallback?: (response: FacebookLoginStatusResponse) => void;
  }
}

type SignupEvent = {
  id: string;
  type: "info" | "success" | "error";
  message: string;
  at: string;
};

type ContactRecord = {
  id: string;
  contactName: string;
  phone: string;
  normalizedPhone: string;
  waId: string | null;
  bsuid: string | null;
  parentBsuid: string | null;
  whatsappUsername: string | null;
  profilePictureUrl: string | null;
  profileSource: string | null;
  lastProfileSyncAt: string | null;
  lastIdentitySyncAt: string | null;
  email: string | null;
  tags: string[];
  lastWhatsappMessageAt: string | null;
  lastWhatsappMessageText: string | null;
  campaignMessageCount: number;
  updatedAt: string;
};

type MetaOverview = {
  connection: {
    id: string;
    status: string;
    graphApiVersion: string;
    wabaId: string | null;
    wabaName: string | null;
    phoneNumberId: string | null;
    phoneDisplayNumber: string | null;
    phoneVerifiedName: string | null;
    phoneQualityRating: string | null;
    phoneCodeVerificationStatus: string | null;
    businessAccountId: string | null;
    businessManagerId: string | null;
    businessName: string | null;
    wabaCurrency: string | null;
    wabaTimezoneId: string | null;
    accessTokenExpiresAt: string | null;
    connectedAt: string | null;
    lastAssetSyncAt: string | null;
    lastTemplateSyncAt: string | null;
    lastWebhookAt: string | null;
    lastSyncError: string | null;
    grantedScopes: string[];
    updatedAt: string;
  } | null;
  assets: {
    business: { id: string | null; name: string | null } | null;
    waba: {
      id: string | null;
      name: string | null;
      currency: string | null;
      timezoneId: string | null;
    } | null;
    phoneNumber: {
      id: string | null;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      qualityRating: string | null;
      codeVerificationStatus: string | null;
    } | null;
    businessProfile: {
      about: string | null;
      address: string | null;
      description: string | null;
      email: string | null;
      profilePictureUrl: string | null;
      websites: string[];
      vertical: string | null;
    } | null;
  };
  templates: Array<{
    id: string;
    name: string;
    language: string | null;
    status: string | null;
    category: string | null;
    qualityScore: string | null;
    rejectedReason: string | null;
    updatedAt: string | null;
  }>;
  recentMessages: Array<{
    id: string;
    metaMessageId: string | null;
    direction: string;
    messageType: string;
    templateName: string | null;
    templateLanguage: string | null;
    textBody: string | null;
    mediaId: string | null;
    mediaMimeType: string | null;
    mediaCaption: string | null;
    externalStatus: string | null;
    contact: {
      id: string | null;
      contactName: string | null;
      phone: string | null;
      waId: string | null;
      bsuid: string | null;
      whatsappUsername: string | null;
    };
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    failedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    deliveryStatus: string | null;
    metaMessageId: string | null;
    contact: {
      id: string | null;
      contactName: string | null;
      phone: string | null;
      bsuid: string | null;
      whatsappUsername: string | null;
    };
    eventAt: string;
    createdAt: string;
  }>;
  embeddedSignup: {
    legalUrls: {
      cancelAuthorizationUrl: string;
      dataDeletionRequestUrl: string;
      dataDeletionCallbackUrl: string;
    };
    recentSessions: Array<{
      id: string;
      clientSessionId: string;
      status: string;
      flowType: string | null;
      configId: string | null;
      facebookUserId: string | null;
      facebookLoginStatus: string | null;
      wabaId: string | null;
      phoneNumberId: string | null;
      businessAccountId: string | null;
      errorMessage: string | null;
      authorizationCodeReceivedAt: string | null;
      finishedAt: string | null;
      cancelledAt: string | null;
      exchangedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  blockers: string[];
  reviewerNotes: string[];
  capabilities: {
    canLaunchEmbeddedSignup: boolean;
    canSyncAssets: boolean;
    canListTemplates: boolean;
    canSendText: boolean;
    canSendTemplate: boolean;
    canUploadMedia: boolean;
    canSendConversions: boolean;
    canReviewBsuid: boolean;
    canReviewBusinessAssetProfile: boolean;
    businessManagementInScope: boolean;
  };
  environment: {
    requiredServerVariables: string[];
    requiredPublicVariables: string[];
    requiredConversionsVariables: string[];
  optionalVariables: string[];
    missingServerVariables: string[];
    missingPublicVariables: string[];
    missingConversionsVariables: string[];
  };
  onboarding: {
    status: "pending" | "in_progress" | "ready" | "blocked";
    missingPermissions: string[];
    phases: Array<{
      key: "connect" | "provision" | "validate" | "app_review";
      title: string;
      status: "pending" | "in_progress" | "ready" | "blocked";
      summary: string;
      blockers: string[];
    }>;
  };
};

type WorkspacePayload = {
  overview: MetaOverview | null;
  contacts: ContactRecord[];
};

type UploadedMedia = {
  id: string | null;
  mimeType: string | null;
  sha256: string | null;
  fileSize: number | null;
  messagingProduct: string | null;
  downloadUrl: string | null;
  localFileName: string | null;
};

const DEFAULT_META_APP_ID = "920977560769210";
const DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID = "2191644411673120";
const DEFAULT_WHATSAPP_API_CONFIG_ID = "1593446981941546";
const META_HOSTED_ONBOARDING_BASE_URL = "https://business.facebook.com/messaging/whatsapp/onboard/";

const SIGNUP_FLOWS = {
  embedded_signup: {
    label: "Conecta tu WhatsApp Business",
    description: "Registro insertado para enlazar un WABA nuevo o existente.",
  },
  whatsapp_api: {
    label: "Conéctate a la API de WhatsApp",
    description: "Mediación de registro orientada a la conexión operativa con la API.",
  },
} as const;

type SignupFlowType = keyof typeof SIGNUP_FLOWS;

const FACEBOOK_JS_SDK = "https://connect.facebook.net/en_US/sdk.js";

function createEvent(type: SignupEvent["type"], message: string): SignupEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    message,
    at: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCompact(value: string | null | undefined) {
  return value && value.trim() ? value : "Not available";
}

function getStatusTone(status: string | null | undefined) {
  switch (String(status ?? "").toLowerCase()) {
    case "connected":
    case "ready":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "warning":
    case "in_progress":
      return "border-amber-300/30 bg-amber-500/10 text-amber-100";
    case "error":
    case "blocked":
      return "border-red-400/30 bg-red-500/10 text-red-100";
    default:
      return "border-white/10 bg-white/[0.05] text-slate-200";
  }
}

function formatReviewerEventType(eventType: string) {
  if (eventType.startsWith("conversion_api_sent:")) {
    return `Conversions API · ${eventType.replace("conversion_api_sent:", "")}`;
  }
  if (eventType.startsWith("conversion_api_failed:")) {
    return `Conversions API failed · ${eventType.replace("conversion_api_failed:", "")}`;
  }
  return eventType;
}

function parseTemplateVariables(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildHostedOnboardingUrl(params: {
  appId: string;
  configId: string;
  sessionInfoVersion: number;
}) {
  const extras = JSON.stringify({
    setup: {},
    featureType: "whatsapp_business_app_onboarding",
    sessionInfoVersion: String(params.sessionInfoVersion),
    version: "v4",
  });

  const searchParams = new URLSearchParams({
    app_id: params.appId,
    config_id: params.configId,
    extras,
  });

  return `${META_HOSTED_ONBOARDING_BASE_URL}?${searchParams.toString()}`;
}

function resolveRecipient(contact: ContactRecord | null) {
  if (!contact) return null;
  return contact.phone || contact.waId || contact.bsuid || null;
}

function findSelectedTemplate(overview: MetaOverview | null, templateId: string) {
  return overview?.templates.find((template) => template.id === templateId) ?? null;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid gap-1 rounded-2xl border border-white/6 bg-slate-950/55 px-3 py-2.5">
      <span className="uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="break-all text-slate-100">{formatCompact(value)}</span>
    </div>
  );
}

type WabaEmbeddedSignupSectionProps = {
  surface?: "workspace" | "admin";
};

export default function WabaEmbeddedSignupSection({
  surface = "workspace",
}: WabaEmbeddedSignupSectionProps) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID?.trim() ?? DEFAULT_META_APP_ID;
  const embeddedSignupConfigId =
    process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ??
    process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_CONFIG_ID?.trim() ??
    DEFAULT_EMBEDDED_SIGNUP_CONFIG_ID;
  const whatsappApiConfigId =
    process.env.NEXT_PUBLIC_WHATSAPP_API_CONFIG_ID?.trim() ??
    DEFAULT_WHATSAPP_API_CONFIG_ID;
  const sessionInfoVersion = Number(
    process.env.NEXT_PUBLIC_WHATSAPP_ES_SESSION_INFO_VERSION ?? "3",
  );

  const signupMetaRef = useRef<{
    clientSessionId: string | null;
    flowType: SignupFlowType | null;
    configId: string | null;
    wabaId: string | null;
    phoneNumberId: string | null;
    businessAccountId: string | null;
  }>({
    clientSessionId: null,
    flowType: null,
    configId: null,
    wabaId: null,
    phoneNumberId: null,
    businessAccountId: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sdkReady, setSdkReady] = useState(false);
  const [events, setEvents] = useState<SignupEvent[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [overview, setOverview] = useState<MetaOverview | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messageMode, setMessageMode] = useState<"text" | "template" | "media">("text");
  const [messageDraft, setMessageDraft] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateVariables, setTemplateVariables] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [launchingSignupFlow, setLaunchingSignupFlow] = useState<SignupFlowType | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [facebookLoginStatus, setFacebookLoginStatus] = useState<string>("unknown");
  const [facebookLoginUserId, setFacebookLoginUserId] = useState<string | null>(null);

  const pushEvent = useCallback((type: SignupEvent["type"], message: string) => {
    setEvents((current) => [createEvent(type, message), ...current].slice(0, 12));
  }, []);

  const configIdByFlow = useMemo(
    () =>
      ({
        embedded_signup: embeddedSignupConfigId,
        whatsapp_api: whatsappApiConfigId,
      }) satisfies Record<SignupFlowType, string>,
    [embeddedSignupConfigId, whatsappApiConfigId],
  );
  const hostedUrlByFlow = useMemo(
    () =>
      ({
        embedded_signup: buildHostedOnboardingUrl({
          appId,
          configId: embeddedSignupConfigId,
          sessionInfoVersion,
        }),
        whatsapp_api: buildHostedOnboardingUrl({
          appId,
          configId: whatsappApiConfigId,
          sessionInfoVersion,
        }),
      }) satisfies Record<SignupFlowType, string>,
    [appId, embeddedSignupConfigId, sessionInfoVersion, whatsappApiConfigId],
  );

  const recordSignupSession = useCallback(
    async (
      status: "started" | "login_status" | "finish" | "cancelled" | "error",
      extras?: {
        clientSessionId?: string | null;
        flowType?: SignupFlowType | null;
        configId?: string | null;
        facebookUserId?: string | null;
        facebookLoginStatus?: string | null;
        wabaId?: string | null;
        phoneNumberId?: string | null;
        businessAccountId?: string | null;
        errorMessage?: string | null;
        payload?: unknown;
      },
    ) => {
      const clientSessionId = extras?.clientSessionId ?? signupMetaRef.current.clientSessionId;
      if (!clientSessionId) return;

      await fetch("/api/integrations/meta/embedded-signup/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientSessionId,
          status,
          flowType: extras?.flowType ?? signupMetaRef.current.flowType,
          appId,
          configId: extras?.configId ?? signupMetaRef.current.configId,
          sessionInfoVersion,
          facebookUserId: extras?.facebookUserId ?? facebookLoginUserId,
          facebookLoginStatus: extras?.facebookLoginStatus ?? facebookLoginStatus,
          wabaId: extras?.wabaId ?? signupMetaRef.current.wabaId,
          phoneNumberId: extras?.phoneNumberId ?? signupMetaRef.current.phoneNumberId,
          businessAccountId:
            extras?.businessAccountId ?? signupMetaRef.current.businessAccountId,
          errorMessage: extras?.errorMessage ?? null,
          payload: extras?.payload,
        }),
      }).catch(() => null);
    },
    [appId, facebookLoginStatus, facebookLoginUserId, sessionInfoVersion],
  );

  const handleFacebookStatusChange = useCallback(
    (response: FacebookLoginStatusResponse | undefined, source: string) => {
      const status = String(response?.status ?? "unknown").toLowerCase();
      setFacebookLoginStatus(status);

      if (status === "connected") {
        const userId = response?.authResponse?.userID?.trim() ?? null;
        setFacebookLoginUserId(userId);
        void recordSignupSession("login_status", {
          facebookUserId: userId,
          facebookLoginStatus: status,
          payload: { source, status },
        });
        pushEvent(
          "success",
          `Facebook login status is connected (${source}).`,
        );
        return;
      }

      setFacebookLoginUserId(null);
      void recordSignupSession("login_status", {
        facebookUserId: null,
        facebookLoginStatus: status,
        payload: { source, status },
      });
      pushEvent(
        "info",
        `Facebook login status is ${status || "unknown"} (${source}).`,
      );
    },
    [pushEvent, recordSignupSession],
  );

  const loadWorkspace = useCallback(
    async (options?: { sync?: boolean; silent?: boolean }) => {
      if (!options?.silent) {
        setWorkspaceLoading(true);
      }

      try {
        const overviewPath = options?.sync
          ? "/api/integrations/meta/whatsapp/overview?sync=1"
          : "/api/integrations/meta/whatsapp/overview";
        const [overviewResponse, contactsResponse] = await Promise.all([
          fetch(overviewPath, { cache: "no-store" }),
          fetch("/api/data/contacts", { cache: "no-store" }),
        ]);

        const overviewPayload = (await overviewResponse.json().catch(() => null)) as
          | { ok?: boolean; error?: string; overview?: MetaOverview }
          | null;
        const contactsPayload = (await contactsResponse.json().catch(() => null)) as
          | { ok?: boolean; error?: string; contacts?: ContactRecord[] }
          | null;

        if (!overviewResponse.ok || !overviewPayload?.ok) {
          throw new Error(overviewPayload?.error || "Unable to load the WABA overview.");
        }

        if (!contactsResponse.ok || !contactsPayload?.ok) {
          throw new Error(contactsPayload?.error || "Unable to load the contacts list.");
        }

        const payload: WorkspacePayload = {
          overview: overviewPayload.overview ?? null,
          contacts: contactsPayload.contacts ?? [],
        };

        setOverview(payload.overview);
        setContacts(payload.contacts);
        setWorkspaceError(null);

        setSelectedContactId((current) => {
          if (current && payload.contacts.some((contact) => contact.id === current)) {
            return current;
          }
          return payload.contacts[0]?.id ?? null;
        });

        if (!templateId && payload.overview?.templates.length) {
          setTemplateId(payload.overview.templates[0]?.id ?? "");
        }
      } catch (error) {
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : "Unable to load the WABA reviewer workspace.",
        );
      } finally {
        if (!options?.silent) {
          setWorkspaceLoading(false);
        }
      }
    },
    [templateId],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!appId || typeof window === "undefined") {
      setSdkReady(false);
      return;
    }

    const sdkScriptId = "facebook-jssdk";
    let createdScript = false;

    window.statusChangeCallback = (response: FacebookLoginStatusResponse) => {
      handleFacebookStatusChange(response, "status_change_callback");
    };

    window.checkLoginState = () => {
      if (!window.FB?.getLoginStatus) {
        setFacebookLoginStatus("sdk_unavailable");
        setFacebookLoginUserId(null);
        return;
      }
      window.FB.getLoginStatus((response) => {
        window.statusChangeCallback?.(response);
      });
    };

    if (window.FB) {
      setSdkReady(true);
      window.FB.XFBML?.parse?.();
      window.checkLoginState();
      return () => {
        window.checkLoginState = undefined;
        window.statusChangeCallback = undefined;
      };
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v25.0",
      });
      window.FB?.AppEvents?.logPageView?.();
      setSdkReady(true);
      pushEvent("info", "Facebook JS SDK initialized for Embedded Signup.");
      window.FB?.XFBML?.parse?.();
      window.checkLoginState?.();
    };

    if (!document.getElementById(sdkScriptId)) {
      const script = document.createElement("script");
      script.id = sdkScriptId;
      script.src = FACEBOOK_JS_SDK;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      const firstScript = document.getElementsByTagName("script")[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.body.appendChild(script);
      }
      createdScript = true;
    }

    return () => {
      window.fbAsyncInit = undefined;
      window.checkLoginState = undefined;
      window.statusChangeCallback = undefined;
      if (createdScript) {
        document.getElementById(sdkScriptId)?.remove();
      }
    };
  }, [appId, handleFacebookStatusChange, pushEvent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" || typeof event.data !== "string") {
        return;
      }

      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: {
            phone_number_id?: string;
            waba_id?: string;
            business_account_id?: string;
          };
        };

        if (payload.type !== "WA_EMBEDDED_SIGNUP") return;

        if (payload.event === "FINISH") {
          signupMetaRef.current = {
            clientSessionId: signupMetaRef.current.clientSessionId,
            flowType: signupMetaRef.current.flowType,
            configId: signupMetaRef.current.configId,
            wabaId: payload.data?.waba_id ?? null,
            phoneNumberId: payload.data?.phone_number_id ?? null,
            businessAccountId: payload.data?.business_account_id ?? null,
          };
          void recordSignupSession("finish", {
            wabaId: payload.data?.waba_id ?? null,
            phoneNumberId: payload.data?.phone_number_id ?? null,
            businessAccountId: payload.data?.business_account_id ?? null,
            payload,
          });
          pushEvent(
            "success",
            `Embedded Signup returned WABA ${payload.data?.waba_id ?? "n/a"} and phone number ${payload.data?.phone_number_id ?? "n/a"}.`,
          );
          return;
        }

        if (payload.event === "CANCEL") {
          void recordSignupSession("cancelled", { payload });
          pushEvent("info", "Embedded Signup was cancelled before completion.");
          return;
        }

        if (payload.event === "ERROR") {
          void recordSignupSession("error", {
            errorMessage: "Meta reported an error during Embedded Signup.",
            payload,
          });
          pushEvent("error", "Meta reported an error during Embedded Signup.");
        }
      } catch {}
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [pushEvent, recordSignupSession]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const base = normalizedQuery
      ? contacts.filter((contact) =>
          [
            contact.contactName,
            contact.phone,
            contact.waId ?? "",
            contact.bsuid ?? "",
            contact.whatsappUsername ?? "",
            contact.email ?? "",
            contact.tags.join(" "),
            contact.lastWhatsappMessageText ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : contacts;

    return [...base].sort((left, right) => {
      const leftTime = left.lastWhatsappMessageAt ? new Date(left.lastWhatsappMessageAt).getTime() : 0;
      const rightTime = right.lastWhatsappMessageAt
        ? new Date(right.lastWhatsappMessageAt).getTime()
        : 0;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.contactName.localeCompare(right.contactName, "en-US");
    });
  }, [contacts, query]);

  const selectedContact = useMemo(
    () => filteredContacts.find((contact) => contact.id === selectedContactId) ?? null,
    [filteredContacts, selectedContactId],
  );

  const selectedTemplate = useMemo(
    () => findSelectedTemplate(overview, templateId),
    [overview, templateId],
  );
  const recipient = resolveRecipient(selectedContact);
  const canLaunchEmbeddedSignup = Boolean(
    appId &&
      embeddedSignupConfigId &&
      whatsappApiConfigId &&
      sdkReady,
  );
  const facebookStatusLabel =
    facebookLoginStatus === "connected"
      ? `connected${facebookLoginUserId ? ` (${facebookLoginUserId})` : ""}`
      : facebookLoginStatus;
  const canSync = Boolean(overview?.capabilities.canSyncAssets && !syncing);
  const canSendText = Boolean(
    selectedContact &&
      recipient &&
      overview?.capabilities.canSendText &&
      messageDraft.trim() &&
      !sending,
  );
  const canSendTemplate = Boolean(
    selectedContact &&
      recipient &&
      overview?.capabilities.canSendTemplate &&
      selectedTemplate &&
      !sending,
  );
  const canSendMedia = Boolean(
    selectedContact &&
      recipient &&
      overview?.capabilities.canUploadMedia &&
      uploadedMedia?.id &&
      !sending,
  );
  const isAdminSurface = surface === "admin";
  const statusSummary =
    overview?.connection?.status === "connected"
      ? "Canal listo"
      : overview?.connection?.status === "warning"
        ? "Canal con alertas"
        : overview?.connection?.status === "error"
          ? "Error de conexión"
          : "Sin conexión";
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await loadWorkspace({ sync: true });
      pushEvent("success", "Meta assets, templates and reviewer evidence were refreshed.");
    } catch {
      // loadWorkspace already stores the error.
    } finally {
      setSyncing(false);
    }
  }, [loadWorkspace, pushEvent]);

  const handleSignup = useCallback((flowType: SignupFlowType) => {
    const configId = configIdByFlow[flowType];
    if (!window.FB || !appId || !configId) {
      pushEvent("error", "Public Meta configuration is incomplete or the SDK is not ready.");
      return;
    }

    const clientSessionId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    signupMetaRef.current = {
      clientSessionId,
      flowType,
      configId,
      wabaId: null,
      phoneNumberId: null,
      businessAccountId: null,
    };

    setLaunchingSignupFlow(flowType);
    setWorkspaceError(null);
    void recordSignupSession("started", {
      clientSessionId,
      flowType,
      configId,
      payload: {
        trigger: "manual_button",
      },
    });
    pushEvent("info", `Opening Meta flow: ${SIGNUP_FLOWS[flowType].label}.`);

    window.FB.login(
      (response) => {
        setLaunchingSignupFlow(null);
        const code = response?.authResponse?.code;
        if (!code) {
          void recordSignupSession("error", {
            clientSessionId,
            flowType,
            configId,
            errorMessage: "Meta did not return an authorization code.",
            payload: response ?? null,
          });
          pushEvent("error", "Meta did not return an authorization code.");
          return;
        }

        pushEvent("success", "Authorization code received. Saving the Meta connection...");

        void (async () => {
          try {
            const exchangeResponse = await fetch("/api/integrations/meta/exchange-code", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                code,
                clientSessionId,
                flowType,
                facebookUserId: response?.authResponse?.userID?.trim() ?? null,
                facebookLoginStatus: response?.status ?? facebookLoginStatus,
                configId,
                sessionInfoVersion,
                wabaId: signupMetaRef.current.wabaId,
                phoneNumberId: signupMetaRef.current.phoneNumberId,
                businessAccountId: signupMetaRef.current.businessAccountId,
              }),
            });

            const payload = (await exchangeResponse.json().catch(() => null)) as
              | { ok?: boolean; error?: string }
              | null;

            if (!exchangeResponse.ok || !payload?.ok) {
              throw new Error(payload?.error || "Unable to save the Meta connection.");
            }

            pushEvent("success", "Meta connection saved. Syncing reviewer data...");
            await loadWorkspace({ sync: true });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unable to complete Embedded Signup.";
            setWorkspaceError(message);
            pushEvent("error", message);
          }
        })();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          sessionInfoVersion,
          setup: {},
        },
      },
    );
  }, [
    appId,
    configIdByFlow,
    facebookLoginStatus,
    loadWorkspace,
    pushEvent,
    recordSignupSession,
    sessionInfoVersion,
  ]);

  const handleUploadMedia = useCallback(async (file: File) => {
    setUploadingMedia(true);
    setWorkspaceError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (overview?.connection?.phoneNumberId) {
        formData.append("phoneNumberId", overview.connection.phoneNumberId);
      }

      const response = await fetch("/api/integrations/meta/whatsapp/media", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            media?: Omit<UploadedMedia, "localFileName">;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.media) {
        throw new Error(payload?.error || "Unable to upload media to Meta.");
      }

      setUploadedMedia({
        ...payload.media,
        localFileName: file.name,
      });
      pushEvent("success", `Media uploaded to Meta: ${file.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media upload failed.";
      setWorkspaceError(message);
      pushEvent("error", message);
    } finally {
      setUploadingMedia(false);
    }
  }, [overview?.connection?.phoneNumberId, pushEvent]);

  const handleSend = useCallback(async () => {
    if (!selectedContact || !recipient) {
      setWorkspaceError("Select a contact with a valid recipient identifier first.");
      return;
    }

    setSending(true);
    setWorkspaceError(null);
    try {
      const payload =
        messageMode === "template" && selectedTemplate
          ? {
              to: recipient,
              contactName: selectedContact.contactName,
              waId: selectedContact.waId,
              bsuid: selectedContact.bsuid,
              parentBsuid: selectedContact.parentBsuid,
              whatsappUsername: selectedContact.whatsappUsername,
              profilePictureUrl: selectedContact.profilePictureUrl,
              phoneNumberId: overview?.connection?.phoneNumberId ?? undefined,
              messageType: "template",
              templateName: selectedTemplate.name,
              templateLanguage: selectedTemplate.language ?? "en_US",
              templateBodyVariables: parseTemplateVariables(templateVariables),
            }
          : messageMode === "media" && uploadedMedia?.id
            ? {
                to: recipient,
                contactName: selectedContact.contactName,
                waId: selectedContact.waId,
                bsuid: selectedContact.bsuid,
                parentBsuid: selectedContact.parentBsuid,
                whatsappUsername: selectedContact.whatsappUsername,
                profilePictureUrl: selectedContact.profilePictureUrl,
                phoneNumberId: overview?.connection?.phoneNumberId ?? undefined,
                messageType:
                  uploadedMedia.mimeType?.startsWith("image/") ? "image" : "document",
                mediaId: uploadedMedia.id,
                mediaCaption: mediaCaption.trim(),
                fileName: uploadedMedia.localFileName ?? undefined,
              }
            : {
                to: recipient,
                contactName: selectedContact.contactName,
                waId: selectedContact.waId,
                bsuid: selectedContact.bsuid,
                parentBsuid: selectedContact.parentBsuid,
                whatsappUsername: selectedContact.whatsappUsername,
                profilePictureUrl: selectedContact.profilePictureUrl,
                phoneNumberId: overview?.connection?.phoneNumberId ?? undefined,
                messageType: "text",
                text: messageDraft.trim(),
              };

      const response = await fetch("/api/integrations/meta/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const sendPayload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !sendPayload?.ok) {
        throw new Error(sendPayload?.error || "Unable to send the WhatsApp message.");
      }

      pushEvent("success", `Meta accepted the ${messageMode} send action for ${selectedContact.contactName}.`);
      setMessageDraft("");
      setMediaCaption("");
      await loadWorkspace({ sync: true, silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send action failed.";
      setWorkspaceError(message);
      pushEvent("error", message);
    } finally {
      setSending(false);
    }
  }, [
    loadWorkspace,
    mediaCaption,
    messageDraft,
    messageMode,
    overview?.connection?.phoneNumberId,
    pushEvent,
    recipient,
    selectedContact,
    selectedTemplate,
    templateVariables,
    uploadedMedia,
  ]);

  return (
    <section className="ui-card ui-card-pad min-w-0" data-testid="waba-app-review">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
          {isAdminSurface ? "Consola WhatsApp" : "Canal WhatsApp"}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-white">
          {isAdminSurface ? "Conexión, diagnóstico y operación" : "Mensajes y seguimiento"}
        </h2>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void loadWorkspace()}
          disabled={workspaceLoading}
          className="ui-button-secondary"
          data-testid="waba-refresh"
        >
          {workspaceLoading ? "Actualizando..." : "Actualizar"}
        </button>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={!canSync}
          className="ui-button-secondary"
          data-testid="waba-sync"
        >
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
        {isAdminSurface ? (
          <>
            <button
              type="button"
              onClick={() => handleSignup("embedded_signup")}
              disabled={!canLaunchEmbeddedSignup || Boolean(launchingSignupFlow)}
              className="ui-button-primary"
              data-testid="waba-embedded-signup-connect-business"
            >
              {launchingSignupFlow === "embedded_signup"
                ? "Abriendo Meta..."
                : "Conectar negocio"}
            </button>
            <button
              type="button"
              onClick={() => handleSignup("whatsapp_api")}
              disabled={!canLaunchEmbeddedSignup || Boolean(launchingSignupFlow)}
              className="ui-button-primary"
              data-testid="waba-embedded-signup-connect-api"
            >
              {launchingSignupFlow === "whatsapp_api"
                ? "Abriendo Meta..."
                : "Conectar API"}
            </button>
            <a
              href={hostedUrlByFlow.embedded_signup}
              target="_blank"
              rel="noreferrer noopener"
              className="ui-button-secondary"
              data-testid="waba-hosted-signup-connect-business"
            >
              Registro alojado negocio
            </a>
            <a
              href={hostedUrlByFlow.whatsapp_api}
              target="_blank"
              rel="noreferrer noopener"
              className="ui-button-secondary"
              data-testid="waba-hosted-signup-connect-api"
            >
              Registro alojado API
            </a>
          </>
        ) : null}
      </div>

      {isAdminSurface && appId && embeddedSignupConfigId && whatsappApiConfigId ? (
        <div className="mt-3 grid gap-1 rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-3 text-xs text-slate-300">
          <div>
            Facebook Login: <span className="font-semibold text-slate-100">{facebookStatusLabel}</span>
          </div>
          <div>App ID: <span className="font-semibold text-slate-100">{appId}</span></div>
          <div>Embedded signup: <span className="font-semibold text-slate-100">{embeddedSignupConfigId}</span></div>
          <div>API WhatsApp: <span className="font-semibold text-slate-100">{whatsappApiConfigId}</span></div>
        </div>
      ) : null}

      {workspaceError ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {workspaceError}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <section className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="ui-kicker">Estado</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">{statusSummary}</div>
              </div>
              <span className={["ui-pill", getStatusTone(overview?.connection?.status)].join(" ")}>
                {overview?.connection?.status ?? "pending"}
              </span>
            </div>

            <div className="grid gap-2 text-xs text-slate-300">
              <DetailRow label="Graph API" value={overview?.connection?.graphApiVersion} />
              <DetailRow label="Negocio" value={overview?.assets.business?.name ?? overview?.assets.business?.id} />
              <DetailRow label="WABA" value={overview?.assets.waba?.name ?? overview?.assets.waba?.id} />
              <DetailRow label="Número" value={overview?.assets.phoneNumber?.displayPhoneNumber ?? overview?.assets.phoneNumber?.id} />
              <DetailRow label="Nombre verificado" value={overview?.assets.phoneNumber?.verifiedName} />
              {isAdminSurface ? (
                <>
                  <DetailRow label="Última sincronización" value={overview?.connection?.lastAssetSyncAt} />
                  <DetailRow label="Último webhook" value={overview?.connection?.lastWebhookAt} />
                </>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
            <div>
              <div className="ui-kicker">Contactos</div>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ui-control"
              placeholder="Buscar por nombre, teléfono o usuario"
            />
            <div className="ui-scrollbar grid max-h-[420px] gap-2 overflow-y-auto pr-1" data-testid="waba-contacts">
              {workspaceLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
                  Cargando contactos...
                </div>
              ) : filteredContacts.length ? (
                filteredContacts.map((contact) => {
                  const isSelected = contact.id === selectedContactId;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => setSelectedContactId(contact.id)}
                      className={[
                        "grid gap-2 rounded-2xl border px-3 py-3 text-left transition",
                        isSelected
                          ? "border-emerald-400/30 bg-emerald-500/10 text-slate-100"
                          : "border-white/8 bg-slate-950/45 text-slate-200 hover:border-white/16 hover:bg-white/[0.04]",
                      ].join(" ")}
                      data-testid={`waba-contact-${contact.id}`}
                    >
                      <div className="text-sm font-semibold">{contact.contactName}</div>
                      <div className="text-xs text-slate-400">
                        {contact.phone}
                        {contact.whatsappUsername ? ` · @${contact.whatsappUsername}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Última actividad: {formatDateTime(contact.lastWhatsappMessageAt)}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                  Sin contactos disponibles.
                </div>
              )}
            </div>
          </section>
        </aside>

        <div className="grid content-start gap-4">
          <section className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="ui-kicker">Envío</div>
                <div className="mt-1 text-lg font-semibold text-slate-100">
                  {selectedContact ? selectedContact.contactName : "Selecciona un contacto"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["text", "template", "media"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMessageMode(mode as "text" | "template" | "media")}
                    className={[
                      "ui-pill inline-flex items-center border transition",
                      messageMode === mode
                        ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                        : "border-white/10 bg-white/[0.045] text-slate-100 hover:bg-white/[0.08]",
                    ].join(" ")}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {messageMode === "text" ? (
              <label className="grid gap-2 text-sm text-slate-200">
                Mensaje
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  className="ui-control min-h-[140px]"
                  placeholder="Escribe el mensaje"
                  data-testid="waba-text-draft"
                />
              </label>
            ) : null}

            {messageMode === "template" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-200">
                  Template oficial
                  <select
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="ui-control"
                    data-testid="waba-template-select"
                  >
                    <option value="">Selecciona un template</option>
                    {overview?.templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.language ? `(${template.language})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-slate-200">
                  Variables
                  <textarea
                    value={templateVariables}
                    onChange={(event) => setTemplateVariables(event.target.value)}
                    className="ui-control min-h-[140px]"
                    placeholder="Una variable por línea"
                  />
                </label>
              </div>
            ) : null}

            {messageMode === "media" ? (
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUploadMedia(file);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!overview?.capabilities.canUploadMedia || uploadingMedia}
                    className="ui-button-secondary"
                    data-testid="waba-upload-media"
                  >
                    {uploadingMedia ? "Subiendo..." : "Subir archivo"}
                  </button>
                  <div className="rounded-2xl border border-white/8 bg-slate-950/45 px-3 py-3 text-xs text-slate-300">
                    <div>Media ID: {formatCompact(uploadedMedia?.id)}</div>
                    <div>MIME: {formatCompact(uploadedMedia?.mimeType)}</div>
                    <div>Tamaño: {uploadedMedia?.fileSize ? `${uploadedMedia.fileSize} bytes` : "No disponible"}</div>
                  </div>
                </div>
                <label className="grid gap-2 text-sm text-slate-200">
                  Caption
                  <textarea
                    value={mediaCaption}
                    onChange={(event) => setMediaCaption(event.target.value)}
                    className="ui-control min-h-[140px]"
                    placeholder="Caption opcional"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={
                  messageMode === "text"
                    ? !canSendText
                    : messageMode === "template"
                      ? !canSendTemplate
                      : !canSendMedia
                }
                className="ui-button-primary"
                data-testid="waba-send"
              >
                {sending ? "Enviando..." : `Enviar ${messageMode}`}
              </button>
            </div>
          </section>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/25 p-4" data-testid="waba-messages-panel">
              <div>
                <div className="ui-kicker">Mensajes recientes</div>
              </div>
              <div className="ui-scrollbar grid max-h-[340px] gap-2 overflow-y-auto pr-1">
                {overview?.recentMessages.length ? (
                  overview.recentMessages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="font-semibold text-slate-100">
                          {message.direction} · {message.messageType}
                        </div>
                        <span className={["ui-pill", getStatusTone(message.externalStatus)].join(" ")}>
                          {message.externalStatus ?? "pending"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-200">
                        {message.textBody ?? "Sin texto almacenado."}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        {message.contact.contactName ?? "n/a"} · {formatDateTime(message.createdAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                    Sin mensajes registrados.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/25 p-4" data-testid="waba-events-panel">
              <div>
                <div className="ui-kicker">{isAdminSurface ? "Eventos del canal" : "Entregas"}</div>
              </div>
              <div className="ui-scrollbar grid max-h-[340px] gap-2 overflow-y-auto pr-1">
                {overview?.recentEvents.length ? (
                  overview.recentEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="font-semibold text-slate-100">
                          {formatReviewerEventType(event.eventType)}
                        </div>
                        <span className="ui-pill">{event.deliveryStatus ?? "n/a"}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        {event.contact.contactName ?? "n/a"} · {formatDateTime(event.eventAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                    Sin eventos registrados.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {isAdminSurface ? (
        <div className="mt-4 grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
            Bitácora de sesión
          </p>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
            {events.length === 0 ? (
              <p className="text-xs text-slate-400">Sin eventos locales.</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <p className="text-xs text-slate-100">{event.message}</p>
                  <span className="shrink-0 text-[11px] text-slate-400">{event.at}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
