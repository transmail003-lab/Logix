"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

interface Props {
  onScan: (code: string) => void;
  // Evita contar el mismo código dos veces si la cámara sigue enfocando el mismo ticket
  cooldownMs?: number;
}

export default function BarcodeScanner({ onScan, cooldownMs = 1200 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (cancelled || !result) return;
          const code = result.getText();
          const now = Date.now();
          const last = lastCodeRef.current;

          if (last && last.code === code && now - last.at < cooldownMs) return;

          lastCodeRef.current = { code, at: now };

          // Feedback táctil/sonoro para escaneo sin mirar la pantalla
          if (navigator.vibrate) navigator.vibrate(80);
          onScan(code);
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
        setReady(true);
      })
      .catch(() => setError("No se pudo acceder a la cámara."));

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
      {!ready && !error && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
          Activando cámara...
        </p>
      )}
      {error && (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-lg border-2 border-brand-500/80" />
    </div>
  );
}
