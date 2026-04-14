import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearLegacyGalleryLocalStorage, readLegacyClientUiFromLocalStorage } from '@/lib/galleryFilterPrefs';
import { defaultClientUi, normalizeClientUi } from '@/lib/galleryPrefsModel';
import { normalizeBooking, normalizeBookings } from '@/lib/bookingUtils';
import { loadBookings, saveBookings } from '@/lib/storage';
import { SYNC_INTERVAL_MS } from '@/lib/syncConstants';
import { newId } from '@/lib/id';

/**
 * @typedef {{ tempId: string, body: { label: string, type: string, iconKey: string | null } }} FieldCreateOp
 */

function cloneJson(x) {
  return JSON.parse(JSON.stringify(x));
}

/**
 * @param {Record<string, unknown> | undefined} a
 * @param {Record<string, unknown>} b
 */
function mergeFieldPatch(a, b) {
  const base = a && typeof a === 'object' ? { ...a } : {};
  const out = { ...base, ...b };
  if (b.options !== undefined) out.options = b.options;
  return out;
}

/**
 * Загрузка с API, локальные правки, фоновый сброс на сервер раз в SYNC_INTERVAL_MS.
 */
export function useBookingsAndFields() {
  const [bookings, setBookings] = useState(/** @type {ReturnType<typeof normalizeBooking>[]} */ ([]));
  const [fields, setFields] = useState(/** @type {any[]} */ ([]));
  const [clientUi, setClientUi] = useState(() => defaultClientUi());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(/** @type {Error | null} */ (null));
  const [syncStatus, setSyncStatus] = useState(/** @type {'synced' | 'pending' | 'syncing' | 'error'} */ ('synced'));
  const [syncError, setSyncError] = useState(/** @type {string | null} */ (null));

  const clientUiRef = useRef(/** @type {ReturnType<typeof defaultClientUi>} */ (defaultClientUi()));
  const serverBookingIdsRef = useRef(/** @type {Set<string>} */ (new Set()));

  const dirtyUiRef = useRef(false);
  const bookingPayloadsRef = useRef(/** @type {Map<string, Record<string, unknown>>} */ (new Map()));
  const pendingBookingDeletesRef = useRef(/** @type {Set<string>} */ (new Set()));

  const fieldCreatesRef = useRef(/** @type {FieldCreateOp[]} */ ([]));
  const fieldPatchByIdRef = useRef(/** @type {Map<string, Record<string, unknown>>} */ (new Map()));
  const fieldDeletesRef = useRef(/** @type {Set<string>} */ (new Set()));
  const fieldReorderIdsRef = useRef(/** @type {string[] | null} */ (null));

  const flushRunningRef = useRef(false);
  const flushChainRef = useRef(Promise.resolve());

  const markPending = useCallback(() => {
    setSyncStatus((s) => (s === 'error' ? s : 'pending'));
  }, []);

  const hasOutboundWork = useCallback(() => {
    if (dirtyUiRef.current) return true;
    if (bookingPayloadsRef.current.size > 0) return true;
    if (pendingBookingDeletesRef.current.size > 0) return true;
    if (fieldCreatesRef.current.length > 0) return true;
    if (fieldPatchByIdRef.current.size > 0) return true;
    if (fieldDeletesRef.current.size > 0) return true;
    if (fieldReorderIdsRef.current !== null) return true;
    return false;
  }, []);

  const runFlush = useCallback(async () => {
    if (flushRunningRef.current) return;
    if (!hasOutboundWork()) {
      setSyncStatus('synced');
      return;
    }
    flushRunningRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      // --- clientUi ---
      if (dirtyUiRef.current) {
        const snap = cloneJson(clientUiRef.current);
        const saved = await apiFetch('/api/user/ui-prefs', {
          method: 'PUT',
          body: JSON.stringify(snap),
        });
        setClientUi((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(snap)) {
            dirtyUiRef.current = true;
            return prev;
          }
          dirtyUiRef.current = false;
          clientUiRef.current = saved;
          return saved;
        });
      }

      // --- fields: remap helper ---
      /** @param {string} oldId @param {any} row */
      const remapFieldIdEverywhere = (oldId, row) => {
        const newId_ = row.id;
        setFields((prev) =>
          prev.map((f) => (f.id === oldId ? row : f)).sort((a, b) => a.sortOrder - b.sortOrder),
        );
        const pm = fieldPatchByIdRef.current;
        if (pm.has(oldId)) {
          const p = pm.get(oldId);
          pm.delete(oldId);
          pm.set(newId_, p);
        }
        if (fieldDeletesRef.current.has(oldId)) {
          fieldDeletesRef.current.delete(oldId);
          fieldDeletesRef.current.add(newId_);
        }
        const r = fieldReorderIdsRef.current;
        if (r) {
          fieldReorderIdsRef.current = r.map((id) => (id === oldId ? newId_ : id));
        }
      };

      // compact: удаление несинхронизированного поля — убрать create
      const creates = fieldCreatesRef.current;
      for (let i = creates.length - 1; i >= 0; i--) {
        const c = creates[i];
        if (fieldDeletesRef.current.has(c.tempId)) {
          setFields((prev) => prev.filter((f) => f.id !== c.tempId));
          fieldPatchByIdRef.current.delete(c.tempId);
          fieldDeletesRef.current.delete(c.tempId);
          creates.splice(i, 1);
        }
      }

      // creates (POST)
      while (creates.length > 0) {
        const c = creates[0];
        if (fieldDeletesRef.current.has(c.tempId)) {
          creates.shift();
          continue;
        }
        const row = await apiFetch('/api/fields', {
          method: 'POST',
          body: JSON.stringify(c.body),
        });
        creates.shift();
        remapFieldIdEverywhere(c.tempId, row);
      }

      // patches
      const patchKeysSnapshot = [...fieldPatchByIdRef.current.keys()];
      for (const fid of patchKeysSnapshot) {
        if (!fieldPatchByIdRef.current.has(fid)) continue;
        if (fieldDeletesRef.current.has(fid)) {
          fieldPatchByIdRef.current.delete(fid);
          continue;
        }
        const patch = fieldPatchByIdRef.current.get(fid);
        if (!patch || Object.keys(patch).length === 0) {
          fieldPatchByIdRef.current.delete(fid);
          continue;
        }
        const row = await apiFetch(`/api/fields/${fid}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        fieldPatchByIdRef.current.delete(fid);
        setFields((prev) =>
          prev.map((f) => (f.id === fid ? row : f)).sort((a, b) => a.sortOrder - b.sortOrder),
        );
      }

      // deletes
      for (const fid of [...fieldDeletesRef.current]) {
        if (fid.startsWith('tmpfld_')) {
          fieldDeletesRef.current.delete(fid);
          fieldPatchByIdRef.current.delete(fid);
          continue;
        }
        await apiFetch(`/api/fields/${fid}`, { method: 'DELETE' });
        fieldDeletesRef.current.delete(fid);
        fieldPatchByIdRef.current.delete(fid);
      }

      // reorder
      const reorder = fieldReorderIdsRef.current;
      if (reorder && reorder.length > 0) {
        await apiFetch('/api/fields/reorder', {
          method: 'PUT',
          body: JSON.stringify({ ids: reorder }),
        });
        fieldReorderIdsRef.current = null;
      }

      // --- bookings: убрать «удалить до синка» ---
      for (const id of [...pendingBookingDeletesRef.current]) {
        if (!serverBookingIdsRef.current.has(id)) {
          pendingBookingDeletesRef.current.delete(id);
          bookingPayloadsRef.current.delete(id);
        }
      }

      // upserts (снимок ключей — записи могут сниматься по мере успеха)
      const upsertIds = [...bookingPayloadsRef.current.keys()];
      for (const bid of upsertIds) {
        if (pendingBookingDeletesRef.current.has(bid)) continue;
        const payload = bookingPayloadsRef.current.get(bid);
        if (!payload) continue;
        const isNew = !serverBookingIdsRef.current.has(bid);
        const path = isNew ? '/api/bookings' : `/api/bookings/${bid}`;
        const method = isNew ? 'POST' : 'PUT';
        const saved = await apiFetch(path, { method, body: JSON.stringify(payload) });
        const n = normalizeBooking(saved);
        if (n) {
          serverBookingIdsRef.current.add(n.id);
          bookingPayloadsRef.current.delete(bid);
          setBookings((prev) => {
            const other = prev.filter((b) => b.id !== n.id);
            return [...other, n].sort((a, b) => a.date.localeCompare(b.date));
          });
        }
      }

      // deletes
      for (const bid of [...pendingBookingDeletesRef.current]) {
        await apiFetch(`/api/bookings/${bid}`, { method: 'DELETE' });
        serverBookingIdsRef.current.delete(bid);
        pendingBookingDeletesRef.current.delete(bid);
        bookingPayloadsRef.current.delete(bid);
      }

      setSyncStatus(hasOutboundWork() ? 'pending' : 'synced');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncError(msg);
      setSyncStatus('error');
    } finally {
      flushRunningRef.current = false;
    }
  }, [hasOutboundWork]);

  const flushNow = useCallback(() => {
    const next = flushChainRef.current.then(() => runFlush());
    flushChainRef.current = next.catch(() => {});
    return next;
  }, [runFlush]);

  useEffect(() => {
    const id = setInterval(() => {
      void flushNow();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flushNow]);

  /** @param {ReturnType<typeof defaultClientUi> | ((prev: ReturnType<typeof defaultClientUi>) => ReturnType<typeof defaultClientUi>)} nextOrUpdater */
  const updateClientUi = useCallback(
    (nextOrUpdater) => {
      setClientUi((prev) => {
        const next =
          typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
        clientUiRef.current = next;
        return next;
      });
      dirtyUiRef.current = true;
      markPending();
    },
    [markPending],
  );

  const refreshFields = useCallback(async () => {
    const list = await apiFetch('/api/fields');
    const sorted = list.sort((a, b) => a.sortOrder - b.sortOrder);
    fieldCreatesRef.current = [];
    fieldPatchByIdRef.current.clear();
    fieldDeletesRef.current.clear();
    fieldReorderIdsRef.current = null;
    startTransition(() => {
      setFields(sorted);
    });
  }, []);

  const refreshBookings = useCallback(async () => {
    const list = await apiFetch('/api/bookings');
    const norm = normalizeBookings(list);
    serverBookingIdsRef.current = new Set(norm.map((b) => b.id));
    bookingPayloadsRef.current.clear();
    pendingBookingDeletesRef.current.clear();
    startTransition(() => {
      setBookings(norm);
    });
  }, []);

  const refreshClientUi = useCallback(async () => {
    const r = await apiFetch('/api/user/ui-prefs');
    dirtyUiRef.current = false;
    const merged = normalizeClientUi(r.clientUi ?? {});
    setClientUi(merged);
    clientUiRef.current = merged;
  }, []);

  /**
   * Локально применить черновик записи и поставить в очередь синка.
   * @param {Record<string, unknown>} draft
   */
  const applyBookingLocal = useCallback(
    (draft) => {
      const id = typeof draft.id === 'string' ? draft.id : '';
      if (!id) return;
      const copy = cloneJson(draft);
      bookingPayloadsRef.current.set(id, copy);
      setBookings((prev) => {
        const other = prev.filter((b) => b.id !== id);
        const n = normalizeBooking(copy);
        if (!n) return prev;
        return [...other, n].sort((a, b) => a.date.localeCompare(b.date));
      });
      markPending();
    },
    [markPending],
  );

  /**
   * @param {string} id
   */
  const deleteBookingLocal = useCallback(
    (id) => {
      pendingBookingDeletesRef.current.add(id);
      bookingPayloadsRef.current.delete(id);
      setBookings((prev) => prev.filter((b) => b.id !== id));
      markPending();
    },
    [markPending],
  );

  /**
   * @param {Record<string, unknown>} booking
   * @param {boolean} _isNew
   * @param {{ silent?: boolean }} [_options]
   */
  const saveBooking = useCallback(
    async (booking, _isNew, _options = {}) => {
      applyBookingLocal(booking);
    },
    [applyBookingLocal],
  );

  const removeBooking = useCallback(
    async (id) => {
      deleteBookingLocal(id);
    },
    [deleteBookingLocal],
  );

  /**
   * @param {string} id
   * @param {Record<string, unknown>} partial — тело PATCH
   */
  const patchFieldLocal = useCallback(
    (id, partial) => {
      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const merged = { ...f };
          for (const [k, v] of Object.entries(partial)) {
            if (k === 'options' && v && typeof v === 'object') merged.options = v;
            else merged[k] = v;
          }
          return merged;
        }),
      );
      const cur = fieldPatchByIdRef.current.get(id) || {};
      fieldPatchByIdRef.current.set(id, mergeFieldPatch(cur, partial));
      markPending();
    },
    [markPending],
  );

  /**
   * @param {{ label: string, type: string, iconKey: string | null }} body
   * @returns {string} tempId
   */
  const createFieldLocal = useCallback(
    (body) => {
      const tempId = `tmpfld_${newId()}`;
      setFields((prev) => {
        const maxOrder = prev.reduce((m, f) => Math.max(m, f.sortOrder ?? 0), -1);
        /** @type {any} */
        const optimistic = {
          id: tempId,
          userId: '',
          key: `tmp_${tempId.slice(0, 12)}`,
          label: body.label.trim(),
          type: body.type,
          sortOrder: maxOrder + 1,
          system: false,
          visible: true,
          iconKey: body.iconKey && body.iconKey.trim() ? body.iconKey.trim() : null,
          options:
            body.type === 'select' || body.type === 'multiselect'
              ? { items: [{ id: newId(), label: 'Вариант 1', color: 'gray' }] }
              : null,
        };
        return [...prev, optimistic].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      fieldCreatesRef.current.push({
        tempId,
        body: { label: body.label.trim(), type: body.type, iconKey: body.iconKey || null },
      });
      markPending();
      return tempId;
    },
    [markPending],
  );

  /**
   * @param {string} id
   */
  const deleteFieldLocal = useCallback(
    (id) => {
      setFields((prev) => prev.filter((f) => f.id !== id));
      fieldPatchByIdRef.current.delete(id);
      const creates = fieldCreatesRef.current;
      for (let i = creates.length - 1; i >= 0; i--) {
        if (creates[i].tempId === id) creates.splice(i, 1);
      }
      fieldDeletesRef.current.add(id);
      markPending();
    },
    [markPending],
  );

  /**
   * @param {any[]} sortedFields полный отсортированный список после drag
   */
  const reorderFieldsLocal = useCallback(
    (sortedFields) => {
      const withOrder = sortedFields.map((f, i) => ({ ...f, sortOrder: i }));
      const ids = withOrder.map((f) => f.id);
      setFields(withOrder);
      fieldReorderIdsRef.current = ids;
      markPending();
    },
    [markPending],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiFetch('/api/health');
        let list = await apiFetch('/api/bookings');
        const [flds, uiPack] = await Promise.all([apiFetch('/api/fields'), apiFetch('/api/user/ui-prefs')]);

        if (!cancelled && Array.isArray(list) && list.length === 0) {
          const raw = loadBookings();
          if (raw?.length) {
            const norm = normalizeBookings(raw);
            try {
              const migrated = await apiFetch('/api/bookings/migrate', {
                method: 'POST',
                body: JSON.stringify({ bookings: norm }),
              });
              list = migrated.bookings || [];
              saveBookings([]);
            } catch {
              /* оставляем пусто */
            }
          }
        }

        let nextUi = uiPack.clientUi;
        if (!uiPack.persisted) {
          const legacy = readLegacyClientUiFromLocalStorage();
          if (legacy) {
            try {
              await apiFetch('/api/user/ui-prefs', { method: 'PUT', body: JSON.stringify(legacy) });
              clearLegacyGalleryLocalStorage();
              const again = await apiFetch('/api/user/ui-prefs');
              nextUi = again.clientUi;
            } catch {
              /* оставляем с сервера */
            }
          }
        }

        if (cancelled) return;
        const norm = normalizeBookings(list);
        serverBookingIdsRef.current = new Set(norm.map((b) => b.id));
        setBookings(norm);
        setFields((flds || []).sort((a, b) => a.sortOrder - b.sortOrder));
        const mergedUi = normalizeClientUi(nextUi ?? {});
        setClientUi(mergedUi);
        clientUiRef.current = mergedUi;
        setError(null);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
    setSyncStatus((s) => (s === 'error' ? 'pending' : s));
  }, []);

  return {
    bookings,
    fields,
    clientUi,
    updateClientUi,
    refreshClientUi,
    ready,
    error,
    refreshBookings,
    refreshFields,
    saveBooking,
    removeBooking,
    applyBookingLocal,
    deleteBookingLocal,
    flushNow,
    patchFieldLocal,
    createFieldLocal,
    deleteFieldLocal,
    reorderFieldsLocal,
    syncStatus,
    syncError,
    clearSyncError,
    hasPendingWork: hasOutboundWork,
  };
}
