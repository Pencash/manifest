import { useState, type ReactNode } from "react";
import { ChevronDown, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ResponsiveDataViewField {
  label: string;
  value: ReactNode;
}

interface ResponsiveDataViewRow {
  id: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  desktopCells: ReactNode[];
  essentials: ResponsiveDataViewField[];
  details?: ResponsiveDataViewField[];
  actions?: ReactNode;
}

interface ResponsiveDataViewProps {
  columns: string[];
  rows: ResponsiveDataViewRow[];
  emptyState: ReactNode;
  controls?: ReactNode;
  actionsHeader?: string;
  className?: string;
}

function MobileCardRow({ row, actionsHeader }: { row: ResponsiveDataViewRow; actionsHeader?: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(row.details?.length);

  return (
    <Card className="md:hidden border-border/70">
      <div className="space-y-4 p-4">
        {(row.title || row.subtitle) && (
          <div>
            {row.title && <p className="text-sm font-semibold text-foreground">{row.title}</p>}
            {row.subtitle && <p className="text-xs text-muted-foreground">{row.subtitle}</p>}
          </div>
        )}

        <dl className="space-y-3">
          {row.essentials.map((field) => (
            <div key={field.label} className="grid grid-cols-[auto,1fr] gap-3 text-sm">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt>
              <dd className="text-right font-medium text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>

        {hasDetails && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-0 text-primary hover:bg-transparent">
                {expanded ? "Hide details" : "Show details"}
                <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <dl className="space-y-3">
                {row.details?.map((field) => (
                  <div key={field.label} className="grid grid-cols-[auto,1fr] gap-3 text-sm">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</dt>
                    <dd className="text-right text-foreground">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {row.actions && (
        <div className="sticky bottom-0 border-t bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{actionsHeader || "Actions"}</p>
          <div className="grid gap-2 [&>*]:h-11 [&>*]:w-full [&>*]:justify-center">{row.actions}</div>
        </div>
      )}
    </Card>
  );
}

export function ResponsiveDataView({ columns, rows, emptyState, controls, actionsHeader = "Actions", className }: ResponsiveDataViewProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {controls && <div className="sticky top-0 z-20 -mx-1 rounded-lg border bg-background/95 p-3 backdrop-blur">{controls}</div>}

      {rows.length === 0 ? (
        emptyState
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {rows.map((row) => (
              <MobileCardRow key={row.id} row={row} actionsHeader={actionsHeader} />
            ))}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Table2 className="h-4 w-4" />
                  Show table fallback
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((column) => (
                          <TableHead key={column}>{column}</TableHead>
                        ))}
                        <TableHead className="text-right">{actionsHeader}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={`fallback-${row.id}`}>
                          {row.desktopCells.map((cell, index) => (
                            <TableCell key={`${row.id}-${index}`}>{cell}</TableCell>
                          ))}
                          <TableCell className="text-right">{row.actions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                  <TableHead className="text-right">{actionsHeader}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.desktopCells.map((cell, index) => (
                      <TableCell key={`${row.id}-desktop-${index}`}>{cell}</TableCell>
                    ))}
                    <TableCell className="text-right">{row.actions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

    </div>
  );
}

export type { ResponsiveDataViewField, ResponsiveDataViewRow, ResponsiveDataViewProps };
