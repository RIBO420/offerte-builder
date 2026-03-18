import Link from "next/link";

export default function PublicNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-muted-foreground/30 mb-4">404</p>

        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Deze pagina bestaat niet
        </h1>

        <p className="text-muted-foreground mb-8">
          De pagina die je probeert te bezoeken is niet beschikbaar.
          Mogelijk is de link onjuist of is de pagina verwijderd.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          Terug naar homepage
        </Link>
      </div>
    </div>
  );
}
