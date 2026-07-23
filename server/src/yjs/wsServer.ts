import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../db.js";
import { getTenantClient } from "../tenantDb.js";
import { getDoc, whenLoaded } from "./docStore.js";
import { verifyWsToken } from "./wsToken.js";

/**
 * Minimal y-websocket-compatible server built on y-protocols. One room per
 * documentId (path = /<documentId>), so per-doc rooms are isolated.
 *
 * Every connection must carry a `?token=` query param minted by
 * GET /api/documents/:id/yjs-token (see wsToken.ts for why: this process and
 * the REST API are separate services/domains once deployed, so a session
 * cookie set by the API doesn't reach this WS upgrade request the way it
 * would if everything were one process). The token's organizationId is what
 * lets this process resolve the correct tenant database to persist into —
 * there's no other way to go from a bare documentId to an organization (see
 * docStore.ts's header comment).
 */

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Set<WebSocket>;
}

const rooms = new Map<string, Room>();

function getRoom(tenantDb: PrismaClient, documentId: string): Room {
  let room = rooms.get(documentId);
  if (room) return room;
  const doc = getDoc(tenantDb, documentId);
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);
  room = { doc, awareness, conns: new Set() };

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeUpdate(enc, update);
    const msg = encoding.toUint8Array(enc);
    room!.conns.forEach((conn) => {
      if (conn !== origin && conn.readyState === WebSocket.OPEN) conn.send(msg);
    });
  });

  awareness.on(
    "update",
    ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      const changed = added.concat(updated, removed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      const msg = encoding.toUint8Array(enc);
      room!.conns.forEach((conn) => {
        if (conn.readyState === WebSocket.OPEN) conn.send(msg);
      });
    },
  );

  rooms.set(documentId, room);
  return room;
}

async function resolveTenantDb(organizationId: string): Promise<PrismaClient> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, databaseUrlEnc: true },
  });
  if (!org) throw new Error(`Organization ${organizationId} not found`);
  return getTenantClient(org);
}

export function attachYjsWebSocket(wss: WebSocketServer): void {
  wss.on("connection", async (conn: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? "/";
    const [pathPart, queryPart] = url.slice(1).split("?");
    const documentId = pathPart || "default";
    const token = new URLSearchParams(queryPart ?? "").get("token");
    // Connection-level events only — never log token contents or document text.
    console.log(`[yjs] connection attempt documentId=${documentId} hasToken=${Boolean(token)}`);

    const payload = token ? verifyWsToken(token) : null;
    if (!payload || payload.documentId !== documentId) {
      console.log(`[yjs] rejecting documentId=${documentId}: ${!token ? "no token" : !payload ? "invalid/expired token" : "token documentId mismatch"}`);
      conn.close(4001, "Unauthorized: missing or invalid connection token");
      return;
    }

    let tenantDb: PrismaClient;
    try {
      tenantDb = await resolveTenantDb(payload.organizationId);
    } catch (err) {
      console.error("[yjs] failed to resolve tenant database:", (err as Error).message);
      conn.close(1011, "Server error resolving document's organization");
      return;
    }

    await whenLoaded(tenantDb, documentId);
    const room = getRoom(tenantDb, documentId);
    room.conns.add(conn);
    console.log(`[yjs] accepted documentId=${documentId} orgId=${payload.organizationId} roomConns=${room.conns.size}`);

    conn.binaryType = "arraybuffer";

    conn.on("message", (data: ArrayBuffer) => {
      const uint8 = new Uint8Array(data);
      const decoder = decoding.createDecoder(uint8);
      const messageType = decoding.readVarUint(decoder);
      const encoder = encoding.createEncoder();
      switch (messageType) {
        case MESSAGE_SYNC: {
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);
          if (encoding.length(encoder) > 1) conn.send(encoding.toUint8Array(encoder));
          break;
        }
        case MESSAGE_AWARENESS: {
          awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), conn);
          break;
        }
      }
    });

    conn.on("close", () => {
      room.conns.delete(conn);
      awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], conn);
    });

    // Initial sync: send SyncStep1 + current awareness.
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    conn.send(encoding.toUint8Array(enc));

    const states = room.awareness.getStates();
    if (states.size > 0) {
      const aenc = encoding.createEncoder();
      encoding.writeVarUint(aenc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aenc,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())),
      );
      conn.send(encoding.toUint8Array(aenc));
    }
  });
}
