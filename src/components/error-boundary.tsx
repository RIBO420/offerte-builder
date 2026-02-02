"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, BarChart3, FileText, Download } from "lucide-react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Optional context for error categorization in Sentry */
  context?: string;
  /** Optional callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to Sentry with component stack
    const eventId = Sentry.captureException(error, {
      tags: {
        context: this.props.context || "component",
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
    this.setState({ eventId });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Er is iets misgegaan</h2>
            <p className="text-muted-foreground max-w-md">
              Er is een onverwachte fout opgetreden. Probeer de pagina te
              vernieuwen of ga terug naar het dashboard.
            </p>
            {this.state.eventId && (
              <p className="text-xs text-muted-foreground">
                Fout ID: {this.state.eventId}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Probeer opnieuw
            </Button>
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const handleError = React.useCallback(
    (error: Error, context?: Record<string, unknown>) => {
      Sentry.captureException(error, {
        extra: context,
      });
    },
    []
  );

  return { handleError };
}

// ============================================================================
// SPECIALIZED ERROR BOUNDARIES
// ============================================================================

/**
 * ChartErrorBoundary - Specialized error boundary for chart components
 *
 * Charts can fail due to invalid data, missing dependencies, or rendering issues.
 * This boundary provides a chart-specific fallback UI.
 */
interface ChartErrorBoundaryProps {
  children: React.ReactNode;
  /** Title of the chart for context in error message */
  chartTitle?: string;
  /** Optional height to maintain layout consistency */
  height?: number | string;
  /** Called when chart error occurs */
  onError?: (error: Error) => void;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: {
        context: "chart",
        chartTitle: this.props.chartTitle || "unknown",
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const height = this.props.height || 300;

      return (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm">
                {this.props.chartTitle || "Grafiek"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-col items-center justify-center text-center gap-3 bg-muted/30 rounded-lg"
              style={{ height: typeof height === "number" ? `${height}px` : height }}
            >
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">Grafiek kon niet worden geladen</p>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Mogelijk zijn de gegevens ongeldig of ontbreken er waarden.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Opnieuw proberen
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * PDFErrorBoundary - Specialized error boundary for PDF generation components
 *
 * PDF generation can fail due to font loading, large documents, or invalid content.
 * This boundary provides a PDF-specific fallback UI with download retry.
 */
interface PDFErrorBoundaryProps {
  children: React.ReactNode;
  /** Document name for context */
  documentName?: string;
  /** Called when PDF error occurs */
  onError?: (error: Error) => void;
  /** Custom retry action (e.g., trigger PDF regeneration) */
  onRetry?: () => void;
}

interface PDFErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PDFErrorBoundary extends React.Component<
  PDFErrorBoundaryProps,
  PDFErrorBoundaryState
> {
  constructor(props: PDFErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PDFErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: {
        context: "pdf-generation",
        documentName: this.props.documentName || "unknown",
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-sm">PDF Fout</CardTitle>
            </div>
            <CardDescription>
              {this.props.documentName
                ? `Het document "${this.props.documentName}" kon niet worden gegenereerd.`
                : "Het PDF document kon niet worden gegenereerd."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Mogelijke oorzaken:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
                <li>Te veel gegevens in het document</li>
                <li>Ongeldige tekens in de inhoud</li>
                <li>Tijdelijke verbindingsproblemen</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
              >
                <Download className="mr-2 h-3 w-3" />
                Opnieuw genereren
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * DataFetchErrorBoundary - For components that fetch external data
 *
 * This boundary provides a data-specific fallback with retry functionality.
 */
interface DataFetchErrorBoundaryProps {
  children: React.ReactNode;
  /** Description of what data was being fetched */
  dataDescription?: string;
  /** Called when data fetch error occurs */
  onError?: (error: Error) => void;
  /** Custom retry action */
  onRetry?: () => void;
  /** Whether to show a compact version */
  compact?: boolean;
}

interface DataFetchErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class DataFetchErrorBoundary extends React.Component<
  DataFetchErrorBoundaryProps,
  DataFetchErrorBoundaryState
> {
  constructor(props: DataFetchErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<DataFetchErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: {
        context: "data-fetch",
        dataDescription: this.props.dataDescription || "unknown",
      },
      extra: {
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
      },
    });

    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const { compact = false } = this.props;

      if (compact) {
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded-md bg-muted/50">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="flex-1">
              {this.props.dataDescription
                ? `${this.props.dataDescription} kon niet worden geladen`
                : "Gegevens konden niet worden geladen"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={this.handleRetry}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
          <div className="rounded-full bg-muted p-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-sm">
              {this.props.dataDescription
                ? `${this.props.dataDescription} kon niet worden geladen`
                : "Gegevens konden niet worden geladen"}
            </p>
            <p className="text-xs text-muted-foreground">
              Controleer uw internetverbinding en probeer het opnieuw.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Opnieuw proberen
          </Button>
          {this.state.retryCount > 2 && (
            <p className="text-xs text-muted-foreground">
              Als dit probleem blijft bestaan, neem dan contact op met support.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// WRAPPER COMPONENTS FOR EASIER USE
// ============================================================================

/**
 * Wrapper component for wrapping charts with error boundary
 */
export function withChartErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  chartTitle?: string
) {
  return function ChartWithErrorBoundary(props: P) {
    return (
      <ChartErrorBoundary chartTitle={chartTitle}>
        <WrappedComponent {...props} />
      </ChartErrorBoundary>
    );
  };
}

/**
 * Wrapper component for wrapping PDF components with error boundary
 */
export function withPDFErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  documentName?: string
) {
  return function PDFWithErrorBoundary(props: P) {
    return (
      <PDFErrorBoundary documentName={documentName}>
        <WrappedComponent {...props} />
      </PDFErrorBoundary>
    );
  };
}

/**
 * Wrapper component for wrapping data-fetching components with error boundary
 */
export function withDataFetchErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  dataDescription?: string
) {
  return function DataFetchWithErrorBoundary(props: P) {
    return (
      <DataFetchErrorBoundary dataDescription={dataDescription}>
        <WrappedComponent {...props} />
      </DataFetchErrorBoundary>
    );
  };
}
