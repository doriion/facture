"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Canvas de signature tactile (doigt / stylet / souris) via Pointer
 * Events — aucune dépendance. Fond blanc, trait noir, mise à l'échelle
 * devicePixelRatio pour un rendu net sur mobile.
 *
 * `onChange(hasInk)` prévient le parent qu'un tracé existe ;
 * `toBlob()` exporte le PNG via la ref.
 */
export type SignaturePadHandle = {
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
};

export function SignaturePad({
  onInkChange,
  padRef,
  disabled = false,
}: {
  onInkChange?: (hasInk: boolean) => void;
  padRef: React.MutableRefObject<SignaturePadHandle | null>;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Dimensionne le bitmap sur la taille CSS réelle × DPR (net sur Retina)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#111318";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    padRef.current = {
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) return resolve(null);
          canvas.toBlob((b) => resolve(b), "image/png");
        }),
      clear: clearCanvas,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Un point seul doit marquer (initiales, croix…)
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    if (!hasInk) {
      setHasInk(true);
      onInkChange?.(true);
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
    onInkChange?.(false);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full cursor-crosshair rounded-md border bg-white"
        // touch-action none : sans ça le navigateur scrolle au lieu de signer
        style={{ touchAction: "none" }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Zone de signature"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Signez au doigt dans le cadre.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearCanvas}
          disabled={!hasInk || disabled}
        >
          <Eraser className="size-4" />
          Effacer
        </Button>
      </div>
    </div>
  );
}
