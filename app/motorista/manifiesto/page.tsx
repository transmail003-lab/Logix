"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import OcrFallback from "@/components/scanner/OcrFallback";
import { createClient } from "@/lib/supabase/client";
import { saveLocalManifest } from "@/lib/offline/db";

export default function ManifiestoPage() {
  const supabase = createClient();
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [closing, setClosing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);

  useEffect(() => {
    setShiftId(localStorage.getItem("logix_shift_id"));
  }, []);

  function addCode(code: string) {
    setCodes((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }

  async function cerrarManifiesto() {
    if (!shiftId || codes.length === 0) return;
    setClosing(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const clientManifestId = crypto.randomUUID();
    const manifestCode = `MAN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${clientManifestId.slice(0, 6)}`;
    const qrPayload = JSON.stringify({ manifestClientId: clientManifestId, codes });

    // Modo online: crea el manifiesto y los paquetes directamente en Supabase.
    // Modo offline: guarda todo localmente; queda pendiente de sincronizar
    // (Módulo 3) y de todos modos genera su QR para poder cerrar la ruta.
    if (navigator.onLine && user) {
      const { data: manifest, error } = await supabase
        .from("manifests")
        .insert({
          code: manifestCode,
          qr_payload: qrPayload,
          shift_id: shiftId,
          driver_id: user.id,
          status: "cerrado",
          total_packages: codes.length,
          closed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!error && manifest) {
        await supabase.from("packages").insert(
          codes.map((code) => ({
            tracking_code: code,
            manifest_id: manifest.id,
            status: "en_ruta",
            captured_via: "scan"
          }))
        );
      }
    } else {
      await saveLocalManifest({
        client_id: clientManifestId,
        shift_id: shiftId,
        driver_id: user?.id ?? "offline",
        codes,
        status: "cerrado",
        qr_payload: qrPayload,
        created_at: new Date().toISOString()
      });
    }

    const dataUrl = await QRCode.toDataURL(qrPayload, { width: 320 });
    setQrDataUrl(dataUrl);
    setClosing(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold">Manifiesto — Modo Ráfaga</h1>
      <p className="mb-4 text-sm text-slate-500">
        Apunta la cámara a cada ticket. Se suman automáticamente.
      </p>

      {!qrDataUrl && (
        <>
          <BarcodeScanner onScan={addCode} />

          <div className="my-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
            <span className="text-sm font-medium text-brand-900">Paquetes escaneados</span>
            <span className="text-2xl font-bold text-brand-700">{codes.length}</span>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Ingreso manual (RF-XXXXXX)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                if (manualCode) {
                  addCode(manualCode);
                  setManualCode("");
                }
              }}
              className="rounded-lg bg-slate-800 px-4 text-sm text-white"
            >
              Añadir
            </button>
          </div>

          <OcrFallback onCodeDetected={addCode} />

          {codes.length > 0 && (
            <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-500">
              {codes.map((c) => (
                <li key={c} className="rounded bg-slate-100 px-2 py-1">
                  {c}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={cerrarManifiesto}
            disabled={codes.length === 0 || closing}
            className="mt-6 w-full rounded-lg bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {closing ? "Generando manifiesto..." : `Generar Manifiesto (${codes.length})`}
          </button>
        </>
      )}

      {qrDataUrl && (
        <div className="text-center">
          <p className="mb-3 text-sm text-slate-600">
            QR Maestro generado. Bodega lo escaneará al recibir la carga.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR Maestro del manifiesto" className="mx-auto rounded-lg" />
          <button
            onClick={() => router.push("/motorista/ruta")}
            className="mt-6 w-full rounded-lg bg-brand-600 py-3 text-sm font-medium text-white"
          >
            Iniciar ruta
          </button>
        </div>
      )}
    </main>
  );
}
