"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { FleetGoSettings } from "@/components/wagenpark/fleetgo-settings";

interface KoppelingenTabProps {
  reducedMotion: boolean;
}

export function KoppelingenTab({ reducedMotion }: KoppelingenTabProps) {
  return (
    <motion.div
      key="koppelingen"
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
    >
      <TabsContent value="koppelingen" className="space-y-4" forceMount>
        <div className="space-y-6">
          {/* FleetGo Integration */}
          <FleetGoSettings
            isConfigured={false}
            onSave={async (apiKey) => {
              // TODO: Save API key to backend
              toast.success("FleetGo instellingen opgeslagen");
            }}
            onTestConnection={async (apiKey) => {
              // TODO: Test actual connection
              return apiKey.length > 10;
            }}
          />

          {/* Placeholder for future integrations */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Meer koppelingen</CardTitle>
                  <CardDescription>
                    Binnenkort beschikbaar: boekhoudpakketten, planning tools, en meer
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We werken aan integraties met populaire tools zoals Exact Online,
                Moneybird, en andere boekhoud- en planningssoftware.
                Neem contact op als je een specifieke integratie nodig hebt.
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </motion.div>
  );
}
