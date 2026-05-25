# LinkedIn social preview setup

## How it works

When someone shares `https://ledgerlens.up.railway.app/` on LinkedIn,
LinkedIn's crawler fetches the page's `<meta property="og:image">`
tag. This is the **Open Graph image** — a 1200×630 PNG that renders
as the link preview thumbnail.

The **favicon** (browser tab icon) is a separate concern — it's the
small icon next to the page title in Chrome/Safari/Firefox. LinkedIn
does not use the favicon for link previews.

## Asset paths

| Asset | Path | Purpose |
|---|---|---|
| OG image | `frontend/public/og/ledgerlens-og.png` | LinkedIn/Twitter/Slack link preview (1200×630) |
| Favicon SVG | `frontend/public/favicon.svg` | Modern browsers (scalable) |
| Favicon ICO | `frontend/public/favicon/favicon.ico` | Legacy browsers |
| Favicon 16px | `frontend/public/favicon/favicon-16x16.png` | Tab icon (small) |
| Favicon 32px | `frontend/public/favicon/favicon-32x32.png` | Tab icon (standard) |
| Apple touch | `frontend/public/favicon/apple-touch-icon.png` | iOS home screen (180px) |
| Android 192 | `frontend/public/favicon/android-chrome-192x192.png` | Android home screen |
| Android 512 | `frontend/public/favicon/android-chrome-512x512.png` | Android splash |
| Manifest | `frontend/public/favicon/site.webmanifest` | PWA metadata |

## Metadata wiring

`frontend/src/app/layout.tsx` sets:

```ts
metadataBase: new URL('https://ledgerlens.up.railway.app'),
openGraph: {
  images: [{ url: '/og/ledgerlens-og.png', width: 1200, height: 630 }],
},
twitter: {
  card: 'summary_large_image',
  images: ['/og/ledgerlens-og.png'],
},
```

`metadataBase` is critical — without it, Next.js emits a relative
`og:image` URL that LinkedIn's crawler can't resolve.

## How to verify locally

```bash
cd frontend
npm run social:verify
npm run build
```

Then inspect the built HTML:

```bash
grep 'og:image' .next/server/app/index.html
```

The `content` attribute must be an absolute URL like
`https://ledgerlens.up.railway.app/og/ledgerlens-og.png`.

## How to verify after deploy

1. Deploy to Railway (merge PR, wait for build).
2. Open [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/inspect/https%3A%2F%2Fledgerlens.up.railway.app%2F).
3. The inspector shows the OG image, title, and description.
4. If the old preview is cached, click **Refresh** to force a re-scrape.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Old preview cached | LinkedIn caches OG data aggressively | Use Post Inspector → Refresh |
| og:image URL 404 | Deploy not finished or path wrong | Wait for Railway build; check `/og/ledgerlens-og.png` loads in browser |
| Wrong dimensions | Image not 1200×630 | Regenerate with the script or replace manually |
| Relative URL in meta | `metadataBase` missing | Add `metadataBase: new URL('https://...')` in layout.tsx |
| Image too busy | Too much text at small size | Simplify the OG image; keep large title + one stat |
| No preview at all | Missing `og:image` meta tag | Check `npm run social:verify` passes |
