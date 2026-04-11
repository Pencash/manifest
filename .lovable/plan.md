

## Plan: Fix "Importing a module script failed" Error

### Root cause

This is a **stale deployment chunk** issue. When Vite rebuilds the app, it generates new chunk filenames (e.g., `AdminGivings-abc123.js`). If a user's browser has the old `index.html` cached, clicking a lazy-loaded route tries to fetch a chunk filename that no longer exists on the server, causing "Importing a module script failed."

This is especially common with `React.lazy()` routes — the user loads the app, a new deployment happens (or the browser has stale cache), and clicking a not-yet-loaded route fails.

### What changes

1. **Add a global chunk load error handler** in `src/main.tsx` that detects module import failures and automatically reloads the page once (to fetch the new HTML with correct chunk references)

2. **Clean up stray file** — remove the root-level `AdminGivings.tsx` file that doesn't belong there (the real one is at `src/pages/AdminGivings.tsx`)

### Technical details

**`src/main.tsx`** — Add a window error listener before `ReactDOM.createRoot`:
```typescript
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});
```

Vite 5 emits a `vite:preloadError` event when a dynamic import fails due to missing chunks. Listening for this event and triggering a single reload fetches the updated HTML with correct chunk paths, resolving the error transparently.

**Root `AdminGivings.tsx`** — Delete this stray file (it's a duplicate of `src/pages/AdminGivings.tsx`).

### Files to modify
- `src/main.tsx` — add `vite:preloadError` handler
- Delete `AdminGivings.tsx` (root level)

