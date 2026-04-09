

## Plan: Elevate Dashboard UI to Premium Quality

Inspired by the reference screenshot (PayMeGPT dashboard), the goal is to make cards feel more three-dimensional, metrics more scannable, and navigation links more actionable — while keeping the existing Devotional Modernism brand (navy, gold, ivory).

### What changes

**1. Card elevation and depth (both dashboards)**
- Add subtle inner glow/gradient borders and stronger shadow layers to stat cards so they "pop" off the background
- Use a faint colored top-border or left-border accent per card (already partially done on admin; refine with softer gradients)
- Add a subtle background gradient on stat icon containers (instead of flat `bg-muted`) for a glassy, 3D feel
- Slightly increase card border-radius for a more modern look

**2. Admin Dashboard stat cards — add actionable links**
- Each stat card gets a clickable link at the bottom (e.g., "Total Givings" → "View reports ›", "Active Members" → "Manage members ›", "Pending Approvals" → "Review now ›")
- Matches the reference pattern where each metric card has a drill-down link

**3. Member Dashboard stat cards — enhance visual weight**
- Make the stat number larger and bolder with the mono font
- Add a subtle colored underline or accent bar below the number
- Ensure the icon container has a gradient background matching the card's accent color

**4. Global card component upgrade**
- Update `src/components/ui/card.tsx` default styles to include a slightly stronger shadow (`shadow-md` baseline) and smoother hover transitions
- Add a new `.card-elevated` utility class in `index.css` for premium cards with layered box-shadows

**5. Icon containers**
- Replace flat `bg-muted` icon backgrounds with semi-transparent colored backgrounds matching each card's theme color (already done on admin, bring to member dashboard too)
- Add a subtle border to icon containers for depth

**6. Activity Support Funds section (admin)**
- Add subtle background tinting to each sub-card (green for available, amber for funded, etc.) for faster visual scanning
- Keep the mono font for numbers

### Technical details

**Files to modify:**
- `src/index.css` — add `.card-elevated` utility with layered box-shadows and hover state
- `src/components/ui/card.tsx` — upgrade default shadow from `shadow-sm` to `shadow-md`, add smooth hover transition
- `src/pages/AdminDashboard.tsx` — add drill-down links to stat cards, refine icon container styling, add semantic background tints to the funds snapshot cards
- `src/pages/Dashboard.tsx` — upgrade stat card styling with gradient icon backgrounds, larger numbers, and accent underlines

**No new dependencies.** All changes are CSS/Tailwind + minor JSX additions.

### What stays the same
- Color palette (navy, gold, ivory, sage, terracotta)
- Typography (DM Serif Display, Source Sans 3, JetBrains Mono)
- Layout structure and data logic
- Framer Motion animations

