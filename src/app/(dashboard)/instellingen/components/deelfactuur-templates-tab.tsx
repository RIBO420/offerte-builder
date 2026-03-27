"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Save,
  FileStack,
  Percent,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Stap {
  percentage: number;
  label: string;
}

interface Template {
  id: string;
  naam: string;
  stappen: Stap[];
}

interface DeelfactuurTemplatesTabProps {
  reducedMotion: boolean;
}

export function DeelfactuurTemplatesTab({ reducedMotion }: DeelfactuurTemplatesTabProps) {
  const templates = useQuery(api.instellingen.getDeelfactuurTemplates) ?? [];
  const upsertTemplate = useMutation(api.instellingen.upsertDeelfactuurTemplate);
  const deleteTemplate = useMutation(api.instellingen.deleteDeelfactuurTemplate);

  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [naam, setNaam] = useState("");
  const [stappen, setStappen] = useState<Stap[]>([{ percentage: 100, label: "" }]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const totaalPercentage = stappen.reduce((sum, s) => sum + (s.percentage || 0), 0);

  function openNew() {
    setEditingTemplate(null);
    setNaam("");
    setStappen([
      { percentage: 50, label: "Vooraf" },
      { percentage: 30, label: "Bij start" },
      { percentage: 20, label: "Bij oplevering" },
    ]);
    setShowDialog(true);
  }

  function openEdit(template: Template) {
    setEditingTemplate(template);
    setNaam(template.naam);
    setStappen([...template.stappen]);
    setShowDialog(true);
  }

  function addStap() {
    setStappen([...stappen, { percentage: 0, label: "" }]);
  }

  function removeStap(index: number) {
    if (stappen.length <= 1) return;
    setStappen(stappen.filter((_, i) => i !== index));
  }

  function updateStap(index: number, field: keyof Stap, value: string | number) {
    const updated = [...stappen];
    if (field === "percentage") {
      updated[index] = { ...updated[index], percentage: Number(value) || 0 };
    } else {
      updated[index] = { ...updated[index], label: value as string };
    }
    setStappen(updated);
  }

  async function handleSave() {
    if (!naam.trim()) {
      toast.error("Vul een naam in voor het template");
      return;
    }
    if (totaalPercentage !== 100) {
      toast.error(`Percentages moeten optellen tot 100% (nu: ${totaalPercentage}%)`);
      return;
    }
    if (stappen.some((s) => !s.label.trim())) {
      toast.error("Vul een label in voor elke stap");
      return;
    }

    setIsSaving(true);
    try {
      await upsertTemplate({
        template: {
          id: editingTemplate?.id ?? crypto.randomUUID(),
          naam: naam.trim(),
          stappen: stappen.map((s) => ({
            percentage: s.percentage,
            label: s.label.trim(),
          })),
        },
      });
      toast.success(editingTemplate ? "Template bijgewerkt" : "Template aangemaakt");
      setShowDialog(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTemplate({ templateId: deleteId });
      toast.success("Template verwijderd");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <m.div
      key="deelfactuur-templates"
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deelfactuur Templates</CardTitle>
              <CardDescription>
                Standaard schema&apos;s voor deelfacturatie. Bij een nieuw project
                kan een template gekozen worden om het deelfactuurschema vooraf in
                te stellen.
              </CardDescription>
            </div>
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nieuw template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileStack className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Geen templates</p>
              <p className="text-sm mt-1">
                Maak een standaard deelfactuurschema aan, bijv. 50/30/20.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => openEdit(template)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium">{template.naam}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(template.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {template.stappen.map((stap, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {stap.percentage}% {stap.label}
                        </Badge>
                      ))}
                    </div>
                    {/* Visual progress bar */}
                    <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-muted">
                      {template.stappen.map((stap, i) => (
                        <div
                          key={i}
                          className="h-full first:rounded-l-full last:rounded-r-full"
                          style={{
                            width: `${stap.percentage}%`,
                            backgroundColor: `hsl(${142 + i * 30}, 60%, ${50 + i * 5}%)`,
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Template bewerken" : "Nieuw deelfactuur template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Template naam</Label>
              <Input
                placeholder="bijv. 50/30/20 of Standaard termijnen"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-2 block">Stappen</Label>
              <div className="space-y-2">
                {stappen.map((stap, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative w-24">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={stap.percentage || ""}
                        onChange={(e) =>
                          updateStap(index, "percentage", e.target.value)
                        }
                        className="pr-7"
                      />
                      <Percent className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      placeholder="Label (bijv. Vooraf)"
                      value={stap.label}
                      onChange={(e) =>
                        updateStap(index, "label", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeStap(index)}
                      disabled={stappen.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addStap}
              >
                <Plus className="h-4 w-4 mr-1" />
                Stap toevoegen
              </Button>
            </div>

            {/* Totaal indicator */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Totaal:</span>
              <Badge
                variant={totaalPercentage === 100 ? "default" : "destructive"}
              >
                {totaalPercentage}%
              </Badge>
            </div>
            {totaalPercentage !== 100 && (
              <p className="text-sm text-destructive">
                Percentages moeten optellen tot 100%
              </p>
            )}

            {/* Preview bar */}
            <div>
              <Label className="text-xs text-muted-foreground">Voorbeeld</Label>
              <div className="flex h-3 rounded-full overflow-hidden mt-1 bg-muted">
                {stappen.map((stap, i) => (
                  <div
                    key={i}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                    style={{
                      width: `${Math.min(stap.percentage, 100)}%`,
                      backgroundColor: `hsl(${142 + i * 30}, 60%, ${50 + i * 5}%)`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuleren
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || totaalPercentage !== 100}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Opslaan..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit template wordt permanent verwijderd. Bestaande projecten die dit
              template gebruiken worden niet beïnvloed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </m.div>
  );
}
