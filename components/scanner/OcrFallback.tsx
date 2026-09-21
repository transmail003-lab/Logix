"use client";

import { useRef, useState } from "react";
import { createWorker } from "tesseract.js";

interface Props {
  onCodeDetected: (code: string) => void;
}

// Extrae un patrón tipo "RF-XXXXXX" del texto reconocido por OCR.
// Se usa cuando el ticket está arrugado o dañado y el código de barras no lee.
const CODE_PATTERN = /\b[A-Z]{2}-?\d{4,10}\b/;

export default function OcrFallback({ onCodeDetected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setProcessing(true);
    setError(null);
    try {
      const worker = await createWorker("eng");
      const {
        data: { text }
      } = await worker.recognize(file);
      await worker.terminate();

      setRawText(text);
      const match = text.toUpperCase().match(CODE_PATTERN);

      if (match) {
        onCodeDetected(match[0].replace(/\s/g, ""));
      } else {
        setError("No se detectó un código válido. Puedes ingresarlo manualmente abajo.");
      }
    } catch {
      setError("Error procesando la imagen.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-4">
      <p className="mb-2 text-sm font-medium">Ticket dañado / ilegible</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="mb-2 text-sm"
      />
      {processing && <p className="text-sm text-slate-500">Leyendo texto de la foto...</p>}
      {error && <p className="text-sm text-amber-600">{error}</p>}
      {rawText && (
        <details className="mt-2 text-xs text-slate-400">
          <summary>Texto detectado</summary>
          <pre className="whitespace-pre-wrap">{rawText}</pre>
        </details>
      )}
    </div>
  );
}
