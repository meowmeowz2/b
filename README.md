# Mini Browser (browser-based browser thing)

A tiny in-browser viewer with:

- URL/search input
- Back/forward/reload controls
- Embedded page rendering via `iframe`

## Run

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Notes

Some websites block embedding with `X-Frame-Options` or CSP `frame-ancestors`. Those pages will not render in this mini browser because the restriction is enforced by the target site.
