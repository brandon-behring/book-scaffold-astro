# `@brandon_m_behring/book-scaffold-astro`

Astro 6 + MDX infrastructure for long-form technical books: typed presets,
Tufte-inspired layouts, citations and cross-references, search, print/PDF
output, study-guide components, and fail-loud authoring checks.

Start a book with the lock-step CLI:

```bash
npx @brandon_m_behring/create-book my-book --preset=academic
cd my-book
npm install
npm run dev
```

Available presets are `academic`, `tools`, `minimal`, `course-notes`, and
`research-portfolio`. See the
[repository README](https://github.com/brandon-behring/book-scaffold-astro)
for the current release overview, and
[PACKAGE_DESIGN.md](https://github.com/brandon-behring/book-scaffold-astro/blob/main/PACKAGE_DESIGN.md)
for the complete API contract.

Astro builds emit a Cloudflare-compatible `dist/_headers` with audited
security defaults. A consumer-owned `public/_headers` wins unchanged;
`defineBookConfig({ securityHeaders: false })` disables scaffold emission,
and `securityHeaders.contentSecurityPolicy` replaces only the default CSP.
See [Recipe 05](./recipes/05-deploy-cloudflare.md#default-security-headers).

## Interactive demos

The opt-in `@brandon_m_behring/book-scaffold-astro/demo` entry exports
`DemoFrame`, `Slider`, `StatCards`, and `useThemeColors` for consumer-owned
Preact islands. Import `styles/demo.css` explicitly; no demo is mounted and no
domain kernel or data loader is bundled automatically. See
[Recipe 23](./recipes/23-interactive-demo-substrate.md).

## Licensing

Code, configuration, and scripts are MIT-licensed. Recipes, pedagogy, examples,
and substantive documentation are CC BY 4.0. Both scoped license files ship in
the package as `LICENSE` and `LICENSE-CONTENT`.
