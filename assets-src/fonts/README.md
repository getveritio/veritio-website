# Render fonts

Static TTF instances of Newsreader (wght 500/600) and IBM Plex Mono
(wght 400/500/600), downloaded from Google Fonts. Used only by
`scripts/generate-alt-images.mjs` (resvg cannot read the woff2 files that
@fontsource ships); never served to browsers — the site loads fonts via
@fontsource in `src/styles/global.css`.

Both families are licensed under the SIL Open Font License 1.1:
- Newsreader — https://fonts.google.com/specimen/Newsreader/license
- IBM Plex Mono — https://fonts.google.com/specimen/IBM+Plex+Mono/license
