import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Todo lo que el motorista captura sin conexión pasa primero por aquí.
// pending_events / pending_incidents guardan cola de sincronización;
// una vez subidos a Supabase se marcan synced=true (o se borran).

interface LogixDB extends DBSchema {
  pending_events: {
    key: string; // client_uuid
    value: {
      client_uuid: string;
      package_tracking_code: string;
      manifest_client_id: string;
      status: string;
      recorded_at: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
      synced: boolean;
    };
  };
  pending_incidents: {
    key: string;
    value: {
      client_uuid: string;
      package_tracking_code: string;
      reason: string;
      description?: string;
      photo_blob?: Blob;
      reported_at: string;
      synced: boolean;
    };
  };
  local_manifests: {
    key: string; // client-generated id, hasta que exista en el servidor
    value: {
      client_id: string;
      server_id?: string;
      shift_id: string;
      driver_id: string;
      codes: string[];
      status: "abierto" | "cerrado" | "sincronizado";
      qr_payload?: string;
      created_at: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<LogixDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LogixDB>("logix-offline", 1, {
      upgrade(db) {
        db.createObjectStore("pending_events", { keyPath: "client_uuid" });
        db.createObjectStore("pending_incidents", { keyPath: "client_uuid" });
        db.createObjectStore("local_manifests", { keyPath: "client_id" });
      }
    });
  }
  return dbPromise;
}

export async function queueEvent(event: LogixDB["pending_events"]["value"]) {
  const db = await getDB();
  await db.put("pending_events", event);
}

export async function queueIncident(incident: LogixDB["pending_incidents"]["value"]) {
  const db = await getDB();
  await db.put("pending_incidents", incident);
}

export async function getUnsyncedEvents() {
  const db = await getDB();
  const all = await db.getAll("pending_events");
  return all.filter((e) => !e.synced);
}

export async function getUnsyncedIncidents() {
  const db = await getDB();
  const all = await db.getAll("pending_incidents");
  return all.filter((i) => !i.synced);
}

export async function markEventSynced(client_uuid: string) {
  const db = await getDB();
  const rec = await db.get("pending_events", client_uuid);
  if (rec) await db.put("pending_events", { ...rec, synced: true });
}

export async function markIncidentSynced(client_uuid: string) {
  const db = await getDB();
  const rec = await db.get("pending_incidents", client_uuid);
  if (rec) await db.put("pending_incidents", { ...rec, synced: true });
}

export async function saveLocalManifest(m: LogixDB["local_manifests"]["value"]) {
  const db = await getDB();
  await db.put("local_manifests", m);
}
