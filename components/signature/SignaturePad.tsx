"use client";

import { useEffect, useRef } from "react";
import SignaturePadLib from "signature_pad";

interface Props {
  onChange: (dataUrl: string | null) => void;
}

export default function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    padRef.current = new SignaturePadLib(canvas, { backgroundColor: "rgb(255,255,255)" });
    padRef.current.addEventListener("endStroke", () => {
      onChange(padRef.current!.isEmpty() ? null : padRef.current!.toDataURL("image/png"));
    });

    return () => padRef.current?.off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    padRef.current?.clear();
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-48 w-full rounded-lg border border-slate-300 bg-white"
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs font-medium text-slate-500 underline"
      >
        Limpiar firma
      </button>
    </div>
  );
}
