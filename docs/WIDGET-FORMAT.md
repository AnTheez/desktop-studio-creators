# DOM Widget format v1

DOM Widgets are portable local web packages rendered by Desktop Studio. Version 1 is
offline-first and uses a narrow lifecycle message rather than direct access to the host.

## Required files

- `manifest.json` describes identity, version, entry point, default size, permissions, and
  editable properties.
- `index.html` is the local entry point.

Optional local files include styles, scripts, images, fonts, `settings.json`, and a preview.
Every path is relative to the package root.

## Minimal manifest

```json
{
  "formatVersion": 1,
  "id": "your-name.hello-widget",
  "type": "widget",
  "name": "Hello Widget",
  "version": 1,
  "entryPoint": "index.html",
  "defaultSize": {
    "width": 360,
    "height": 180
  },
  "runtime": "dom",
  "permissions": []
}
```

IDs should use a stable reverse-domain-style namespace. Increment `version` when publishing
a compatible update to the same package.

## Editable properties

The optional `properties` object lets Desktop Studio build understandable Inspector controls.
Supported kinds are `slider`, `color`, `boolean`, `number`, `text`, and `select`.

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
    }
  }
}
```

Numerical values may declare `min`, `max`, and a positive `step`. A `select` property must
provide non-empty `options`. Keep property names stable so existing user settings survive an
update.

## Lifecycle

Desktop Studio sends lifecycle messages from the parent frame. A widget must verify the
message source and contract before using the values.

```js
addEventListener("message", (event) => {
  if (event.source !== parent) return;
  if (event.data?.source !== "desktop-studio") return;
  if (event.data?.type !== "lifecycle") return;

  const properties = event.data.properties ?? {};
  // Apply bounded values to the widget UI.
});
```

Lifecycle stages are `mount`, `update`, `pause`, `resume`, `stop`, and `destroy`. Widgets
should stop timers and media while paused and release resources when destroyed.

## Permissions

Known permission names are `audio`, `systemMetrics`, `input`, `network`, and `storage`.
Declaring a permission is only a request. Host policy may deny it or expose a narrower API.
The first public version should normally use no permissions.

## Rejected content

Desktop Studio rejects rooted paths, `..` traversal, reparse points, native binaries, missing
entry points, malformed manifests, excessive metadata, and unsupported runtimes. Network,
arbitrary filesystem, registry, process, and native API access are not part of DOM Widget v1.

