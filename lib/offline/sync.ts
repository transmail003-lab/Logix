import { createClient } from "@/lib/supabase/client";
import {
  getUnsyncedEvents,
  getUnsyncedIncidents,
  markEventSynced,
  markIncidentSynced
} from "./db";

let syncing = false;

/**
 * Recorre la cola local (IndexedDB) y la sube a Supabase.
 * Se llama: (1) al detectar el evento 'online', (2) periódicamente
 * mientras hay conexión, y (3) manualmente desde la UI ("Sincronizar ahora").
 * Usa client_uuid como clave de idempotencia: si el registro ya existe
 * en el servidor, el insert falla por unicidad y simplemente se marca
 * como sincronizado (evita duplicados en reintentos).
 */
export async function syncPendingData() {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  try {
    const supabase = createClient();

    // 1. Eventos de trazabilidad
    const events = await getUnsyncedEvents();
    for (const ev of events) {
      const { data: pkg } = await supabase
        .from("packages")
        .select("id")
        .eq("tracking_code", ev.package_tracking_code)
        .maybeSingle();

      if (!pkg) continue; // el paquete aún no existe en el servidor; se reintenta en el próximo ciclo

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from("package_events").insert({
        package_id: pkg.id,
        status: ev.status,
        recorded_by: userData.user?.id,
        recorded_at: ev.recorded_at,
        latitude: ev.latitude,
        longitude: ev.longitude,
        notes: ev.notes,
        client_uuid: ev.client_uuid
      });

      // 23505 = unique_violation -> ya estaba sincronizado, se ignora
      if (!error || (error as { code?: string }).code === "23505") {
        await supabase.from("packages").update({ status: ev.status }).eq("id", pkg.id);
        await markEventSynced(ev.client_uuid);
      }
    }

    // 2. Incidencias (con foto)
    const incidents = await getUnsyncedIncidents();
    for (const inc of incidents) {
      const { data: pkg } = await supabase
        .from("packages")
        .select("id")
        .eq("tracking_code", inc.package_tracking_code)
        .maybeSingle();

      if (!pkg) continue;

      let photo_url: string | undefined;
      if (inc.photo_blob) {
        const path = `${pkg.id}/${inc.client_uuid}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("evidence")
          .upload(path, inc.photo_blob, { upsert: true });
        if (!uploadError) {
          photo_url = path;
        }
      }

      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from("incidents").insert({
        package_id: pkg.id,
        reason: inc.reason,
        description: inc.description,
        photo_url,
        reported_by: userData.user?.id,
        reported_at: inc.reported_at
      });

      if (!error) {
        await supabase
          .from("packages")
          .update({ status: "no_entregado" })
          .eq("id", pkg.id);
        await markIncidentSynced(inc.client_uuid);
      }
    }
  } finally {
    syncing = false;
  }
}

export function initBackgroundSync() {
  if (typeof window === "undefined") return;

  window.addEventListener("online", () => {
    syncPendingData();
  });

  // Reintento periódico por si el navegador no dispara 'online' de forma confiable
  setInterval(() => {
    if (navigator.onLine) syncPendingData();
  }, 30_000);

  // Primer intento al cargar, por si ya hay conexión
  syncPendingData();
}
