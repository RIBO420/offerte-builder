"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Plus, 
  FileText, 
  Clock, 
  TrendingUp, 
  Shovel, 
  Trees,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  badge?: string;
}

const quickActions: QuickAction[] = [
  {
    title: "Nieuwe Aanleg Offerte",
    description: "Voor nieuwe tuinprojecten en renovaties",
    href: "/offertes/nieuw/aanleg",
    icon: Shovel,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    badge: "Populair",
  },
  {
    title: "Nieuwe Onderhoud Offerte",
    description: "Voor periodiek tuinonderhoud",
    href: "/offertes/nieuw/onderhoud",
    icon: Trees,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
];

const statsActions = [
  {
    title: "Concepten",
    value: "concept",
    icon: Clock,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    title: "Verzonden",
    value: "verzonden",
    icon: TrendingUp,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Alle offertes",
    value: "",
    icon: FileText,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
];

export function QuickActions() {
  return (
    <div className="space-y-6">
      {/* Quick Start Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={action.href}>
              <Card className="group relative overflow-hidden border-dashed hover:border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 cursor-pointer bg-white/5 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.bgColor} ${action.color}`}
                    >
                      <action.icon className="h-6 w-6" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold group-hover:text-emerald-400 transition-colors">
                          {action.title}
                        </h3>
                        {action.badge && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {action.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {action.description}
                      </p>
                      <div className="mt-3 flex items-center text-sm text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Start nu
                        <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats Filter */}
      <div className="flex flex-wrap gap-2">
        {statsActions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
          >
            <Link href={`/offertes${action.value ? `?status=${action.value}` : ""}`}>
              <Button
                variant="outline"
                size="sm"
                className="group bg-white/5 hover:bg-white/10 border-white/10 hover:border-emerald-500/30"
              >
                <span className={`mr-2 ${action.color}`}>
                  <action.icon className="h-4 w-4" />
                </span>
                {action.title}
                <ArrowRight className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Recent Activity Component
export function RecentActivity() {
  const activities = [
    { action: "Offerte aangemaakt", item: "Tuinontwerp De Jong", time: "2 min geleden", type: "create" },
    { action: "Offerte verzonden", item: "Onderhoudstraat 12", time: "1 uur geleden", type: "send" },
    { action: "Offerte geaccepteerd", item: "Vlonder achtertuin", time: "3 uur geleden", type: "accept" },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Recente activiteit</h4>
      <div className="space-y-2">
        {activities.map((activity, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
          >
            <div className={`w-2 h-2 rounded-full ${
              activity.type === "create" ? "bg-blue-400" :
              activity.type === "send" ? "bg-amber-400" :
              "bg-emerald-400"
            }`} />
            <div className="flex-1 min-w-0">
              <span className="text-foreground">{activity.action}</span>
              <span className="text-muted-foreground"> • {activity.item}</span>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Tips & Suggestions
export function ProTips() {
  const tips = [
    { icon: Sparkles, text: "Gebruik templates om tijd te besparen", link: "/templates" },
    { icon: Clock, text: "3 offertes wachten op verzending", link: "/offertes?status=concept" },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Tips voor jou</h4>
      <div className="space-y-2">
        {tips.map((tip, index) => (
          <Link key={index} href={tip.link}>
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/20 transition-all text-sm cursor-pointer"
            >
              <tip.icon className="h-4 w-4 text-emerald-400" />
              <span className="text-foreground">{tip.text}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-emerald-400" />
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
