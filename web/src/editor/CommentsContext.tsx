import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type * as Y from "yjs";
import type { SessionUser } from "@docket/shared";
import { COMMENTS_MAP } from "@/lib/yjs";

/**
 * MINIMAL comment threads (no Tiptap Pro). Thread records live in a shared
 * Y.Map named `comments` so they sync across tabs/users; the anchoring highlight
 * is a `comment` mark carrying the same threadId. Resolving keeps the record.
 */
export interface CommentEntry {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  quote: string;
  resolved: boolean;
  createdAt: string;
  entries: CommentEntry[];
}

interface CommentsState {
  threads: CommentThread[];
  createThread: (quote: string, body: string) => string;
  reply: (threadId: string, body: string) => void;
  resolve: (threadId: string, resolved: boolean) => void;
}

const Ctx = createContext<CommentsState | null>(null);

function uid(): string {
  return `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function CommentsProvider({
  ydoc,
  user,
  children,
}: {
  ydoc: Y.Doc;
  user: SessionUser;
  children: ReactNode;
}) {
  const store = useRef(new Map<string, CommentThread>());
  const [, force] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const ymap = ydoc.getMap(COMMENTS_MAP);
    const load = () => {
      store.current.clear();
      ymap.forEach((raw) => {
        try {
          const t = (typeof raw === "string" ? JSON.parse(raw) : raw) as CommentThread;
          if (t && typeof t.id === "string") store.current.set(t.id, t);
        } catch {
          /* skip */
        }
      });
      force();
    };
    load();
    ymap.observe(load);
    return () => ymap.unobserve(load);
  }, [ydoc]);

  const write = useCallback(
    (thread: CommentThread) => {
      ydoc.getMap(COMMENTS_MAP).set(thread.id, JSON.stringify(thread));
    },
    [ydoc],
  );

  const createThread = useCallback(
    (quote: string, body: string) => {
      const id = uid();
      const thread: CommentThread = {
        id,
        quote,
        resolved: false,
        createdAt: new Date().toISOString(),
        entries: body.trim()
          ? [
              {
                id: uid(),
                authorId: user.id,
                authorName: user.name,
                body: body.trim(),
                createdAt: new Date().toISOString(),
              },
            ]
          : [],
      };
      write(thread);
      return id;
    },
    [user, write],
  );

  const reply = useCallback(
    (threadId: string, body: string) => {
      const thread = store.current.get(threadId);
      if (!thread || !body.trim()) return;
      const next: CommentThread = {
        ...thread,
        entries: [
          ...thread.entries,
          {
            id: uid(),
            authorId: user.id,
            authorName: user.name,
            body: body.trim(),
            createdAt: new Date().toISOString(),
          },
        ],
      };
      write(next);
    },
    [user, write],
  );

  const resolve = useCallback(
    (threadId: string, resolved: boolean) => {
      const thread = store.current.get(threadId);
      if (!thread) return;
      write({ ...thread, resolved });
    },
    [write],
  );

  const threads = useMemo(() => {
    return Array.from(store.current.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsVersion(store.current)]);

  const value = useMemo<CommentsState>(
    () => ({ threads, createThread, reply, resolve }),
    [threads, createThread, reply, resolve],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function threadsVersion(store: Map<string, CommentThread>): string {
  let acc = "";
  for (const t of store.values()) acc += `|${t.id}:${t.resolved}:${t.entries.length}`;
  return acc;
}

export function useComments(): CommentsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useComments must be used within CommentsProvider");
  return ctx;
}
