import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { SessionUser } from "@docket/shared";
import { docsApi } from "@/lib/api";

const YJS_WS_URL = import.meta.env.VITE_YJS_WS_URL ?? "ws://localhost:4001";

export interface DocConnection {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

/**
 * One Yjs document + y-websocket provider per documentId. The room name is the
 * documentId, so the provider connects to `${VITE_YJS_WS_URL}/${documentId}`.
 * The connection is torn down and rebuilt whenever documentId changes. Returns
 * null on the first render while the doc initializes — callers show a loading
 * intent rather than hanging (invariant #2: no silent waits).
 */
export function useDocConnection(
  documentId: string,
  user: SessionUser,
): DocConnection | null {
  const [conn, setConn] = useState<DocConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ydoc: Y.Doc | null = null;
    let provider: WebsocketProvider | null = null;

    // The WS server and the API are separate services once deployed, so a
    // session cookie alone doesn't authorize the connection — fetch a
    // short-lived signed token first (see server/src/yjs/wsToken.ts).
    void docsApi.yjsToken(documentId).then(({ token }) => {
      if (cancelled) return;
      ydoc = new Y.Doc();
      provider = new WebsocketProvider(YJS_WS_URL, documentId, ydoc, {
        connect: true,
        params: { token },
      });
      // Presence for CollaborationCursor.
      provider.awareness.setLocalStateField("user", {
        name: user.name,
        color: user.color,
      });
      setConn({ ydoc, provider });
    });

    return () => {
      cancelled = true;
      provider?.awareness.setLocalState(null);
      provider?.destroy();
      ydoc?.destroy();
      setConn(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return conn;
}

export const PROPOSALS_MAP = "proposals";
export const COMMENTS_MAP = "comments";
export const XML_FRAGMENT = "default";
