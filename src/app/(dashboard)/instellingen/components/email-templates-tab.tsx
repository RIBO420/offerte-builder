"use client";

import { useState, useCallback, useMemo } from "react";
import { m } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
  Save,
  Loader2,
  Mail,
  Copy,
  Info,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  offerte_verzonden: "Offerte verzonden",
  factuur_verzonden: "Factuur verzonden",
  herinnering_1: "Herinnering 1 (offerte)",
  herinnering_2: "Herinnering 2 (offerte)",
  herinnering_3: "Herinnering 3 (offerte)",
  aanmaning_1: "1e Aanmaning (factuur)",
  aanmaning_2: "2e Aanmaning (factuur)",
  ingebrekestelling: "Ingebrekestelling",
  oplevering: "Project opgeleverd",
  contract_verlenging: "Contract verlenging",
};

const TRIGGER_OPTIONS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const TRIGGER_VARIABLE_MAP: Record<string, string[]> = {
  offerte_verzonden: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "offerteNummer", "offerteBedrag", "offerteLink", "offerteType", "scopes"],
  herinnering_1: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "offerteNummer", "offerteBedrag", "offerteLink", "offerteType", "scopes"],
  herinnering_2: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "offerteNummer", "offerteBedrag", "offerteLink", "offerteType", "scopes"],
  herinnering_3: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "offerteNummer", "offerteBedrag", "offerteLink", "offerteType", "scopes"],
  factuur_verzonden: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "factuurNummer", "factuurBedrag", "betaalLink", "vervaldatum", "factuurDatum", "iban"],
  aanmaning_1: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "factuurNummer", "factuurBedrag", "betaalLink", "vervaldatum", "factuurDatum", "iban", "dagenVerlopen"],
  aanmaning_2: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "factuurNummer", "factuurBedrag", "betaalLink", "vervaldatum", "factuurDatum", "iban", "dagenVerlopen"],
  ingebrekestelling: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "factuurNummer", "factuurBedrag", "betaalLink", "vervaldatum", "factuurDatum", "iban", "dagenVerlopen"],
  oplevering: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "projectNaam", "projectAdres"],
  contract_verlenging: ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon", "projectNaam", "projectAdres", "contractEinddatum"],
};

const SAMPLE_DATA: Record<string, string> = {
  klantNaam: "Jan de Vries",
  bedrijfsNaam: "Top Tuinen",
  bedrijfsEmail: "info@toptuinen.nl",
  bedrijfsTelefoon: "0612345678",
  offerteNummer: "OFF-2026-001",
  offerteBedrag: "\u20AC 12.500,00",
  offerteLink: "https://app.toptuinen.nl/offerte/abc123",
  offerteType: "Tuinaanleg",
  scopes: "Grondwerk, Bestrating, Borders",
  factuurNummer: "FAC-2026-001",
  factuurBedrag: "\u20AC 12.500,00",
  betaalLink: "https://app.toptuinen.nl/betaal/abc123",
  vervaldatum: "15 april 2026",
  factuurDatum: "1 maart 2026",
  iban: "NL91 ABNA 0417 1643 00",
  dagenVerlopen: "14",
  projectNaam: "Tuinaanleg Familie De Vries",
  projectAdres: "Hoofdstraat 123, Amsterdam",
  contractEinddatum: "31 december 2026",
};

// ── Types ────────────────────────────────────────────────────────────

interface EmailTemplate {
  _id: Id<"emailTemplates">;
  naam: string;
  trigger: string;
  onderwerp: string;
  inhoud: string;
  variabelen: string[];
  actief: boolean;
  createdAt: number;
  updatedAt: number;
}

interface FormState {
  naam: string;
  trigger: string;
  onderwerp: string;
  inhoud: string;
  actief: boolean;
}

const EMPTY_FORM: FormState = {
  naam: "",
  trigger: "offerte_verzonden",
  onderwerp: "",
  inhoud: "",
  actief: true,
};

// ── Component ────────────────────────────────────────────────────────

interface EmailTemplatesTabProps {
  reducedMotion: boolean;
}

