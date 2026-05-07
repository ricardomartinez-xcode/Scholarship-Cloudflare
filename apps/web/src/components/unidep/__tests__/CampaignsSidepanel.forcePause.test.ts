import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CAMPAIGNS_SCRIPT_PATH = path.resolve(
  process.cwd(),
  "apps",
  "chrome-extension",
  "recalc-sidepanel",
  "campaigns.js",
);
const CAMPAIGNS_SCRIPT_SOURCE = readFileSync(CAMPAIGNS_SCRIPT_PATH, "utf8");
const PANEL_IDS = Array.from(
  new Set(
    Array.from(
      CAMPAIGNS_SCRIPT_SOURCE.matchAll(/document\.getElementById\("([^"]+)"\)/g),
      (match) => match[1],
    ),
  ),
);

type RunnerState = {
  enabled: boolean;
  campaignId: string;
  runId: string;
  status: string;
  campaignName: string;
  lastMessage: string;
};

class FakeEvent {
  defaultPrevented = false;
  target: unknown = null;
  currentTarget: unknown = null;

  constructor(public readonly type: string) {}

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    return undefined;
  }
}

class FakeClassList {
  private classes = new Set<string>();

  syncFromClassName(value: string) {
    this.classes = new Set(
      String(value ?? "")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  add(...tokens: string[]) {
    tokens.forEach((token) => {
      if (token) this.classes.add(token);
    });
  }

  remove(...tokens: string[]) {
    tokens.forEach((token) => this.classes.delete(token));
  }

  toggle(token: string, force?: boolean) {
    if (force === true) {
      this.classes.add(token);
      return true;
    }
    if (force === false) {
      this.classes.delete(token);
      return false;
    }
    if (this.classes.has(token)) {
      this.classes.delete(token);
      return false;
    }
    this.classes.add(token);
    return true;
  }

  contains(token: string) {
    return this.classes.has(token);
  }

  toString() {
    return Array.from(this.classes).join(" ");
  }
}

class FakeDocumentFragment {
  readonly children: FakeElement[] = [];

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }
}

class FakeElement {
  id = "";
  textContent = "";
  innerHTML = "";
  value = "";
  checked = false;
  disabled = false;
  src = "";
  href = "";
  download = "";
  type = "";
  files: unknown = null;
  dataset: Record<string, string> = {};
  classList = new FakeClassList();
  children: FakeElement[] = [];
  parentNode: FakeElement | null = null;

  private eventListeners = new Map<string, Array<(event: FakeEvent) => void>>();
  private attributes = new Map<string, string>();
  private _className = "";

  constructor(public readonly tagName: string) {}

  set className(value: string) {
    this._className = String(value ?? "");
    this.classList.syncFromClassName(this._className);
  }

  get className() {
    const fromList = this.classList.toString();
    return fromList || this._className;
  }

  appendChild(child: FakeElement) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...items: Array<FakeElement | FakeDocumentFragment>) {
    items.forEach((item) => {
      if (item instanceof FakeDocumentFragment) {
        item.children.forEach((child) => this.appendChild(child));
      } else {
        this.appendChild(item);
      }
    });
  }

  replaceChildren(...items: Array<FakeElement | FakeDocumentFragment>) {
    this.children = [];
    this.append(...items);
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "id") this.id = value;
    if (name.startsWith("data-")) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] =
        value;
    }
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
    if (name === "src") this.src = "";
  }

  addEventListener(type: string, handler: (event: FakeEvent) => void) {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.push(handler);
    this.eventListeners.set(type, listeners);
  }

  dispatchEvent(event: FakeEvent) {
    event.target = this;
    event.currentTarget = this;
    const listeners = this.eventListeners.get(event.type) ?? [];
    listeners.forEach((handler) => handler(event));
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new FakeEvent("click"));
  }
}

class FakeDocument {
  readonly body = new FakeElement("BODY");
  hidden = false;

  private elementsById = new Map<string, FakeElement>();
  private eventListeners = new Map<string, Array<(event: FakeEvent) => void>>();

  registerElement(element: FakeElement) {
    if (element.id) this.elementsById.set(element.id, element);
    this.body.appendChild(element);
  }

  getElementById(id: string) {
    return this.elementsById.get(id) ?? null;
  }

  querySelectorAll(selector: string) {
    if (selector === "[data-tab-target]") {
      return Array.from(this.elementsById.values()).filter(
        (element) => typeof element.dataset.tabTarget === "string",
      );
    }
    if (selector === ".tab-panel") {
      return Array.from(this.elementsById.values()).filter((element) =>
        element.classList.contains("tab-panel"),
      );
    }
    return [];
  }

  createElement(tagName: string) {
    return new FakeElement(String(tagName ?? "div").toUpperCase());
  }

  createDocumentFragment() {
    return new FakeDocumentFragment();
  }

  addEventListener(type: string, handler: (event: FakeEvent) => void) {
    const listeners = this.eventListeners.get(type) ?? [];
    listeners.push(handler);
    this.eventListeners.set(type, listeners);
  }

  dispatchEvent(event: FakeEvent) {
    const listeners = this.eventListeners.get(event.type) ?? [];
    listeners.forEach((handler) => handler(event));
    return !event.defaultPrevented;
  }
}

