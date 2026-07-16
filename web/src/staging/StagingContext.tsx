import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type * as Y from "yjs";
import type { DiffProposal } from "@docket/shared";
import { proposalsApi } from "@/lib/api";
import { PROPOSALS_MAP } from "@/lib/yjs";

/**
 * Single source of truth for DiffProposals in the current document. Proposals
 * arrive three ways, all merged by id into one store:
 *   1. initial GET /api/documents/:id/proposals
 *   2. the shared Y.Map `proposals` (authoritative; server writes on every
 *      status change so all tabs stay in sync without polling)
 *   3. local streaming upserts from an in-flight agent run (SSE hunk_delta)
 * The UI never mutates the live doc — it only reflects status changes that
 * arrive here (invariant #1).
 */
interface StagingState {
  proposals: DiffProposal[];
  activeId: string | null;
  setActive: (id: string | null) => void;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  editAccept: (id: string, editedText: string) => Promise<void>;
  /** Streaming preview upsert (from the agent run before it hits the Y.Map). */
  upsertLocal: (p: DiffProposal) => void;
  /** Discard a streaming-only preview that got blocked and will never complete. */
  discardLocal: (id: string) => void;
  /** Pending action id, for disabling buttons mid-request. */
  pendingId: string | null;
  /** Force a resync against the server (manual refresh control). */
  refresh: () => Promise<void>;
  refreshing: boolean;
}

const Ctx = createContext<StagingState | null>(null);

function parseProposal(raw: unknown): DiffProposal | null {
  try {
    const obj = typeof raw === "string" ? (JSON.parse(raw) as DiffProposal) : (raw as DiffProposal);
    if (obj && typeof obj.id === "string") return obj;
  } catch {
    /* ignore malformed entry */
  }
  return null;
}

export function StagingProvider({
  ydoc,
  documentId,
  children,
}: {
  ydoc: Y.Doc;
  documentId: string;
  children: ReactNode;
}) {
  const store = useRef(new Map<string, DiffProposal>());
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [activeId, setActive] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const upsert = useCallback((p: DiffProposal) => {
    store.current.set(p.id, p);
    force();
  }, []);

  const upsertLocal = useCallback(
    (p: DiffProposal) => {
      // Never downgrade a proposal already finalized by the authoritative map.
      const existing = store.current.get(p.id);
      if (existing && existing.status !== "streaming" && p.status === "streaming") return;
      upsert(p);
    },
    [upsert],
  );

  const discardLocal = useCallback((id: string) => {
    // Only ever removes a client-only "streaming" preview that turned out to
    // be blocked server-side (hunk_complete will never arrive for it, so it
    // would otherwise sit stuck in "streaming" forever). Never removes a
    // proposal the server has actually persisted/broadcast — invariant #3
    // (rejected proposals stay visible) only applies to real, staged
    // proposals, not to a preview that was never staged in the first place.
    const existing = store.current.get(id);
    if (existing && existing.status === "streaming") {
      store.current.delete(id);
      force();
    }
  }, []);

  // Initial load + live Y.Map subscription.
  useEffect(() => {
    let alive = true;
    const ymap = ydoc.getMap(PROPOSALS_MAP);

    // Seed from whatever is already in the shared map.
    ymap.forEach((raw) => {
      const p = parseProposal(raw);
      if (p) store.current.set(p.id, p);
    });
    force();

    // Then merge the REST snapshot (does not clobber newer map entries).
    proposalsApi
      .list(documentId)
      .then((list) => {
        if (!alive) return;
        for (const p of list) {
          if (!store.current.has(p.id)) store.current.set(p.id, p);
        }
        force();
      })
      .catch(() => {
        /* feed shows its own empty/error state */
      });

    const handler = (event: Y.YMapEvent<unknown>) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          // Invariant #3: rejected proposals are never deleted from the feed.
          // A map removal only drops the live-sync copy; keep any local record.
          return;
        }
        const p = parseProposal(ymap.get(key));
        if (p) store.current.set(p.id, p);
      });
      force();
    };
    ymap.observe(handler);

    return () => {
      alive = false;
      ymap.unobserve(handler);
    };
  }, [ydoc, documentId]);

  const accept = useCallback(
    async (id: string) => {
      setPendingId(id);
      try {
        const { proposal } = await proposalsApi.accept(id);
        upsert(proposal); // optimistic; Y.Map will confirm
      } finally {
        setPendingId(null);
      }
    },
    [upsert],
  );

  const reject = useCallback(
    async (id: string) => {
      setPendingId(id);
      try {
        const { proposal } = await proposalsApi.reject(id);
        upsert(proposal);
      } finally {
        setPendingId(null);
      }
    },
    [upsert],
  );

  const editAccept = useCallback(
    async (id: string, editedText: string) => {
      setPendingId(id);
      try {
        const { proposal } = await proposalsApi.editAccept(id, editedText);
        upsert(proposal);
      } finally {
        setPendingId(null);
      }
    },
    [upsert],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await proposalsApi.list(documentId);
      for (const p of list) upsert(p); // server is authoritative on an explicit refresh
    } finally {
      setRefreshing(false);
    }
  }, [documentId, upsert]);

  const proposals = useMemo(() => {
    return Array.from(store.current.values()).sort((a, b) => {
      // Newest runs first; stable within a run by hunkIndex.
      const t = b.createdAt.localeCompare(a.createdAt);
      return t !== 0 ? t : a.hunkIndex - b.hunkIndex;
    });
    // store is a ref; force() bumps the reducer which re-runs this memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeVersion(store.current)]);

  const value = useMemo<StagingState>(
    () => ({
      proposals,
      activeId,
      setActive,
      accept,
      reject,
      editAccept,
      upsertLocal,
      discardLocal,
      pendingId,
      refresh,
      refreshing,
    }),
    [proposals, activeId, accept, reject, editAccept, upsertLocal, discardLocal, pendingId, refresh, refreshing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Cheap change token so the proposals memo recomputes after force(). */
function storeVersion(store: Map<string, DiffProposal>): string {
  let acc = `${store.size}`;
  for (const p of store.values()) acc += `|${p.id}:${p.status}:${p.newText.length}`;
  return acc;
}

export function useStaging(): StagingState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStaging must be used within StagingProvider");
  return ctx;
}
