"use client";

import { useRef, useEffect, useState } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [typedName, setTypedName] = useState("");

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
    setTypedName("");
    onSignatureChange(null);
  };

  // Generate signature image from typed name
  const generateTypedSignature = (name: string): string => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.font = "italic 32px 'Brush Script MT', cursive, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
    }
    return canvas.toDataURL();
  };

  const handleTypedNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTypedName(name);

    if (name.trim()) {
      // Clear the drawn signature when typing
      signaturePadRef.current?.clear();
      setIsEmpty(false);
      const signatureDataUrl = generateTypedSignature(name);
      onSignatureChange(signatureDataUrl);
    } else {
      setIsEmpty(true);
      onSignatureChange(null);
    }
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

      {/* Text input alternative for keyboard accessibility */}
      <div className="space-y-1.5 pt-2 border-t border-muted-foreground/10">
        <Label
          htmlFor="typed-signature"
          className="text-sm text-muted-foreground"
        >
          Kan je niet tekenen? Typ je naam hieronder
        </Label>
        <Input
          id="typed-signature"
          type="text"
          value={typedName}
          onChange={handleTypedNameChange}
          placeholder="Typ je naam"
          className="font-serif italic"
          aria-describedby="typed-signature-hint"
        />
        <p id="typed-signature-hint" className="text-xs text-muted-foreground">
          Je getypte naam wordt omgezet naar een handtekening
        </p>
      </div>
    </div>
  );
}
