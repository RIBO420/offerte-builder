"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Receipt, Clock } from "lucide-react";

interface NacalculatieSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function NacalculatieSuccessDialog({
  open,
  onOpenChange,
  projectId,
}: NacalculatieSuccessDialogProps) {
  const router = useRouter();

  const handleGoToFactuur = () => {
    onOpenChange(false);
    router.push(`/projecten/${projectId}/factuur`);
  };

  const handleLater = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="text-center sm:text-center">
          {/* Success Animation */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.1,
                }}
                className="mx-auto mb-4"
              >
                <div className="relative">
                  {/* Outer ring animation */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: [0, 0.3, 0] }}
                    transition={{
                      duration: 1,
                      delay: 0.3,
                      repeat: 1,
                      ease: "easeOut",
                    }}
                    className="absolute inset-0 rounded-full bg-green-500"
                  />
                  {/* Success circle */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                      delay: 0.2,
                    }}
                    className="relative h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center"
                  >
                    <motion.div
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                    >
                      <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </motion.div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogTitle className="text-xl">
            Nacalculatie opgeslagen!
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Wil je nu een factuur genereren voor dit project?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col mt-4">
          <Button
            onClick={handleGoToFactuur}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Receipt className="mr-2 h-4 w-4" />
            Ja, naar factuur
          </Button>
          <Button
            variant="outline"
            onClick={handleLater}
            className="w-full"
            size="lg"
          >
            <Clock className="mr-2 h-4 w-4" />
            Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
