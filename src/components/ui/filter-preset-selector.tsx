"use client";

import { useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Star,
  Trash2,
} from "lucide-react";
import {
  type FilterState,
  type FilterPreset,
} from "@/hooks/use-filter-presets";

interface FilterPresetSelectorProps<T extends FilterState> {
  presets: FilterPreset<T>[];
  defaultPresets: FilterPreset<T>[];
  userPresets: FilterPreset<T>[];
  currentFilters: T;
  onSelectPreset: (filters: T) => void;
  onSavePreset: (name: string, filters: T) => void;
  onDeletePreset: (id: string) => void;
  hasActiveFilters?: boolean;
  isDisabled?: boolean;
}

function FilterPresetSelectorComponent<T extends FilterState>({
  defaultPresets,
  userPresets,
  currentFilters,
  onSelectPreset,
  onSavePreset,
  onDeletePreset,
  hasActiveFilters = false,
  isDisabled = false,
}: FilterPresetSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSelectPreset = useCallback((preset: FilterPreset<T>) => {
    onSelectPreset(preset.filters);
    setIsOpen(false);
  }, [onSelectPreset]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    onSavePreset(presetName.trim(), currentFilters);
    setPresetName("");
    setIsSaveDialogOpen(false);
  }, [presetName, currentFilters, onSavePreset]);

  const handleDeletePreset = useCallback((id: string) => {
    onDeletePreset(id);
    setDeleteConfirmId(null);
  }, [onDeletePreset]);

  const handleOpenSaveDialog = useCallback(() => {
    setIsOpen(false);
    setIsSaveDialogOpen(true);
  }, []);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isDisabled}
          >
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Presets</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* Default presets */}
          {defaultPresets.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Star className="h-3 w-3" />
                Standaard presets
              </DropdownMenuLabel>
              {defaultPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="cursor-pointer"
                >
                  <span className="flex-1">{preset.name}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* User presets */}
          {userPresets.length > 0 && (
            <>
              {defaultPresets.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="flex items-center gap-2">
                <Bookmark className="h-3 w-3" />
                Mijn presets
              </DropdownMenuLabel>
              {userPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="cursor-pointer group"
                  onClick={() => handleSelectPreset(preset)}
                >
                  <span className="flex-1">{preset.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(preset.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Save current filters as preset */}
          {(defaultPresets.length > 0 || userPresets.length > 0) && (
            <DropdownMenuSeparator />
          )}
          <DropdownMenuItem
            onClick={handleOpenSaveDialog}
            className="cursor-pointer"
            disabled={!hasActiveFilters}
          >
            <BookmarkPlus className="h-4 w-4 mr-2" />
            <span>Opslaan als preset</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-auto text-xs">
                Actief
              </Badge>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save preset dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preset opslaan</DialogTitle>
            <DialogDescription>
              Sla de huidige filterinstellingen op als preset om ze later
              snel te kunnen gebruiken.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Naam</Label>
              <Input
                id="preset-name"
                placeholder="Bijv. Mijn favoriete filter"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && presetName.trim()) {
                    handleSavePreset();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
            >
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preset verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je deze preset wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeletePreset(deleteConfirmId)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export as memo component with generic type support
export const FilterPresetSelector = memo(FilterPresetSelectorComponent) as typeof FilterPresetSelectorComponent;
