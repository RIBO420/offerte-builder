import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";

export default function PortaalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="mb-8 flex items-center gap-3">
        {/* Witte boom in een mosgroene cirkel (huisstijl): `sidebar-primary`
            blijft mosgroen in licht én donker, waar `primary` in donker licht
            olijf is en wit erop zou wegvallen. */}
        <div className="bg-sidebar-primary w-11 h-11 shrink-0 rounded-full flex items-center justify-center">
          {/* Loginscherm: dit merkteken staat boven de vouw. */}
          <TopTuinenLogo variant="wit" size={28} className="w-7 h-7" priority />
        </div>
        <div>
          <span className="text-foreground font-semibold text-lg uppercase tracking-[0.12em]">Top Tuinen</span>
          <span className="text-muted-foreground text-xs uppercase tracking-[0.16em] ml-3">Klantenportaal</span>
        </div>
      </div>
      {children}
    </div>
  );
}
