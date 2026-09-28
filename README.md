<div align="center">

# Desktop Studio Creator Kit

Build portable widgets, themes, wallpapers, cursor packs, sound packs, and desktop
experiences for Desktop Studio.

[Format guide](docs/WIDGET-FORMAT.md) · [Starter widget](examples/hello-widget) · [Contributing](CONTRIBUTING.md)

</div>

> [!IMPORTANT]
> This repository contains the open creator contract and tools. The Desktop Studio
> application itself is a separate paid product and is not licensed by this repository.

## What is open

- package specifications and JSON schemas;
- safe starter templates and examples;
- validation and packaging tools;
- documentation for the sandboxed creator APIs.

Creator Kit code and examples are available under the [MIT License](LICENSE). Creators
keep ownership of the original content they make and choose the terms for their packages.

## Current creator surface

The first supported public surface is the offline DOM Widget format. A widget is a local
folder containing `manifest.json`, `index.html`, optional settings, and local assets.
Desktop Studio renders it in a sandbox, blocks network access by default, and grants only
bounded capabilities declared in the manifest and allowed by the host.

```text
my-widget/
├── manifest.json
├── index.html
├── styles.css
├── widget.js
├── settings.json
└── assets/
```

Validate the included example with Node.js 22 or newer:

```bash
npm test
```

The package contract is versioned. Desktop Studio is still before version 1.0, so proposed
format changes are discussed here before they become part of a stable creator API.

## Safety boundary

Packages are untrusted content. Native executables, DLLs, absolute paths, traversal,
reparse points, hidden downloads, and arbitrary filesystem, registry, process, or native
API access are outside the Creator Kit contract.

## Product availability

Desktop Studio is in active development for Windows. Store availability and Workshop
publishing will be announced when the commercial release path is ready.

