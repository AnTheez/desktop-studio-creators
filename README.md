<div align="center">

# Desktop Studio Creator Kit

### Make the desktop feel alive — one widget, theme, sound, cursor, and idea at a time.

An open toolkit for building portable customizations for **Desktop Studio**.
Create with familiar web technologies, expose clean editing controls, validate locally,
and keep ownership of what you make.

[![License: MIT](https://img.shields.io/badge/Creator_Kit-MIT-7c6cff?style=flat-square)](LICENSE)
![Format](https://img.shields.io/badge/package_format-v1-43d9ad?style=flat-square)
![Offline first](https://img.shields.io/badge/runtime-offline_first-2f81f7?style=flat-square)
![Native code](https://img.shields.io/badge/native_binaries-blocked-f85149?style=flat-square)

[Start creating](#your-first-widget) · [Widget format](docs/WIDGET-FORMAT.md) · [Example](examples/hello-widget) · [Contribute](CONTRIBUTING.md)

</div>

> [!IMPORTANT]
> **The ecosystem is open; the host application is paid.** This repository contains the
> public creator contract, schemas, examples, and tools. It does not license or distribute
> the proprietary Desktop Studio application.

## A canvas for desktop creators

Desktop Studio is designed so a customization is not a flattened preset that nobody can
edit. A package can describe its own content, sensible defaults, user-facing controls,
permissions, provenance, and version — while the host keeps installation and runtime safe.

| Create | What it can become | Creator Kit status |
| --- | --- | --- |
| **DOM Widgets** | Clocks, notes, meters, calendars, focus tools, visualizers | Available now |
| **Complete themes** | Coordinated wallpapers, widgets, effects, sounds, and cursors | Contract in development |
| **Wallpapers** | Image, GIF, video, and safe local web scenes | Contract in development |
| **Cursor packs** | Complete Windows cursor roles with animation and hotspots | Contract in development |
| **Sound packs** | Individually configurable Windows event sounds | Contract in development |
| **Companions & 3D** | Sprite companions and bounded GLB, GLTF, or VRM scenes | Contract in development |

The public format only promises features that the shipping host implements and tests.
Reserved capabilities remain clearly marked instead of silently becoming unstable APIs.

## Your work stays yours

- You retain ownership of your original art, code, audio, and package design.
- You choose whether your package is private, shared for free, or distributed commercially.
- Creator Kit code and examples use the permissive [MIT License](LICENSE).
- Package provenance can record the author, license, source, and dependencies.
- The Desktop Studio name, application code, and official commercial assets are separate
  from this license.

The long-term goal is a healthy creator ecosystem: open formats and tools, a paid polished
host, free community creations, and room for creators to publish premium work later.

## Your first widget

You only need **Node.js 22+** for the included validator. The widget itself is ordinary
local HTML, CSS, and JavaScript with no build framework required.

```bash
git clone https://github.com/AnTheez/desktop-studio-creators.git
cd desktop-studio-creators
npm test
```

Copy [`examples/hello-widget`](examples/hello-widget), give it a stable namespaced ID, and
start editing:

```text
my-widget/
├── manifest.json       identity, size, permissions, editable properties
├── index.html          local entry point
├── styles.css          visual design
├── widget.js           bounded lifecycle behavior
├── settings.json       default values
└── assets/             local images, fonts, and media
```

A minimal manifest stays readable:

```json
{
  "formatVersion": 1,
  "id": "your-name.hello-widget",
  "type": "widget",
  "name": "Hello Widget",
  "version": 1,
  "entryPoint": "index.html",
  "defaultSize": { "width": 360, "height": 180 },
  "runtime": "dom",
  "permissions": []
}
```

Run the validator against any package folder:

```bash
node tools/validate-widget.mjs path/to/my-widget
```

Read the complete [DOM Widget format v1](docs/WIDGET-FORMAT.md) before publishing a package.

## Settings without building a settings screen

Declare properties in `manifest.json`, and Desktop Studio can generate understandable
Inspector controls for the user:

```json
{
  "properties": {
    "title": {
      "type": "text",
      "default": "Hello desktop",
      "label": "Title"
    },
    "accent": {
      "type": "color",
      "default": "#9d8cff",
      "label": "Accent"
    },
    "cornerRadius": {
      "type": "slider",
      "default": 24,
      "label": "Corner radius",
      "min": 0,
      "max": 60,
      "step": 1
    }
  }
}
```

This keeps packages easy to customize and makes the same controls work consistently in the
editor, preview, and desktop runtime.

## Open does not mean unsafe

Community packages are treated as untrusted input. Desktop Studio validates before install,
runs DOM Widgets in a sandbox, blocks remote resources by default, and grants only bounded
capabilities declared by the package and allowed by host policy.

Packages cannot use:

- native `.exe` or `.dll` payloads;
- absolute paths, path traversal, or reparse points;
- arbitrary filesystem, registry, process, or Windows API access;
- hidden downloads or undeclared permissions.

Known permission names are `audio`, `systemMetrics`, `input`, `network`, and `storage`.
Declaring one is a request, not an automatic grant. Most widgets should request none.

## Why a separate Creator Kit?

Keeping the creator contract separate gives both sides a clean boundary:

- creators can inspect, discuss, test, and improve formats without receiving proprietary
  application code;
- Desktop Studio can remain a supported commercial product with Steam delivery, safe
  system integration, updates, and ownership verification;
- package formats can evolve through versioned public proposals instead of undocumented
  implementation details;
- community content stays portable and does not depend on secret APIs.

## Project stage

Desktop Studio and its Creator Kit are under active pre-1.0 development for Windows. DOM
Widget v1 is the first published creator surface. Theme, wallpaper, cursor, sound, companion,
3D, packaging, and Workshop contracts will be published only as their validators and runtime
behavior become ready.

Ideas and improvements are welcome through issues and pull requests. Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before proposing a new permission, runtime, or package
capability.

<div align="center">

**Build something useful. Make it unmistakably yours. Share it safely.**

</div>
