![Logo](admin/demo-page.svg)

# ioBroker.demo-page

A public start page for ioBroker that shows selected visualization projects as cards with a live view, for
example on a demo system.

## How to use it

1. Install the adapter and add an instance. It needs a running `web` instance, which serves the page at
   `/demo-page/index.html`.
2. In the instance configuration, add one entry per demo on the tab **Demos**. Project and view are selected
   from the lists of the existing projects. Save, and the page is published.
3. Choose which parts of the page are shown and what they say on the tabs **Page sections** and
   **Live view and links**.
4. To replace the standard page of `web`, enter `/demo-page/` as **default redirect** in the settings of the
   web instance. web answers with a permanent redirect, which browsers remember: test it before you announce it.

## Supported visualizations

Only installed ones are offered.

| Visualization | Selectable | Address |
|---|---|---|
| vis-2, vis | project, view | `/vis-2/index.html?<project>#<view>` |
| Aura | instance and layout, tab | `/aura/#/view/<layout>/...`, or its own port or `customUrl` |
| Devices, Material, HABPanel | - | `/<adapter>/index.html` |
| iQontrol | instance, view | `/iqontrol/index.html?namespace=<instance>&renderView=...` |
| jarvis | instance, tab | own port |
| Lovelace | instance and dashboard | own port |
| E-Charts, Flot | preset | `/<adapter>/...?preset=...` |
| Free address | - | any address or path |

Project addresses were taken from the sources of these adapters. Those that were tried on a real system so far:
see the changelog.

## Access for guests

The adapter makes **its own** files (`demo-page` and `demo-page.0`) readable for everybody. This also includes
every image or template that you upload for the page.

It does **not** change the rights of other adapters. So a visitor can only open a demo if the user of the web
instance may read the files of that visualization and its objects. The page checks this for demos on the same
web server, and marks those that cannot be opened as not available.

Visualizations on their own port (Aura without `webInstance`, jarvis, Lovelace) are not checked by the page, and
this port must be reachable by visitors. They open in a new tab. For Aura, set `webInstance`: then it is served
by web as `/aura/` and can be embedded.

## Changelog

### 0.1.1 (2026-11-08)

- (bluefox) A chosen view can be removed again: the view list has an entry "(Standard)".

### 0.1.0 (2026-11-08)

- (bluefox) Initial release. Tried on a real system: vis-2 and the page itself. A live view has its own address (`/demo-page/?live=<id>`), and how-to steps can show a picture: with a picture for each of 2 to 4 steps, the section walks through them while scrolling.

## License

MIT License

Copyright (c) 2026 bluefox <dogafox@gmail.com>
