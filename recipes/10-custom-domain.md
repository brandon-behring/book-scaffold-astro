# Recipe 10 — Custom domain on Cloudflare

**Profile**: any (deploy is profile-agnostic).

**TL;DR**: Free, ~5 minutes in the dashboard. Cloudflare auto-issues a TLS cert. Works for both apex (`my-book.com`) and subdomain (`book.my-site.com`).

## Prerequisites

- A working `wrangler.toml` deploy (recipe 05). URL: `https://<book-name>.<account>.workers.dev`.
- A domain you own. Either on Cloudflare DNS already, or willing to add an NS record at your registrar.
- ~5 minutes of dashboard time.

## Path 1 — Domain already on Cloudflare DNS

This is the smoothest path.

1. **Dashboard → Workers & Pages → your-book-name → Settings → Custom Domains → Add Custom Domain.**
2. Type the domain (`my-book.com` for apex, or `book.my-site.com` for subdomain).
3. Cloudflare auto-provisions:
   - DNS record (CNAME for subdomain, AAAA + A for apex)
   - TLS cert via Cloudflare's CA
4. Wait ~30 seconds for propagation. Visit the domain in a fresh tab.

That's the whole flow. The domain becomes the canonical URL; the `.workers.dev` URL still works as a fallback.

## Path 2 — Domain at an external registrar

Move DNS to Cloudflare first, then use Path 1. Two sub-steps:

1. **Dashboard → Websites → Add a Site → Free plan.** Enter your domain.
2. Cloudflare scans current DNS and shows the records. **Cloudflare then gives you 2 nameservers.**
3. **At your registrar**, replace the NS records with Cloudflare's 2 nameservers. Save.
4. Wait for propagation (15 min – 24 h, usually <1 hour). Cloudflare emails you when active.
5. Once active, follow Path 1.

## Apex vs subdomain

- **Apex (`my-book.com`)**: Cloudflare uses CNAME flattening. Apex with Workers + Static Assets is well-supported; no special config needed.
- **Subdomain (`book.my-site.com`)**: a plain CNAME record. The rest of `my-site.com` keeps whatever DNS it had.

## Removing the `.workers.dev` URL

The `<book-name>.<account>.workers.dev` URL keeps working alongside the custom domain. To disable it:

**Dashboard → Workers & Pages → your-book-name → Settings → Domains & Routes → workers.dev → toggle off.**

Most authors leave it on as a fallback / debugging surface.

## Common gotchas

- **"Site not active" after adding the domain**: NS records still propagating. Wait. `dig +short NS my-book.com` should return Cloudflare's nameservers when active.
- **TLS handshake failures for the first ~60 seconds**: cert issuance takes a moment after DNS resolves. Retry.
- **Mixed-content warnings**: rare with a static Astro build, but if you embedded any `http://` image URLs they'll fail under TLS. Use `//` or `https://`.
- **Cache TTL too long**: Cloudflare's default cache for Workers + Static Assets is 4 hours for the HTML and 1 year for fingerprinted assets. After redeploying, the HTML may serve stale for a few minutes. Purge: **Dashboard → Caching → Configuration → Purge Everything**.

## Sub-paths

Workers + Static Assets is best for whole-domain sites. If you want a book at `my-site.com/book/` and other content at `my-site.com/`, two options:

- Run two separate Workers, one per path, and use Cloudflare's Routes feature in `wrangler.toml`.
- Use Cloudflare's Path-based-routing in Workers — more setup, see Cloudflare docs.

Most authors prefer apex or subdomain.

## Canonical files

- `wrangler.toml` — name + assets config (recipe 05)
- Cloudflare dashboard — where the custom domain is wired up

## Reference

post-transformers ships at `post-transformers-guide.brandon-m-behring.workers.dev` (the default Workers subdomain). Custom domain not yet attached; the workflow above is the documented path for when it is.
