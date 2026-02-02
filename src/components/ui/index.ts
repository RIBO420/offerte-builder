/**
 * UI Components Barrel Export
 *
 * Central export file for all UI components.
 * Import components from '@/components/ui' instead of individual files.
 */

// Base components
export { Button, buttonVariants } from "./button";
export { Input } from "./input";
export { Label } from "./label";
export { Textarea } from "./textarea";
export { Checkbox } from "./checkbox";
export { Switch } from "./switch";
export { Separator } from "./separator";
export { Skeleton } from "./skeleton";
export { Progress } from "./progress";

// Select
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

// Radio Group
export { RadioGroup, RadioGroupItem } from "./radio-group";

// Card
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

// Alert
export { Alert, AlertDescription, AlertTitle } from "./alert";

// Badge
export { Badge, badgeVariants } from "./badge";

// Tabs
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

// Table
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

// Dialog
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

// Alert Dialog
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

// Sheet
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

// Popover
export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

// Tooltip
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// Command (Command Palette / Search)
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

// Breadcrumb
export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

// Scroll Area
export { ScrollArea, ScrollBar } from "./scroll-area";

// Calendar
export { Calendar } from "./calendar";

// Collapsible
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

// Form
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "./form";

// Toast (Sonner)
export { Toaster } from "./sonner";

// Sidebar
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./sidebar";

// Custom UI Components

// Status & Feedback
export { StatusBadge } from "./status-badge";
export { ScopeTag } from "./scope-tag";
export { EmptyState } from "./empty-state";
export { TrendIndicator } from "./trend-indicator";
export { MargeIndicator } from "./marge-indicator";
export { AutoSaveIndicator } from "./auto-save-indicator";
export { CalculationFeedback } from "./calculation-feedback";
export { ErrorRecovery } from "./error-recovery";

// Data Display
export { AnimatedNumber } from "./animated-number";
export { PriceDisplay } from "./price-display";
export { HighlightOnChange } from "./highlight-on-change";
export { Sparkline } from "./sparkline";
export { DonutChart, DonutChartWithLegend, MiniDonut } from "./donut-chart";
export { PriceBreakdownChart } from "./price-breakdown-chart";
export { ScopeCostDistribution } from "./scope-cost-distribution";
export { DataCard } from "./data-card";
export { StatsGrid } from "./stats-grid";

// Forms & Input
export { NumberInput } from "./number-input";
export { SmartInput } from "./smart-input";
export { InputWithFeedback } from "./input-with-feedback";
export { FormFieldFeedback } from "./form-field-feedback";
export { ValidationSummary } from "./validation-summary";
export { FormSection } from "./form-section";
export { AddressFieldGroup } from "./address-field-group";
export { SignaturePadComponent as SignaturePad } from "./signature-pad";

// Navigation & Layout
export { SmartBreadcrumb } from "./smart-breadcrumb";
export { WizardStepper } from "./wizard-stepper";
export { ResponsiveTable } from "./responsive-table";
export { FloatingActionBar } from "./floating-action-bar";
export { PipelineView } from "./pipeline-view";

// Mobile & Touch
export { BottomSheet, BottomSheetTrigger, BottomSheetClose } from "./bottom-sheet";
export { SwipeableRow } from "./swipeable-row";
export { LongPressMenu } from "./long-press-menu";
export { OfflineIndicator, useOnlineStatus } from "./offline-indicator";

// Accessibility
export { AccessibleLoading, LoadingOverlay } from "./accessible-loading";
export { LiveRegion, LiveRegionProvider } from "./live-region";
export { SkipLink } from "./skip-link";

// Progress
export { PDFProgressModal } from "./pdf-progress-modal";

// Typography
export {
  Heading,
  Text,
  Caption,
  TextLabel,
  headingVariants,
  textVariants,
} from "./typography";

// Types - Re-export important types
export type { OfflineIndicatorProps } from "./offline-indicator";
export type { BottomSheetProps } from "./bottom-sheet";
export type { DonutSegment, DonutChartProps, DonutChartWithLegendProps, MiniDonutProps } from "./donut-chart";
export type { HeadingProps, TextProps, CaptionProps, TextLabelProps } from "./typography";
export type { StatusBadgeProps, StatusDotProps } from "./status-badge";
export type { EmptyStateProps, EmptyStateAction } from "./empty-state";
export type { ErrorRecoveryProps, ErrorAction, InlineErrorProps } from "./error-recovery";
