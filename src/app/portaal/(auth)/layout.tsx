import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";

export default function PortaalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8faf8] flex flex-col items-center justify-center">
      <div className="mb-8 flex items-center gap-3">
        {/* Vaste lichte ondergrond (#f8faf8), dus een donkergroene drager onder
            het witte merkteken. Niet het oude #4ADE80: wit daarop haalt maar
            1,7:1 — de portaal-header-groen wél ruim 3:1. */}
        <div className="bg-[#1a2e1a] w-10 h-10 shrink-0 rounded-lg flex items-center justify-center">
          <TopTuinenLogo variant="wit" size={28} className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[#1a2e1a] font-semibold text-xl">Top Tuinen</span>
          <span className="text-[#4ADE80] text-sm ml-2 opacity-70">Klantenportaal</span>
        </div>
      </div>
      {children}
    </div>
  );
}