function buildCampaign(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    campaignName: `Campaña ${id}`,
    status: "queued",
    businessStatus: "queued",
    businessStatusLabel: "En cola",
    scheduleAt: null,
    batchSize: 25,
    messageDelayMs: 4000,
    mediaUrl: null,
    messageTemplate: "",
    notes: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    stats: {
      total: 1,
      queued: 1,
      scheduled: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
    },
    recipients: [],
    ...overrides,
  };
}

function requestPath(input: unknown) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : String((input as { url?: string })?.url ?? "");
  return new URL(raw).pathname;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function flushAsync(iterations = 8) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

describe("campaigns sidepanel force_pause fallback", () => {
  let sendMessageMock = vi.fn();
  let fetchMock = vi.fn();
  let fakeDocument: FakeDocument;
  let runnerState: RunnerState | null = null;
  let stopRunnerError: string | null = null;
  let backendPatchError: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    sendMessageMock = vi.fn();
    fetchMock = vi.fn();
    fakeDocument = new FakeDocument();
    const localStorageMap = new Map<string, string>();
    const fakeWindow = {
      document: fakeDocument,
      localStorage: {
        getItem: (key: string) => localStorageMap.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localStorageMap.set(key, String(value));
        },
      },
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
      confirm: vi.fn(() => true),
    };

    for (const id of PANEL_IDS) {
      const element =
        id === "campaign-form"
          ? fakeDocument.createElement("FORM")
          : id === "campaign-csv" || id === "campaign-image"
            ? fakeDocument.createElement("INPUT")
            : id === "campaign-template" || id === "campaign-recipients"
              ? fakeDocument.createElement("TEXTAREA")
              : fakeDocument.createElement("DIV");
      element.id = id;
      fakeDocument.registerElement(element);
    }

    runnerState = null;
    stopRunnerError = null;
    backendPatchError = null;

    const tokenStorageKey = "recalc.extensionSessionToken";
    const chromeMock = {
      runtime: {
        sendMessage: sendMessageMock,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ [tokenStorageKey]: "token_test" }),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
    };

    vi.stubGlobal("Event", FakeEvent);
    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("chrome", chromeMock);

    sendMessageMock.mockImplementation(async (payload: { type?: string }) => {
      if (payload?.type === "GET_CAMPAIGN_STATUS") {
        return { ok: true, runner: runnerState };
      }
      if (payload?.type === "STOP_CAMPAIGN") {
        if (stopRunnerError) return { ok: false, error: stopRunnerError };
        return { ok: true };
      }
      return { ok: true };
    });

    fetchMock.mockImplementation(
      async (input: unknown, init?: RequestInit) => {
        const pathname = requestPath(input);
        const method = String(init?.method ?? "GET").toUpperCase();
        if (pathname === "/api/ext/bootstrap") {
          return jsonResponse({ ok: true, selectorPack: null });
        }
        if (pathname === "/api/ext/campaigns" && method === "GET") {
          return jsonResponse({
            ok: true,
            campaigns: [buildCampaign("camp-selected")],
          });
        }
        if (/^\/api\/ext\/campaigns\/[^/]+$/.test(pathname) && method === "PATCH") {
          if (backendPatchError) {
            return jsonResponse({ ok: false, error: backendPatchError }, 400);
          }
          const campaignId = pathname.split("/").pop() ?? "camp-selected";
          return jsonResponse({
            ok: true,
            campaign: buildCampaign(campaignId, { status: "paused" }),
          });
        }
        return jsonResponse({ ok: true });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await import(`${pathToFileURL(CAMPAIGNS_SCRIPT_PATH).href}?t=${Date.now()}`);
    fakeDocument.dispatchEvent(new FakeEvent("DOMContentLoaded"));
    await flushAsync();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa fallback de campaña seleccionada y degrada a warning/danger según fallos locales/backend", async () => {
    const stopRunnerButton = fakeDocument.getElementById("campaign-stop-runner");
    const feedback = fakeDocument.getElementById("campaign-feedback");
    expect(stopRunnerButton).toBeTruthy();
    expect(feedback).toBeTruthy();

    const patchedCampaignIdsFromCalls = () =>
      fetchMock.mock.calls
        .filter(([, init]) => String(init?.method ?? "GET").toUpperCase() === "PATCH")
        .map(([input]) => requestPath(input).split("/").pop());

    runnerState = null;
    stopRunnerError = null;
    backendPatchError = null;
    fetchMock.mockClear();
    stopRunnerButton?.click();
    await flushAsync();

    expect(patchedCampaignIdsFromCalls()).toEqual(["camp-selected"]);

    runnerState = {
      enabled: true,
      campaignId: "camp-runner",
      runId: "run_1",
      status: "running",
      campaignName: "Campaña runner",
      lastMessage: "Runner activo",
    };
    stopRunnerError = "Runner ocupado.";
    backendPatchError = null;
    fetchMock.mockClear();
    fakeDocument.dispatchEvent(new FakeEvent("visibilitychange"));
    await flushAsync();
    stopRunnerButton?.click();
    await flushAsync();

    expect(patchedCampaignIdsFromCalls()).toEqual(["camp-runner"]);
    const messageTypes = sendMessageMock.mock.calls
      .map((call) => call[0])
      .map((payload) => payload?.type)
      .filter(Boolean);
    expect(messageTypes).toContain("STOP_CAMPAIGN");

    backendPatchError = "Backend no disponible.";
    fetchMock.mockClear();
    stopRunnerButton?.click();
    await flushAsync();

    expect(patchedCampaignIdsFromCalls()).toEqual(["camp-runner"]);
    expect(feedback?.textContent).toContain("Backend no disponible.");
  });
});
