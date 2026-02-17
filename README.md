# Mini Browser (browser-based browser thing)

A tiny in-browser viewer with:

- URL bar + basic navigation controls
- Internal pages:
  - `duck://newtab` (clock/date + quick links)
  - `duck://extensions` (paste-in JavaScript extensions)
- Embedded page rendering via `iframe`

## Run

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Extensions

At `duck://extensions`, you can save simple JavaScript extensions:

- **Browser extensions**: run in the app context and can modify browser UI/state.
- **Page extensions**: attempt to inject into iframe pages (works when same-origin policy allows).

All extensions are stored in `localStorage`.

## Notes

Some websites block embedding with `X-Frame-Options` or CSP `frame-ancestors`. Those pages will not render in this mini browser because the restriction is enforced by the target site.
Page extension injection may also be blocked for cross-origin pages.