export function EmailTemplatesTab({ reducedMotion }: EmailTemplatesTabProps) {
  const templates = useQuery(api.emailTemplates.list, {});
  const createTemplate = useMutation(api.emailTemplates.create);
  const updateTemplate = useMutation(api.emailTemplates.update);
  const deleteTemplate = useMutation(api.emailTemplates.permanentDelete);
  const seedDefaults = useMutation(api.emailTemplates.seedDefaults);
  const resetToDefaults = useMutation(api.emailTemplates.resetToDefaults);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<FormState | null>(null);

  const isLoading = templates === undefined;
  const hasTemplates = templates && templates.length > 0;

  // Available variables for selected trigger
  const availableVariables = useMemo(
    () => TRIGGER_VARIABLE_MAP[form.trigger] ?? [],
    [form.trigger]
  );

  // Rendered preview with sample data
  const renderedPreview = useMemo(() => {
    if (!previewTemplate) return { onderwerp: "", inhoud: "" };

    const replaceVars = (text: string): string =>
      text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        SAMPLE_DATA[key] ?? match
      );

    return {
      onderwerp: replaceVars(previewTemplate.onderwerp),
      inhoud: replaceVars(previewTemplate.inhoud),
    };
  }, [previewTemplate]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleOpenCreate = useCallback(() => {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setEditDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((template: EmailTemplate) => {
    setEditingTemplate(template);
    setForm({
      naam: template.naam,
      trigger: template.trigger,
      onderwerp: template.onderwerp,
      inhoud: template.inhoud,
      actief: template.actief,
    });
    setEditDialogOpen(true);
  }, []);

  const handleOpenPreview = useCallback((template: EmailTemplate | FormState) => {
    setPreviewTemplate({
      naam: template.naam,
      trigger: template.trigger,
      onderwerp: template.onderwerp,
      inhoud: template.inhoud,
      actief: template.actief,
    });
    setPreviewDialogOpen(true);
  }, []);

  const handleOpenDelete = useCallback((template: EmailTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.naam.trim()) {
      toast.error("Vul een naam in");
      return;
    }
    if (!form.onderwerp.trim()) {
      toast.error("Vul een onderwerp in");
      return;
    }
    if (!form.inhoud.trim()) {
      toast.error("Vul de inhoud in");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate({
          id: editingTemplate._id,
          naam: form.naam,
          trigger: form.trigger,
          onderwerp: form.onderwerp,
          inhoud: form.inhoud,
          actief: form.actief,
        });
        toast.success("Template bijgewerkt");
      } else {
        await createTemplate({
          naam: form.naam,
          trigger: form.trigger,
          onderwerp: form.onderwerp,
          inhoud: form.inhoud,
          actief: form.actief,
        });
        toast.success("Template aangemaakt");
      }
      setEditDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fout bij opslaan template"
      );
    } finally {
      setIsSaving(false);
    }
  }, [form, editingTemplate, createTemplate, updateTemplate]);

  const handleToggleActief = useCallback(
    async (template: EmailTemplate) => {
      try {
        await updateTemplate({
          id: template._id,
          actief: !template.actief,
        });
        toast.success(
          template.actief ? "Template gedeactiveerd" : "Template geactiveerd"
        );
      } catch {
        toast.error("Fout bij wijzigen status");
      }
    },
    [updateTemplate]
  );

  const handleDelete = useCallback(async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate({ id: templateToDelete._id });
      toast.success("Template verwijderd");
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch {
      toast.error("Fout bij verwijderen template");
    }
  }, [templateToDelete, deleteTemplate]);

  const handleSeedDefaults = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await seedDefaults({});
      toast.success(`${result.count} standaard templates aangemaakt`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Fout bij aanmaken standaard templates"
      );
    } finally {
      setIsSaving(false);
    }
  }, [seedDefaults]);

  const handleResetToDefaults = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await resetToDefaults({});
      toast.success(
        `Templates gereset. ${result.count} standaard templates hersteld.`
      );
      setResetDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fout bij herstellen templates"
      );
    } finally {
      setIsSaving(false);
    }
  }, [resetToDefaults]);

  const handleInsertVariable = useCallback(
    (variable: string) => {
      const tag = `{{${variable}}}`;
      setForm((prev) => ({
        ...prev,
        inhoud: prev.inhoud + tag,
      }));
      toast.success(`${tag} toegevoegd`, { duration: 1500 });
    },
    []
  );

  const handleCopyVariable = useCallback((variable: string) => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    toast.success(`{{${variable}}} gekopieerd`, { duration: 1500 });
  }, []);

  // ── Render ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <m.div
        key="email-templates"
        initial={reducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center py-12"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </m.div>
    );
  }

  return (
    <m.div
      key="email-templates"
      initial={reducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? {} : { opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle>E-mail Templates</CardTitle>
                <CardDescription>
                  Beheer de standaardteksten voor alle e-mails die verstuurd
                  worden vanuit het systeem. Gebruik variabelen zoals{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {"{{klantNaam}}"}
                  </code>{" "}
                  om dynamische content toe te voegen.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasTemplates && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetDialogOpen(true)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Standaard herstellen
                </Button>
              )}
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe template
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Empty state */}
      {!hasTemplates && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Geen e-mail templates
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Er zijn nog geen e-mail templates aangemaakt. Maak standaard
              templates aan om te beginnen, of maak zelf een nieuwe template.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleSeedDefaults} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Standaard templates aanmaken
              </Button>
              <Button variant="outline" onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Table */}
      {hasTemplates && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Onderwerp</TableHead>
                  <TableHead className="text-center">Actief</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template._id}>
                    <TableCell className="font-medium">
                      {template.naam}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {TRIGGER_LABELS[template.trigger] ?? template.trigger}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {template.onderwerp}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={template.actief}
                        onCheckedChange={() =>
                          handleToggleActief(template as EmailTemplate)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenPreview(template as EmailTemplate)
                          }
                          title="Voorbeeld bekijken"
                          aria-label="Voorbeeld bekijken"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenEdit(template as EmailTemplate)
                          }
                          title="Bewerken"
                          aria-label="Bewerken"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleOpenDelete(template as EmailTemplate)
                          }
                          title="Verwijderen"
                          aria-label="Verwijderen"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Edit/Create Dialog ─────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Template bewerken" : "Nieuwe template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Pas de template aan en sla op."
                : "Maak een nieuwe e-mail template aan."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Row 1: Naam + Trigger */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-naam">Naam</Label>
                <Input
                  id="template-naam"
                  value={form.naam}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, naam: e.target.value }))
                  }
                  placeholder="Bijv. Offerte verzonden"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-trigger">Trigger</Label>
                <Select
                  value={form.trigger}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, trigger: value }))
                  }
                >
                  <SelectTrigger id="template-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Onderwerp */}
            <div className="space-y-2">
              <Label htmlFor="template-onderwerp">Onderwerp</Label>
              <Input
                id="template-onderwerp"
                value={form.onderwerp}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, onderwerp: e.target.value }))
                }
                placeholder="Bijv. Offerte {{offerteNummer}} van {{bedrijfsNaam}}"
              />
              <p className="text-xs text-muted-foreground">
                Gebruik {"{{variabelen}}"} voor dynamische content in het
                onderwerp.
              </p>
            </div>

            {/* Row 3: Inhoud + Variables panel */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="template-inhoud">Inhoud (HTML)</Label>
                <Textarea
                  id="template-inhoud"
                  value={form.inhoud}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, inhoud: e.target.value }))
                  }
                  placeholder="<p>Beste {{klantNaam}},</p>"
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              {/* Variable Reference Panel */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Beschikbare variabelen
                </Label>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 max-h-[300px] overflow-y-auto">
                  {availableVariables.map((variable) => (
                    <div
                      key={variable}
                      className="flex items-center justify-between gap-1 rounded-md bg-background px-2 py-1.5 text-xs"
                    >
                      <code className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {`{{${variable}}}`}
                      </code>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleInsertVariable(variable)}
                          title="Invoegen in inhoud"
                          aria-label="Invoegen in inhoud"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => handleCopyVariable(variable)}
                          title="Kopieer naar klembord"
                          aria-label="Kopieer naar klembord"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 4: Actief toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="template-actief">Actief</Label>
                <p className="text-xs text-muted-foreground">
                  Alleen actieve templates worden gebruikt bij het versturen van
                  e-mails.
                </p>
              </div>
              <Switch
                id="template-actief"
                checked={form.actief}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, actief: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenPreview(form)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Voorbeeld
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ─────────────────────────────────────────── */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voorbeeld e-mail</DialogTitle>
            <DialogDescription>
              Preview met voorbeelddata. Variabelen worden vervangen door
              echte waarden bij het versturen.
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4 py-4">
              {/* Subject preview */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Onderwerp
                </Label>
                <div className="rounded-md border bg-muted/30 p-3 font-medium">
                  {renderedPreview.onderwerp}
                </div>
              </div>

              {/* Body preview */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Inhoud
                </Label>
                <div
                  className="rounded-md border bg-white p-6 prose prose-sm max-w-none dark:bg-zinc-950 dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: renderedPreview.inhoud,
                  }}
                />
              </div>

              {/* Info box */}
              <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Dit is een vereenvoudigd voorbeeld. De daadwerkelijke e-mail
                  wordt opgemaakt met de volledige e-mail styling inclusief
                  header, footer en bedrijfsgegevens.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Reset Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Standaard templates herstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert alle huidige templates en maakt de standaard
              templates opnieuw aan. Eventuele aanpassingen gaan verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetToDefaults}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Herstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de template &quot;{templateToDelete?.naam}&quot;
              wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </m.div>
  );
}
