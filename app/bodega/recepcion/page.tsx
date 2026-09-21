"use client";

import { useState } from "react";
import BarcodeScanner from "@/components/scanner/BarcodeScanner";
import SignaturePad from "@/components/signature/SignaturePad";
import { createClient } from "@/lib/supabase/client";

interface ScannedManifest {
  manifestId: string;
  code: string;
  totalPackages: number;
}

export default function RecepcionPage() {
  const supabase = createClient();
  const [scanning, setScanning] = useState(true);
  const [manifest, setManifest] = useState<ScannedManifest | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(payload: string) {
    setScanning(false);
    setError(null);

    // El QR maestro codifica el payload guardado en manifests.qr_payload
    const { data, error: fetchError } = await supabase
      .from("manifests")
      .select("id, code, total_packages, status")
      .eq("qr_payload", payload)
      .single();

    if (fetchError || !data) {
      setError("QR no reconocido o manifiesto no encontrado.");
      return;
    }

    if (data.status === "recibido") {
      setError("Este manifiesto ya fue recibido anteriormente.");
      return;
    }

    setManifest({ manifestId: data.id, code: data.code, totalPackages: data.total_packages });
  }

  async function confirmarRecepcion() {
    if (!manifest || !signatureDataUrl) return;
    setSaving(true);
    setError(null);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    // Cambio de estado masivo: TODO el lote pasa a "recibido_bodega" de una sola vez
    const { error: updateError } = await supabase
      .from("packages")
      .update({ status: "recibido_bodega" })
      .eq("manifest_id", manifest.manifestId);

    await supabase
      .from("manifests")
      .update({
        status: "recibido",
        received_at: new Date().toISOString(),
        received_by: user?.id
      })
      .eq("id", manifest.manifestId);

    // Sube la firma a Storage
    const blob = await (await fetch(signatureDataUrl)).blob();
    const path = `${manifest.manifestId}/${crypto.randomUUID()}.png`;
    await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });

    await supabase.from("proof_of_delivery").insert({
      manifest_id: manifest.manifestId,
      signer_name: signerName,
      signature_url: path,
      received_by: user?.id
    });

    setSaving(false);
    if (!updateError) setDone(true);
    else setError("Ocurrió un error al confirmar la recepción.");
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="mb-2 text-lg font-semibold text-emerald-700">Recepción confirmada</h1>
        <p className="mb-6 text-sm text-slate-500">
          {manifest?.totalPackages} paquetes marcados como recibidos en bodega.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setManifest(null);
            setSignatureDataUrl(null);
            setSignerName("");
            setScanning(true);
          }}
          className="w-full rounded-lg bg-brand-600 py-3 text-sm font-medium text-white"
        >
          Recibir otro manifiesto
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">Recepción en bodega</h1>

      {scanning && (
        <>
          <p className="mb-3 text-sm text-slate-500">Escanea el QR maestro del motorista.</p>
          <BarcodeScanner onScan={handleScan} />
        </>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {manifest && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-brand-50 p-4">
            <p className="text-sm text-slate-600">Manifiesto</p>
            <p className="text-lg font-semibold text-brand-900">{manifest.code}</p>
            <p className="text-sm text-slate-600">{manifest.totalPackages} paquetes</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Recibido por (nombre)</label>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Firma digital</label>
            <SignaturePad onChange={setSignatureDataUrl} />
          </div>

          <button
            onClick={confirmarRecepcion}
            disabled={!signatureDataUrl || !signerName || saving}
            className="w-full rounded-lg bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Confirmando..." : "Confirmar recepción del lote"}
          </button>
        </div>
      )}
    </main>
  );
}
