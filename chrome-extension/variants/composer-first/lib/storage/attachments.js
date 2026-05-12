(function attachRecalcAttachmentStore(globalScope) {
  const STORAGE_KEY = "recalc.attachments.meta";
  const DB_NAME = "recalc-attachments";
  const DB_VERSION = 1;
  const STORE_NAME = "blobs";
  const MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;
  const ORPHAN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function getChromeStorage() {
    const storage = globalScope.chrome?.storage?.local;
    if (!storage) {
      throw new Error("chrome.storage.local no está disponible.");
    }
    return storage;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function randomId(prefix) {
    const chunk = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now()}_${chunk}`;
  }

  function formatBytes(size) {
    const value = Number(size || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function extensionFromName(name) {
    const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function classifyAttachment(fileLike) {
    const mime = String(fileLike?.type || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "document";
  }

  function isBlockedExecutable(extension, mime) {
    return [
      "exe",
      "msi",
      "bat",
      "cmd",
      "com",
      "scr",
      "ps1",
      "vbs",
      "js",
      "jar",
    ].includes(extension) || mime === "application/x-msdownload";
  }

  function validateFile(file) {
    if (!(file instanceof File)) {
      return { valid: false, code: "unsupported_type", message: "Solo se pueden adjuntar archivos reales desde tu equipo." };
    }

    if (!file.size) {
      return { valid: false, code: "size_not_supported", message: `El archivo ${file.name} está vacío.` };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        code: "size_not_supported",
        message: `El archivo ${file.name} pesa ${formatBytes(file.size)} y supera el límite de ${formatBytes(MAX_FILE_SIZE_BYTES)} por archivo.`,
      };
    }

    const mime = String(file.type || "").toLowerCase();
    const extension = extensionFromName(file.name);
    if (isBlockedExecutable(extension, mime)) {
      return {
        valid: false,
        code: "unsupported_type",
        message: `El tipo de archivo ${file.name} no está soportado por seguridad.`,
      };
    }

    return { valid: true, code: "ok", message: "" };
  }

  function validateFiles(files) {
    const accepted = [];
    const rejected = [];

    Array.from(files || []).forEach((file) => {
      const result = validateFile(file);
      if (result.valid) {
        accepted.push(file);
      } else {
        rejected.push({
          fileName: String(file?.name || "archivo"),
          code: result.code,
          message: result.message,
        });
      }
    });

    return { accepted, rejected };
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error || new Error("No fue posible abrir IndexedDB."));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function withStore(mode, worker) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let settled = false;

      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(undefined);
        }
      };
      transaction.onerror = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error || new Error("Falló la operación en IndexedDB."));
        }
      };

      Promise.resolve(worker(store, transaction))
        .then((value) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        })
        .finally(() => db.close());
    });
  }

  async function getMetaMap() {
    const storage = getChromeStorage();
    const data = await storage.get([STORAGE_KEY]);
    const meta = data?.[STORAGE_KEY];
    return meta && typeof meta === "object" ? meta : {};
  }

  async function setMetaMap(nextValue) {
    const storage = getChromeStorage();
    await storage.set({ [STORAGE_KEY]: nextValue });
  }

  function toMetaRecord(draftId, file) {
    return {
      attachmentId: randomId("attachment"),
      blobId: randomId("blob"),
      draftId,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      lastModified: file.lastModified || Date.now(),
      kind: classifyAttachment(file),
      createdAt: nowIso(),
    };
  }

  async function putBlob(blobId, file) {
    await withStore("readwrite", (store) => {
      store.put({
        id: blobId,
        blob: new Blob([file], { type: file.type || "application/octet-stream" }),
        name: file.name,
        type: file.type || "application/octet-stream",
        lastModified: file.lastModified || Date.now(),
      });
    });
  }

  async function getBlobRecord(blobId) {
    return withStore("readonly", (store) => new Promise((resolve, reject) => {
      const request = store.get(blobId);
      request.onerror = () => reject(request.error || new Error("No fue posible leer el adjunto."));
      request.onsuccess = () => resolve(request.result || null);
    }));
  }

  async function deleteBlob(blobId) {
    return withStore("readwrite", (store) => new Promise((resolve, reject) => {
      const request = store.delete(blobId);
      request.onerror = () => reject(request.error || new Error("No fue posible eliminar el blob."));
      request.onsuccess = () => resolve(true);
    }));
  }

  async function getAttachmentMeta(draftId) {
    const metaMap = await getMetaMap();
    const list = Array.isArray(metaMap?.[draftId]) ? metaMap[draftId] : [];
    return list.slice().sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  }

  async function saveAttachments(draftId, files) {
    const normalizedDraftId = String(draftId || "").trim();
    if (!normalizedDraftId) {
      throw new Error("Debes indicar un draftId para guardar adjuntos.");
    }

    const { accepted, rejected } = validateFiles(files);
    if (!accepted.length && rejected.length) {
      return { saved: [], rejected };
    }

    const metaMap = await getMetaMap();
    const current = Array.isArray(metaMap[normalizedDraftId]) ? metaMap[normalizedDraftId].slice() : [];
    const saved = [];

    for (const file of accepted) {
      const record = toMetaRecord(normalizedDraftId, file);
      await putBlob(record.blobId, file);
      current.push(record);
      saved.push(record);
    }

    metaMap[normalizedDraftId] = current;
    await setMetaMap(metaMap);
    return { saved, rejected };
  }

  async function getAttachments(draftId) {
    const meta = await getAttachmentMeta(draftId);
    const files = [];

    for (const item of meta) {
      const blobRecord = await getBlobRecord(item.blobId);
      if (!blobRecord?.blob) continue;
      files.push(
        new File([blobRecord.blob], item.name, {
          type: item.type || blobRecord.type || "application/octet-stream",
          lastModified: item.lastModified || blobRecord.lastModified || Date.now(),
        }),
      );
    }

    return files;
  }

  async function removeAttachment(draftId, attachmentId) {
    const normalizedDraftId = String(draftId || "").trim();
    const normalizedAttachmentId = String(attachmentId || "").trim();
    if (!normalizedDraftId || !normalizedAttachmentId) return [];

    const metaMap = await getMetaMap();
    const current = Array.isArray(metaMap[normalizedDraftId]) ? metaMap[normalizedDraftId] : [];
    const target = current.find((item) => item.attachmentId === normalizedAttachmentId);
    if (!target) return current;

    metaMap[normalizedDraftId] = current.filter((item) => item.attachmentId !== normalizedAttachmentId);
    if (!metaMap[normalizedDraftId].length) {
      delete metaMap[normalizedDraftId];
    }
    await setMetaMap(metaMap);
    await deleteBlob(target.blobId);
    return Array.isArray(metaMap[normalizedDraftId]) ? metaMap[normalizedDraftId] : [];
  }

  async function clearAttachments(draftId) {
    const normalizedDraftId = String(draftId || "").trim();
    if (!normalizedDraftId) return;

    const metaMap = await getMetaMap();
    const current = Array.isArray(metaMap[normalizedDraftId]) ? metaMap[normalizedDraftId] : [];
    for (const item of current) {
      await deleteBlob(item.blobId);
    }
    delete metaMap[normalizedDraftId];
    await setMetaMap(metaMap);
  }

  async function cleanOrphanedAttachments(options) {
    const keepDraftIds = Array.isArray(options?.keepDraftIds)
      ? options.keepDraftIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const metaMap = await getMetaMap();
    const keep = new Set(keepDraftIds);
    const nextMeta = {};

    for (const [draftId, entries] of Object.entries(metaMap)) {
      const safeEntries = Array.isArray(entries) ? entries : [];
      if (keep.has(draftId)) {
        nextMeta[draftId] = safeEntries;
        continue;
      }

      const newest = safeEntries.reduce((acc, item) => Math.max(acc, Date.parse(item?.createdAt || "") || 0), 0);
      if (Date.now() - newest < ORPHAN_TTL_MS) {
        nextMeta[draftId] = safeEntries;
        continue;
      }

      for (const item of safeEntries) {
        await deleteBlob(item.blobId);
      }
    }

    await setMetaMap(nextMeta);
  }

  globalScope.RecalcAttachmentStore = {
    STORAGE_KEY,
    MAX_FILE_SIZE_BYTES,
    classifyAttachment,
    formatBytes,
    validateFile,
    validateFiles,
    saveAttachments,
    getAttachmentMeta,
    getAttachments,
    removeAttachment,
    clearAttachments,
    cleanOrphanedAttachments,
  };
})(typeof self !== "undefined" ? self : window);
