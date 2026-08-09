# Remotion compositions for pre-rendered marketing media

Isolated from the Astro site so React/Remotion never enter the production
bundle. Rendered outputs land in `../public/media/`.

```bash
# from repo root
bun run remotion:studio   # preview
bun run remotion:render   # mp4 + poster
```

`--muted` matters: Remotion otherwise attaches a silent AAC track that costs
~10x more than the video itself. h264 also beats VP8/VP9 by a wide margin on
this flat, synthetic content, so there is no WebM source to fall back to.

Or from this folder:

```bash
bun install
bun run studio
bun run render
```

The EvidenceStream composition mirrors Veritio Cloud's dark evidence-stream
panel (zinc canvas, mono ledger, risk chart, hash-chain badge) with
demonstration data only.
