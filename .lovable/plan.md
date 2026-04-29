## Plan: Replace Lovable favicon with Manifest Malawi favicon

### What will change
- Create a small custom favicon that matches the uploaded reference: a dark navy rounded square with a gold “M”.
- Add modern favicon formats so browser tabs use the Manifest Malawi icon instead of the default Lovable icon:
  - `/favicon.svg` for modern browsers
  - `/favicon.png` for fallback support
  - `/favicon.ico` because many browsers request this path automatically
- Update `index.html` to explicitly reference the new favicon files.
- Keep the favicon visually aligned with the existing brand: deep navy and gold.

### Technical details
- Replace the existing `public/favicon.ico` so it cannot continue overriding the custom icon.
- Add favicon link tags in the document head, for example:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/favicon.png" />
```

- Generate the icon assets in `public/` so they are served from the site root and available immediately after publishing.

### Files to modify
- `index.html`
- `public/favicon.ico`
- Add `public/favicon.svg`
- Add `public/favicon.png`