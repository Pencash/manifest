const PageLoadingFallback = () => {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading page...</p>
      </div>
    </div>
  );
};

export default PageLoadingFallback;
