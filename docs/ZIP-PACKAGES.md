# Creator ZIP packages v1

Creator ZIPs carry portable components into Desktop Studio. The public contract covers
`widget`, `sticker`, `wallpaper`, `effect`, `companion`, and `3d` packages. This repository
provides MIT-licensed specifications, JSON schemas, examples, and creator tools. Desktop
Studio is a paid proprietary application; its application, runtime, Steam, licensing,
signing, and release code are not part of this toolkit.

## Build, validate, package

Use **Node.js 22 or newer**. The tools use Node's standard library and require no
third-party runtime dependencies.

```bash
git clone https://github.com/AnTheez/desktop-studio-creators.git
cd desktop-studio-creators
npm test
npm run validate -- examples/hello-widget
npm run package -- examples/hello-widget hello-widget.zip
```

The equivalent direct commands work for every supported component type:

```bash
node tools/validate-package.mjs path/to/my-package
node tools/package.mjs path/to/my-package my-package.zip
```

`validate-package` checks a **folder**, not an existing ZIP. The folder must contain
`manifest.json` at its root. `package` validates that folder, then writes a ZIP whose
manifest is also at the archive root. Choose an output path outside the source folder,
with an existing parent directory and a `.zip` extension. The tool refuses to overwrite
an existing output file and does not modify the source package.

`node tools/validate-widget.mjs path/to/my-widget` remains available for widget-only
validation. Desktop Studio performs its own validation on import; a successful local
check does not grant permissions or guarantee that every asset can be rendered.

## Archive layout

Prefer a manifest at the archive root:

```text
my-package.zip
├── manifest.json
├── index.html
└── assets/
    └── preview.png
```

The app also accepts a single wrapper folder containing the whole package:

```text
my-package.zip
└── my-package/
    ├── manifest.json
    ├── index.html
    └── assets/
        └── preview.png
```

Keep all package content inside that one root. Do not combine several component roots
or add another nested wrapper. Manifest paths are relative to the package root, so
`assets/preview.png` works in either accepted layout. The included packager always emits
the first layout.

## Identity and metadata

Every manifest requires these fields:

| Field | Contract |
| --- | --- |
| `formatVersion` | Integer `1`, identifying this package contract. |
| `id` | Stable namespaced ID, such as `your-name.weather-clock`. Use at least two dot-separated segments of letters, numbers, `_`, or `-`; total length is 3–128 characters. |
| `type` | One supported component type. |
| `name` | User-facing, nonblank name of at most 128 characters. |
| `version` | Integer from 1 to 1,000,000. Increase it when publishing a new revision of the same package. |

Keep the namespace and ID stable after publication. The manifest `version` is an integer,
not a semantic version string such as `"0.2.0"`. The toolkit itself uses semantic versions;
these are separate versioning contracts.

Recommended optional metadata:

| Field | Contract |
| --- | --- |
| `author` | Nonblank creator credit, at most 128 characters. |
| `license` | Nonblank license name or identifier, at most 128 characters. Declare the license for your content; this repository's MIT license does not determine your package's license. |
| `description` | Nonblank description, at most 2,000 characters; line breaks are allowed. |
| `tags` | Up to 32 nonblank tags, each at most 64 characters. |
| `dependencies` | Up to 64 nonblank provenance strings, each at most 256 characters. These do not authorize downloads or external access. |
| `preview` | Relative path to a bundled image, at most 10 MiB. |

Names, credits, license labels, tags, and dependency strings must not contain control
characters. JSON keys must be unique, including case-insensitive duplicates. Type-specific
fields are described below and in [`creator-manifest.schema.json`](../schemas/creator-manifest.schema.json).
Use the exact field casing shown in the schemas: for example, `permissions`, `runtime`,
`model.asset`, and a widget property's `type`. Case variants of known fields are rejected
at every schema level; unknown extension metadata remains allowed where the schema permits it.

## Widget example

Copy [`examples/hello-widget`](../examples/hello-widget), assign your own namespace, and
edit its local web files:

```text
my-widget/
├── manifest.json
├── index.html
├── styles.css
├── widget.js
├── settings.json
└── assets/
    └── preview.png
```

```json
{
  "formatVersion": 1,
  "id": "your-name.hello-widget",
  "type": "widget",
  "name": "Hello Widget",
  "version": 1,
  "author": "Your Name",
  "license": "MIT",
  "description": "A local desktop greeting.",
  "tags": ["greeting"],
  "preview": "assets/preview.png",
  "entryPoint": "index.html",
  "defaultSize": { "width": 360, "height": 180 },
  "settings": "settings.json",
  "runtime": "dom",
  "permissions": [],
  "properties": {
    "title": { "type": "text", "default": "Hello desktop", "label": "Title" }
  }
}
```

`entryPoint` must reference local `.html` or `.htm`. `defaultSize` requires width and
height from 32 to 10,000. Use `runtime: "dom"` and explicit `permissions: []` for a widget
that needs no host capabilities. Optional `settings` and `preview` files must exist.
If you do not include a preview, omit that field.

Properties support `slider`, `color`, `boolean`, `number`, `text`, and `select` Inspector
controls. Keep property keys stable to preserve user settings. See the
[DOM Widget format](WIDGET-FORMAT.md) for the lifecycle message contract and the
[widget schema](../schemas/widget-manifest.schema.json) for bounds.

## Sticker example

[`examples/hello-sticker`](../examples/hello-sticker) includes an original SVG and a
manifest. A sticker needs no JavaScript, runtime, or permissions:

```text
my-sticker/
├── manifest.json
└── star.svg
```

```json
{
  "formatVersion": 1,
  "id": "your-name.hello-sticker",
  "type": "sticker",
  "name": "Hello Star",
  "version": 1,
  "entryPoint": "star.svg",
  "preview": "star.svg",
  "author": "Your Name",
  "license": "MIT",
  "description": "An original portable SVG sticker.",
  "tags": ["star"]
}
```

