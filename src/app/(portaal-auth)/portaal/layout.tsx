export default function PortaalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8faf8] flex flex-col items-center justify-center">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-[#4ADE80] w-10 h-10 rounded-lg flex items-center justify-center font-bold text-black text-lg">
          TT
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
