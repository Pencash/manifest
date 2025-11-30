const LoadingFallback = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div>
            <div className="h-3 w-40 rounded-full bg-muted" />
            <div className="mt-2 h-3 w-24 rounded-full bg-muted" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="space-y-3 rounded-lg border bg-card p-4 shadow">
              <div className="h-4 w-1/2 rounded-full bg-muted" />
              <div className="h-3 w-3/4 rounded-full bg-muted" />
              <div className="h-3 w-2/3 rounded-full bg-muted" />
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border bg-card p-6 shadow">
          <div className="h-4 w-32 rounded-full bg-muted" />
          <div className="grid gap-3 md:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-3 rounded-full bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingFallback;
