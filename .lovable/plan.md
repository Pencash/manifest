## Plan: Add Swipeable Looping Cards for Better Dashboard UX

Yes, it is possible. The better approach is to make the main card groups swipeable on small and medium screens, while keeping the clean grid layout on large desktop screens. This gives phone/tablet users the looped right-to-left swipe experience without making desktop users lose the fast overview of all cards.

### What will change

**1. Create a reusable dashboard card carousel pattern**
- Use the existing `Carousel` component already in the project.
- Enable `loop: true` so cards can continuously swipe from right to left and wrap back around.
- Add responsive slide widths:
  - Mobile: one card mostly visible, with a small preview of the next card
  - Tablet: two cards visible
  - Desktop: keep the existing grid where appropriate
- Add subtle left/right navigation buttons only where they are useful, while preserving touch swipe gestures.

**2. Admin dashboard cards**
- Convert the top KPI cards into a swipeable looping carousel on mobile/tablet.
- Keep the premium elevated card styling, accent side bars, icons, and click routing.
- Keep the desktop grid so admins can still scan all metrics quickly on wider screens.
- Apply the same carousel treatment to the Activity Snapshot cards, since those are also dashboard summary cards.

**3. Member dashboard cards**
- Convert the Quick Stats cards into a swipeable looping carousel on mobile/tablet.
- Convert Quick Actions into a swipeable carousel on mobile/tablet, while keeping the desktop grid.
- Keep all card click behavior and existing navigation paths unchanged.

**4. Accessibility and usability**
- Preserve keyboard arrow support through the existing carousel implementation.
- Add clear carousel labels for screen readers.
- Ensure cards remain clickable without interfering with swipe gestures.
- Keep enough spacing so the 3D elevated shadows are not clipped.

### What I would avoid

I would not make every card on every page globally swipeable. Some pages contain forms, tables, approval lists, and detailed records where swiping could make the interface harder to use or accidentally hide information. The best UX is to use looping swipe cards for dashboard-style summaries and quick action cards first.

### Technical details

Files to update:
- `src/components/ui/carousel.tsx`
  - Minor cleanup so `reInit` listeners are removed correctly.
  - Keep support for looped Embla carousel options.

- `src/pages/AdminDashboard.tsx`
  - Import `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, and `CarouselNext`.
  - Render the stat cards in a mobile/tablet carousel and preserve the current desktop grid.
  - Render Activity Snapshot cards in a mobile/tablet carousel and preserve desktop grid.

- `src/pages/Dashboard.tsx`
  - Import the carousel components.
  - Render member Quick Stats in a mobile/tablet carousel and preserve desktop grid.
  - Render Quick Actions in a mobile/tablet carousel and preserve desktop grid.

No database changes and no new dependencies are needed.