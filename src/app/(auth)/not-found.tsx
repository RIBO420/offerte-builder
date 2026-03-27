import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, LogIn } from "lucide-react";

export default function AuthNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-8 w-8 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Pagina niet gevonden
        </h1>

        <p className="text-muted-foreground mb-8">
          Deze pagina bestaat niet. Ga naar de inlogpagina om verder te gaan.
        </p>

        <Button asChild>
          <Link href="/sign-in">
            <LogIn className="mr-2 h-4 w-4" />
            Ga naar de inlogpagina
          </Link>
        </Button>
      </div>
    </div>
  );
}
