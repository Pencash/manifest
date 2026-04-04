

## Plan: Hybrid Filtering for Payment Verification

### What changes

Add a **Giver name search box** and a **Giving Type dropdown filter** to the existing filter bar on the Payment Verification page, alongside the current Status and Payment Method filters.

### How it works

1. **Giver search** — A text input with a search icon. Filters the table client-side by matching the giver's name (case-insensitive partial match). Debounced so it feels responsive.

2. **Giving Type filter** — A dropdown with options: All Types, Tithe, Offering, First Fruit, Pledge. Filters via the Supabase query (server-side) like the existing filters.

3. **Filter bar layout** — All four filters sit in a single row that wraps on mobile:
   - Status dropdown
   - Payment Method dropdown
   - Giving Type dropdown
   - Giver search input

### Technical details

**File: `src/pages/FinancialPaymentVerification.tsx`**
- Add `filterGivingType` state (default `"all"`)
- Add `searchGiver` state (default `""`)
- Pass `filterGivingType` to `useGivingsList`
- Apply client-side `searchGiver` filter on the rendered `givings` array (filter by `giving.profiles.full_name`)
- Add the Giving Type `<Select>` and a search `<Input>` to the filter bar

**File: `src/hooks/useGivingsData.ts`**
- Update `useGivingsList` to accept a third parameter `filterGivingType`
- When not `"all"`, add `.eq("giving_type_id", filterGivingType)` to the query (using the type's ID)
- Alternative: filter by joining on `giving_types.name` — simpler to just pass the type name and filter client-side on the enriched data

**Simplest approach**: Both Giver search and Giving Type filter applied client-side on the already-fetched data (no hook changes needed). This avoids extra queries since the dataset is already loaded. Only if performance becomes an issue would we push filters server-side.

### Files to modify
- `src/pages/FinancialPaymentVerification.tsx` — add two new filter controls + client-side filtering logic

