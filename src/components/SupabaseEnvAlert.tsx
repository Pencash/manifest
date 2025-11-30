import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMissingSupabaseEnvVars } from "@/lib/env";

const SupabaseEnvAlert = () => {
  const missingEnvVars = getMissingSupabaseEnvVars();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="max-w-xl border-destructive/30 bg-destructive/5 shadow-lg">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold">Supabase configuration required</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn&apos;t start the app because required Supabase environment variables are missing.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Missing variables</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {missingEnvVars.map((envVar) => (
                <li key={envVar} className="font-mono text-foreground">
                  {envVar}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg bg-muted p-3">
            <p className="font-medium text-foreground">How to fix</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Set the variables above in your <code>.env</code> file or hosting provider.</li>
              <li>Redeploy or restart the Vite dev server so the changes take effect.</li>
              <li>Reload this page.</li>
            </ol>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="default" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reload app
            </Button>
            <Button
              variant="ghost"
              asChild
            >
              <a
                href="https://supabase.com/dashboard/project/_/settings/api"
                target="_blank"
                rel="noreferrer"
              >
                View Supabase API keys
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseEnvAlert;
