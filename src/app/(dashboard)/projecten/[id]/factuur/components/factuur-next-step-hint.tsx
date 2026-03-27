"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Send,
  Clock,
  CheckCircle,
} from "lucide-react";

interface FactuurNextStepHintProps {
  factuurStatus: string;
  prefersReducedMotion: boolean;
}

export function FactuurNextStepHint({
  factuurStatus,
  prefersReducedMotion,
}: FactuurNextStepHintProps) {
  const motionInitial = prefersReducedMotion ? {} : { opacity: 0, y: 10 };
  const motionAnimate = { opacity: 1, y: 0 };

  switch (factuurStatus) {
    case "concept":
      return (
        <motion.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">Volgende stap: Definitief maken</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Controleer de factuur en maak deze definitief om te kunnen verzenden.
            </p>
          </div>
        </motion.div>
      );
    case "definitief":
      return (
        <motion.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">Klaar om te verzenden!</p>
            <p className="text-sm text-green-700 dark:text-green-300">
              De factuur is definitief. Je kunt deze nu naar de klant versturen.
            </p>
          </div>
        </motion.div>
      );
    case "verzonden":
      return (
        <motion.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Wachten op betaling</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Markeer de factuur als betaald zodra de betaling is ontvangen.
            </p>
          </div>
        </motion.div>
      );
    case "betaald":
      return (
        <motion.div
          initial={motionInitial}
          animate={motionAnimate}
          className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">Project voltooid!</p>
            <p className="text-sm text-green-700 dark:text-green-300">
              De factuur is betaald. Dit project is succesvol afgerond.
            </p>
          </div>
        </motion.div>
      );
    default:
      return null;
  }
}