```bash
npm run validate -- examples/hello-sticker
npm run package -- examples/hello-sticker hello-sticker.zip
```

## Other component types

All types use the same required identity and optional metadata. Files referenced by the
manifest must be bundled locally.

| Type | Content fields and supported files |
| --- | --- |
| `sticker` | `entryPoint` or `source`: `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.svg`, or `.gif`. |
| `wallpaper` | `entryPoint` or `source`: the image formats above, or `.mp4`, `.webm`, or `.m4v`. Local web wallpaper entry points are not part of this contract. |
| `effect` | `entryPoint` or `source`: a bounded `.dseffect` JSON definition. |
| `companion` | `runtime: "sprite"`, `model`, `defaultSize`, and `animations` including `idle`. |
| `3d` | `runtime`, `model`, and `defaultSize` for a local GLB, GLTF, or VRM model. |

For stickers, wallpapers, and effects, `entryPoint` and `source` are alternative fields.
If you include both, they must contain the same value. See the
[media schema](../schemas/media-manifest.schema.json).

An effect's source is data for the host's rain, snow, or fog generator, not arbitrary
effect code or a shader. For example, `rain.dseffect` may contain:

```json
{
  "formatVersion": 1,
  "properties": { "generator": "rain", "density": 0.55, "color": "#9caec7" }
}
```

The source is limited to 64 KiB. Only the bounded properties in the
[effect definition schema](../schemas/effect-definition.schema.json) are supported.

For companions, `model` contains `type` (`image`, `gif`, or `spriteSheet`) and local
`asset`. Image models accept PNG/JPEG/WebP, GIF models accept GIF, and sprite sheets
accept PNG/WebP. Width and height are 32–10,000. Each animation clip requires `id`,
`name`, positive `duration` up to 600 seconds, `loop`, and `tracks`; `tracks: []` is valid
for a static idle clip. Clips may also reference local sprite assets or frame rectangles.
See the [companion schema](../schemas/companion-manifest.schema.json) for defaults and
animation bounds.

For 3D, use `type: "3d"`. A `model` contains matching `type` and local `asset`: `glb`
with `.glb`, `gltf` with `.gltf`, or `vrm` with `.vrm`. GLB/GLTF use
`runtime: "threejs"`; VRM uses `runtime: "vrm"`. Width and height are 64–10,000.
Bundle any GLTF buffers and textures locally. GLTF `buffers[].uri` and `images[].uri`
resolve relative to the directory containing the `.gltf` file. They must point to existing
portable local files without traversal, or contain an embedded `data:` URI. Network and
absolute URIs are rejected. The contract also accepts the compatibility type
aliases `threeD`, `threejs`, and `vrm` with these exact spellings in the creator tools;
prefer `3d` for new packages. Optional bounded
defaults cover transforms, camera, lighting, animations, expressions, interaction, and
physics. See the [3D schema](../schemas/3d-manifest.schema.json).

## Local paths and sandbox rules

Use portable relative paths such as `assets/star.svg`. Prefer `/` separators. The tools
also normalize safe `\` separators. Referenced files must be inside the package; URLs,
drive letters, rooted paths, `.` or `..` segments, empty path segments, alternate data
streams, Windows reserved device names, and names with trailing spaces or dots are
rejected. The creator tools limit paths to 260 characters.

Packages are untrusted input. They must not contain native executables or DLLs,
installation scripts, symlinks, junctions, reparse points, undeclared permissions, or
content that accesses arbitrary filesystem, registry, process, or native APIs. Renaming
a native binary to an allowed extension does not make it safe.

The tools allow only these extensions:

```text
.json .dseffect
.png .jpg .jpeg .webp .bmp .svg .gif
.mp4 .webm .m4v
.html .htm .css .js .mjs
.woff .woff2 .ttf .otf .txt
.glb .gltf .vrm .bin
```

They reject case-insensitive duplicate paths and native executable signatures, and bound
packages to 5,000 files and 2 GiB of uncompressed content. JSON, GLTF JSON, and effect
metadata files are limited to 2 MiB each, with the stricter effect limit above. These are
validation limits, not suggested package sizes; keep packages small and include only
files the component needs.

DOM widgets run in a sandbox. Known permission names are `audio`, `systemMetrics`,
`input`, `network`, and `storage`. A declaration is a request, not a grant. Host policy
may deny it or offer a narrower capability. Remote resources are blocked by default;
declaring `network` does not enable arbitrary downloads or native access. Start widgets
and companions with `permissions: []` unless the supported host capability is necessary.
When present on any component type, `permissions` must be an array of unique known
strings, with at most 16 entries. Unknown permission names and non-string entries are
rejected even for components that do not use host capabilities.

## Import, projects, and conflicts

Desktop Studio's ZIP import flow opens a guide and package preview for review before
installation. A creator component imports into **Library → Imported**. Add it to a
desktop project after import; the component ZIP itself does not create a project.

A complete theme ZIP is produced by **Export** inside Desktop Studio and contains the
app's desktop project format and its assets. Importing it creates a project in
**Projects** (labeled **Desktops** in the app). Do not invent a `type: "theme"` creator
manifest or package a theme with this CLI; use the app's Export flow.

When an ID conflicts with an installed package, **UseExisting** reuses that package and
**Copy** imports a separate copy. Neither option replaces the existing package. An
increased manifest `version` does not bypass this rule. Existing projects, media,
preferences, and recovery data must remain intact during import and updates.

Cursor packs, sound packs, and Workshop publishing are outside creator ZIP v1. Treat
unknown fields or future schema extensions as metadata, not promises of additional host
capabilities.
