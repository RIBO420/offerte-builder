"use client";

import { useRef, useEffect, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignaturePadComponentProps {
  onSignatureChange: (signature: string | null) => void;
  className?: string;
}

export function SignaturePadComponent({
  onSignatureChange,
  className,
}: SignaturePadComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);

      // Set canvas size
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });

      signaturePadRef.current.addEventListener("endStroke", () => {
        setIsEmpty(signaturePadRef.current?.isEmpty() ?? true);
        if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
          onSignatureChange(signaturePadRef.current.toDataURL());
        }
      });
    }

    return () => {
      signaturePadRef.current?.off();
    };
  }, [onSignatureChange]);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setIsEmpty(true);
    onSignatureChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-32 rounded-lg cursor-crosshair touch-none"
          style={{ touchAction: "none" }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/50">
            Teken hier uw handtekening
          </div>
        )}
      </div>
      <div className="flex justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
        >
          <Eraser className="mr-2 h-4 w-4" />
          Wissen
        </Button>
        {!isEmpty && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" />
            Handtekening gezet
          </span>
        )}
      </div>
    </div>
  );
}
