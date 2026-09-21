"use client";

import { useEffect, useState } from "react";
import { queueEvent, queueIncident } from "@/lib/offline/db";
import { initBackgroundSync, syncPendingData } from "@/lib/offline/sync";

const INCIDENT_REASONS = [
  { value: "cliente_ausente", label: "Cliente ausente" },
  { value: "direccion_incorrecta", label: "Dirección incorrecta" },
  { value: "rechazado_por_cliente", label: "Rechazado por el cliente" },
  { value: "paquete_danado", label: "Paquete dañado" },
  { value: "zona_insegura", label: "Zona insegura" },
  { value: "otro", label: "Otro" }
];

export default function RutaPage() {
  const [trackingCode, setTrackingCode] = useState("");
  const [online, setOnline] = useState(true);
  const [showIncident, setShowIncident] = useState(false);
  const [reason, setReason] = useState(INCIDENT_REASONS[0].value);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    initBackgroundSync();
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function getGeo(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 4000 }
      );
    });
  }

  async function marcarEntregado() {
    if (!trackingCode) return;
    const geo = await getGeo();

    await queueEvent({
      client_uuid: crypto.randomUUID(),
      package_tracking_code: trackingCode,
      manifest_client_id: "",
      status: "entregado",
      recorded_at: new Date().toISOString(),
      latitude: geo.lat,
      longitude: geo.lng,
      synced: false
    });

    setMessage(`Entrega registrada localmente para ${trackingCode}.`);
    setTrackingCode("");
    if (navigator.onLine) syncPendingData();
  }

  async function registrarIncidencia() {
    if (!trackingCode) return;
    const geo = await getGeo();

    await queueEvent({
      client_uuid: crypto.randomUUID(),
      package_tracking_code: trackingCode,
      manifest_client_id: "",
      status: "no_entregado",
      recorded_at: new Date().toISOString(),
      latitude: geo.lat,
      longitude: geo.lng,
      synced: false
    });

    await queueIncident({
      client_uuid: crypto.randomUUID(),
      package_tracking_code: trackingCode,
      reason,
      description,
      photo_blob: photo ?? undefined,
      reported_at: new Date().toISOString(),
      synced: false
    });

    setMessage(`Incidencia guardada localmente para ${trackingCode}.`);
    setTrackingCode("");
    setDescription("");
    setPhoto(null);
    setShowIncident(false);
    if (navigator.onLine) syncPendingData();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div
        className={`mb-4 rounded-lg px-3 py-2 text-center text-xs font-medium ${
          online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {online ? "En línea — sincronizando" : "Sin conexión — guardando localmente"}
      </div>

      <h1 className="mb-4 text-lg font-semibold">Registro de entrega</h1>

      <input
        value={trackingCode}
        onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
        placeholder="Código del paquete (RF-XXXXXX)"
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
      />

      <div className="mb-3 grid grid-cols-2 gap-3">
        <button
          onClick={marcarEntregado}
          disabled={!trackingCode}
          className="rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Entregado
        </button>
        <button
          onClick={() => setShowIncident(true)}
          disabled={!trackingCode}
          className="rounded-lg bg-amber-600 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          No entregado
        </button>
      </div>

      {showIncident && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {INCIDENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle (opcional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Foto de evidencia</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <button
            onClick={registrarIncidencia}
            className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white"
          >
            Guardar incidencia
          </button>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
    </main>
  );
}
