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
  // Un seul pointeur trace à la fois : la paume posée sur la tablette
  // pendant la signature ne doit ni zébrer ni interrompre le tracé.
  const activePointer = useRef<number | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const hasInkRef = useRef(false);

  function setInk(v: boolean) {
    hasInkRef.current = v;
    setHasInk(v);
    onInkChange?.(v);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dimensionne le bitmap sur la taille CSS réelle × DPR (net sur
    // Retina). setTransform (et non scale cumulatif) : idempotent si
    // rappelé au resize.
    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#111318";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    setup();

    // Rotation portrait/paysage, clavier virtuel, reflow des colonnes :
    // sans re-setup, le trait se décale du doigt et « Effacer » laisse
    // de l'encre résiduelle. Redimensionner déforme un tracé raster →
    // on repart d'un pad vierge (l'utilisateur re-signe à la bonne
    // taille), en prévenant le parent.
    let lastW = canvas.getBoundingClientRect().width;
    let lastH = canvas.getBoundingClientRect().height;
    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      if (
        Math.abs(rect.width - lastW) < 1 &&
        Math.abs(rect.height - lastH) < 1
      ) {
        return;
      }
      lastW = rect.width;
      lastH = rect.height;
      drawing.current = false;
      activePointer.current = null;
      setup();
      if (hasInkRef.current) setInk(false);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Deuxième pointeur (paume posée…) : ignoré, le premier garde la main.
    if (activePointer.current !== null) return;
    e.preventDefault();
    activePointer.current = e.pointerId;
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
    if (!hasInk) setInk(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    if (e.pointerId !== activePointer.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointer.current) return;
    activePointer.current = null;
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
    setInk(false);
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
