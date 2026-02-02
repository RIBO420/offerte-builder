"use client";

import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FileText,
  Calculator,
  Users,
  FolderKanban,
  ArrowRight,
} from "lucide-react";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
}

const features = [
  {
    icon: FileText,
    title: "Offertes maken",
    description: "Maak professionele offertes voor tuinaanleg en onderhoud",
  },
  {
    icon: Calculator,
    title: "Automatische berekeningen",
    description: "Uren en kosten worden automatisch berekend op basis van normuren",
  },
  {
    icon: FolderKanban,
    title: "Projectbeheer",
    description: "Beheer projecten van voorcalculatie tot facturatie",
  },
  {
    icon: Users,
    title: "Team en planning",
    description: "Plan je team en houd uren bij per project",
  },
];

export function WelcomeModal({ open, onClose, userName }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader className="text-center sm:text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30"
          >
            <Sparkles className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          <DialogTitle className="text-2xl">
            Welkom{userName ? `, ${userName}` : ""}!
          </DialogTitle>
          <DialogDescription className="text-base">
            Je bent klaar om te beginnen met TOP Offerte Calculator.
            Hier kun je snel en eenvoudig offertes maken voor je tuinprojecten.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 grid gap-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <feature.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={onClose}
            size="lg"
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
          >
            Aan de slag
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
