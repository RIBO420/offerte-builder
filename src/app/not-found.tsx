import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Pagina niet gevonden
        </h1>

        <p className="text-muted-foreground text-base mb-8">
          De pagina die je zoekt bestaat niet of is verplaatst.
        </p>

        <Button asChild size="lg">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar home
          </Link>
        </Button>
      </div>
    </div>
  );
}
