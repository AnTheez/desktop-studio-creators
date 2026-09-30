# Changelog

## 0.2.0 — 2026-09-30

- Publish the creator ZIP v1 guide for widgets, stickers, wallpapers, bounded effects,
  sprite companions, and local 3D models.
- Add shared identity, metadata, path, and permission schemas plus type-specific manifests
  and a bounded effect definition schema.
- Apply known, unique string permission bounds to every component type, including media
  and 3D packages.
- Reject case variants of known manifest fields at the root and nested schema levels,
  preserving unknown extension metadata without allowing validation to be bypassed.
- Validate GLTF buffer and image references relative to their model directory, reject
  network and traversal paths, and allow embedded `data:` resources.
- Add a Node.js 22+ package validator and ZIP packager. Packaging validates source folders,
  writes a root manifest, rejects unsafe content, and preserves existing output files.
- Add an original SVG sticker example and package validation and ZIP round-trip tests.
- Document Library component imports, app-exported theme projects, and conflict choices
  that preserve installed packages and user data.
- Keep the public MIT creator toolkit separate from the paid proprietary Desktop Studio
  application and its runtime, Steam, licensing, signing, and release code.
