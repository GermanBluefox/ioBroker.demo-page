![Logo](admin/demo-page.svg)

# ioBroker.demo-page

A public start page for ioBroker that shows selected visualization projects as cards with a live view, for
example on a demo system.

## How to use it

1. Install the adapter and add an instance. It needs a running `web` instance, which serves the page at
   `/demo-page/index.html`.
2. In the instance configuration, add one entry per demo on the tab **Demos**. Project and view are selected
   from the lists of the existing projects. Save, and the page is published. All demos stand under one heading,
   grouped in one block per visualization. An entry marked as **Not live yet** only shows its card.
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

### 0.1.15 (2026-11-13)

- (bluefox) A dialog "Download project" for vis-2 projects with the files and the steps to set them up. Web addresses in a description become links that open in a new tab. The description always lies below the live view, on every screen width, so a dialog of the visualization always opens in view.

### 0.1.14 (2026-11-10)

- (bluefox) The visualization of the live view takes the full width, and the description lies below it in a row; only on very wide screens (from 1800 px) do both stand side by side. A description keeps its line breaks and flows in columns; a card shows only its first three lines.

### 0.1.13 (2026-11-09)

- (bluefox) The bar of the live view shows only the names of the visualizations, without a label in front.

### 0.1.12 (2026-11-09)

- (bluefox) The bar of the live view says that it chooses between visualizations.

### 0.1.11 (2026-11-09)

- (bluefox) All tiles have the same space inside: 32 px to their edge, 24 px on a phone, and 16 px between title and text.
- (bluefox) 128 px between the sections, running text at 16 px, and filled secondary buttons that stand off the page.
- (bluefox) The install button leads to the installation page of iobroker.com by default.

### 0.1.10 (2026-11-09)

- (bluefox) The highlights have more space inside: 32 px to their edge, 24 px on a phone, and 16 px between title and text.

### 0.1.9 (2026-11-09)

- (bluefox) The highlights stand another 30 px further below the hero, and their title has more distance to their text.

### 0.1.8 (2026-11-09)

- (bluefox) The green LIVE dot fades in and out, unless the visitor asked for reduced motion.
- (bluefox) The highlights stand 40 px further below the hero.

### 0.1.7 (2026-11-09)

- (bluefox) In the hero, the text starts at the upper edge of the picture and the buttons end at its lower edge.

### 0.1.6 (2026-11-09)

- (bluefox) All content, the hero included, stands left-aligned on one edge and is at most 1312 px wide: 64 px from the edge of the display, 32 px below 900 px and 20 px below 600 px. The header keeps 32 px over the whole display, and 20 px below 600 px.

### 0.1.5 (2026-11-09)

- (bluefox) The distances to the edge of the display are those of iobroker.com: the header and the hero run over the whole display, with 32 and 64 px, and the content is at most 1312 px wide with 32 px. Below 900 px the hero also has 32 px, and below 600 px everything has 20 px.

### 0.1.4 (2026-11-09)

- (bluefox) All demos stand under one heading ("Vorlagen" by default), which is also the name in the menu and on the hero button. It replaces the menu name per section of 0.1.3.
- (bluefox) Below the heading, the demos are grouped in one block per visualization.
- (bluefox) A demo can be marked as not live yet: its card is shown as coming soon, without a link and without an address in the page description.

### 0.1.3 (2026-11-09)

- (bluefox) While a live view loads, its screenshot stands over it with a loading note.
- (bluefox) A section can have its own name for the menu and the hero button.
- (bluefox) The LIVE mark stands above the hero picture instead of covering it.
- (bluefox) The default footer links include the privacy policy.

### 0.1.2 (2026-11-09)

- (bluefox) The content area is wider, so the distance to the display edge is smaller, and the header follows the design: it stands above the hero and its links are underlined only on hover. Sections no longer fill a whole screen and a single demo card keeps its normal width.

### 0.1.1 (2026-11-08)

- (bluefox) A chosen view can be removed again: the view list has an entry "(Standard)".

### 0.1.0 (2026-11-08)

- (bluefox) Initial release. Tried on a real system: vis-2 and the page itself. A live view has its own address (`/demo-page/?live=<id>`), and how-to steps can show a picture: with a picture for each of 2 to 4 steps, the section walks through them while scrolling.

## License

MIT License

Copyright (c) 2026 bluefox <dogafox@gmail.com>
