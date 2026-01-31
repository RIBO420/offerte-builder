"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ExternalLink, Users, Trophy, Medal, Award, Repeat, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopKlant {
  klantId: string | null;
  klantNaam: string;
  totaalOmzet: number;
  aantalOffertes: number;
  aantalGeaccepteerd?: number;
  gemiddeldeWaarde: number;
  isRepeatCustomer?: boolean;
  firstOfferteDate?: number;
  lastOfferteDate?: number;
}

interface TopKlantenTableProps {
  klanten: TopKlant[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Medal icons for top 3
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: "spring", delay: 0.1 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/40"
      >
        <Trophy className="h-3.5 w-3.5 text-white" />
      </motion.div>
    );
  }
  if (rank === 2) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: "spring", delay: 0.2 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-500/30"
      >
        <Medal className="h-3.5 w-3.5 text-white" />
      </motion.div>
    );
  }
  if (rank === 3) {
    return (
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, type: "spring", delay: 0.3 }}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-orange-700 shadow-lg shadow-orange-500/30"
      >
        <Award className="h-3.5 w-3.5 text-white" />
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 + rank * 0.05 }}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium"
    >
      {rank}
    </motion.div>
  );
}

export const TopKlantenTable = memo(function TopKlantenTable({ klanten }: TopKlantenTableProps) {
  // Calculate totals for the header
  const totaalOmzet = klanten.reduce((sum, k) => sum + k.totaalOmzet, 0);
  const repeatCustomers = klanten.filter(k => k.isRepeatCustomer).length;

  if (klanten.length === 0) {
    return (
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5">
        <CardHeader>
          <CardTitle>Top Klanten</CardTitle>
          <CardDescription>Klanten gesorteerd op omzet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            Geen klanten gevonden
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group"
    >
      <Card className="relative overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/20">
        {/* Decorative gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/10 via-violet-500/5 to-transparent rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500 pointer-events-none" />

        <CardHeader className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle>Top Klanten</CardTitle>
              <CardDescription>
                Totaal: <span className="font-semibold text-foreground">{formatCurrency(totaalOmzet)}</span>
                {repeatCustomers > 0 && (
                  <span className="ml-2">
                    <Badge variant="secondary" className="gap-1 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800">
                      <Repeat className="h-3 w-3" />
                      {repeatCustomers} terugkerend
                    </Badge>
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead className="text-right">Totaal Omzet</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Offertes</TableHead>
                <TableHead className="text-right hidden md:table-cell">Gem. Waarde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {klanten.map((klant, index) => (
                <TableRow
                  key={klant.klantId ?? klant.klantNaam}
                  className="group/row border-white/5 transition-colors hover:bg-white/5 dark:hover:bg-white/5 animate-in fade-in slide-in-from-left-2"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <TableCell className="py-3">
                    <RankBadge rank={index + 1} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {klant.klantId ? (
                        <Link
                          href={`/klanten/${klant.klantId}`}
                          className="flex items-center gap-2 font-medium transition-colors hover:text-purple-500 dark:hover:text-purple-400 group/link"
                        >
                          <span>{klant.klantNaam}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </Link>
                      ) : (
                        <span className="font-medium">{klant.klantNaam}</span>
                      )}
                      {klant.isRepeatCustomer && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400" title="Terugkerende klant">
                          <Repeat className="h-3 w-3" />
                          <Star className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${index === 0 ? 'text-amber-500' : index < 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                      <AnimatedNumber
                        value={klant.totaalOmzet}
                        duration={1000}
                        prefix="€"
                        formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                      {klant.aantalOffertes}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                    {formatCurrency(klant.gemiddeldeWaarde)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
});
