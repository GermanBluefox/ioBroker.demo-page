'use strict';
/*
 * Public start page. Reads the page description, which the adapter generated from its configuration,
 * and renders the overview and the live view. No framework and no build step on purpose: the page must
 * stay small and work for anonymous visitors.
 */
(function () {
    const CONFIG_URL = '../demo-page.0/config.json';
    const LANG_KEY = 'demo-page.lang';
    const LANGUAGES = ['de', 'en'];
    /** The anchor of the section with all demos */
    const DEMOS_ID = 'vorlagen';
    /** How long the first paint waits for the availability check, so that the hero enters only once */
    const PROBE_WAIT_MS = 400;
    /** How often the preview over a live view asks whether the view shows something, and how long at most */
    const STAGE_POLL_MS = 250;
    const STAGE_WAIT_MS = 30000;
    /** The duration of the preview's fade in style.css */
    const STAGE_FADE_MS = 200;

    const UI = {
        de: {
            live: 'LIVE',
            openLive: 'LIVE-DEMO ÖFFNEN',
            navLive: 'Live-Demo',
            home: 'Startseite',
            skip: 'Zum Inhalt springen',
            mainNav: 'Hauptnavigation',
            viewNav: 'Visualisierungen',
            download: 'HERUNTERLADEN',
            soon: 'BALD',
            soonBadge: 'DEMNÄCHST',
            downloadReady: 'DOWNLOAD BEREIT',
            downloadTemplate: 'VORLAGE HERUNTERLADEN',
            downloadSoon: 'VORLAGE DEMNÄCHST',
            fullscreen: 'VOLLBILD',
            openTab: 'IN NEUEM TAB ÖFFNEN',
            thisView: 'DIESE VISUALISIERUNG',
            usedAdapters: 'Verwendete Adapter',
            notice: 'HINWEIS',
            unavailable: 'NICHT VERFÜGBAR',
            unavailableTitle: 'Diese Demo ist gerade nicht erreichbar',
            unavailableText: 'Die Visualisierung ist für Gäste nicht freigegeben oder momentan nicht verfügbar. Bitte versuchen Sie es später noch einmal.',
            externalTitle: 'Diese Demo öffnet sich in einem eigenen Tab',
            externalText: 'Diese Visualisierung läuft unter einer eigenen Adresse und kann nicht in diese Seite eingebettet werden.',
            views: count => (count === 1 ? '1 Ansicht' : `${count} Ansichten`),
            ready: count => `${count} davon als Download bereit`,
            soonCount: count => `${count} demnächst`,
            noDemos: 'Es sind noch keine Demos eingerichtet.',
            loadError: 'Die Seite konnte nicht geladen werden. Bitte versuchen Sie es später noch einmal.',
            loading: 'Wird geladen …',
        },
        en: {
            live: 'LIVE',
            openLive: 'OPEN LIVE DEMO',
            navLive: 'Live demo',
            home: 'Home',
            skip: 'Skip to content',
            mainNav: 'Main navigation',
            viewNav: 'Visualizations',
            download: 'DOWNLOAD',
            soon: 'SOON',
            soonBadge: 'COMING SOON',
            downloadReady: 'DOWNLOAD READY',
            downloadTemplate: 'DOWNLOAD TEMPLATE',
            downloadSoon: 'TEMPLATE COMING SOON',
            fullscreen: 'FULL SCREEN',
            openTab: 'OPEN IN NEW TAB',
            thisView: 'THIS VISUALIZATION',
            usedAdapters: 'Adapters used',
            notice: 'NOTE',
            unavailable: 'NOT AVAILABLE',
            unavailableTitle: 'This demo is currently not available',
            unavailableText: 'This visualization is not released for guests or is not reachable right now. Please try again later.',
            externalTitle: 'This demo opens in its own tab',
            externalText: 'This visualization runs under its own address and cannot be embedded in this page.',
            views: count => (count === 1 ? '1 view' : `${count} views`),
            ready: count => `${count} of them ready to download`,
            soonCount: count => `${count} coming soon`,
            noDemos: 'No demos have been set up yet.',
            loadError: 'The page could not be loaded. Please try again later.',
            loading: 'Loading …',
        },
    };

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICONS = {
        arrow: { size: [28, 14], box: '0 0 30 16', paths: ['M1 8h27', 'M21 1l7 7-7 7'] },
        download: { size: [16, 16], box: '0 0 24 24', paths: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'] },
        fullscreen: { size: [16, 16], box: '0 0 24 24', paths: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'] },
    };

    const app = document.getElementById('app');
    /** Result of the availability check per demo id: true, false or undefined (not known yet) */
    const availability = {};
    let config = null;
    let lang = 'de';
    let heroEntered = false;

    function pickLanguage(defaultLanguage) {
        let stored = null;
        try {
            stored = window.localStorage.getItem(LANG_KEY);
        } catch {
            // not available in private windows: the language is just not remembered
        }
        if (LANGUAGES.includes(stored)) {
            return stored;
        }
        if (LANGUAGES.includes(defaultLanguage)) {
            return defaultLanguage;
        }
        const browser = (navigator.language || 'en').substring(0, 2).toLowerCase();
        return LANGUAGES.includes(browser) ? browser : 'en';
    }

    /** The text in the current language, with the other language as fallback */
    function tr(text) {
        if (!text) {
            return '';
        }
        return text[lang] || text.de || text.en || '';
    }

    function h(tag, attributes, ...children) {
        const element = document.createElement(tag);
        for (const [name, value] of Object.entries(attributes || {})) {
            if (value === undefined || value === null || value === false) {
                continue;
            }
            if (name.startsWith('on')) {
                element.addEventListener(name.substring(2), value);
            } else if (value === true) {
                element.setAttribute(name, '');
            } else {
                element.setAttribute(name, value);
            }
        }
        for (const child of children.flat()) {
            if (child !== undefined && child !== null && child !== false) {
                element.append(child);
            }
        }
        return element;
    }

    /** Plain text with its web addresses turned into links that open in a new tab */
    function linkify(text) {
        return text
            .split(/(https?:\/\/[^\s]+)/g)
            .map((part, i) =>
                i % 2 ? h('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part) : part,
            );
    }

    function icon(name) {
        const definition = ICONS[name];
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', definition.size[0]);
        svg.setAttribute('height', definition.size[1]);
        svg.setAttribute('viewBox', definition.box);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('class', `icon-${name}`);
        for (const d of definition.paths) {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            svg.append(path);
        }
        return svg;
    }

    /** The demos that can be opened: a card marked as coming soon has no live view yet */
    function liveDemos() {
        return config.sections.flatMap(section => section.demos).filter(demo => !demo.soon);
    }

    function isSameOrigin(url) {
        try {
            return new URL(url, window.location.href).origin === window.location.origin;
        } catch {
            return false;
        }
    }

    /** The address of a demo. A demo on its own port of this host gets the address the visitor uses. */
    function demoUrl(demo) {
        const live = demo.live;
        if (live.port) {
            return `${live.secure ? 'https:' : 'http:'}//${window.location.hostname}:${live.port}${live.path || '/'}`;
        }
        return live.url;
    }

    function canEmbed(demo) {
        return !demo.live.newTab && isSameOrigin(demoUrl(demo));
    }

    /**
     * Ask whether a guest can open the demos. web answers 404 if a file does not exist and also if the
     * guest may not read it. Other origins cannot be asked and count as available.
     */
    function checkAvailability() {
        return Promise.all(
            liveDemos().map(demo =>
                Promise.all(
                    (demo.live.probes || []).filter(isSameOrigin).map(target =>
                        fetch(target, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
                            .then(response => response.ok)
                            .catch(() => false),
                    ),
                ).then(results => {
                    availability[demo.id] = results.every(Boolean);
                }),
            ),
        );
    }

    /** A real address, so that a live view can be shared and opened in a new tab */
    function liveUrl(demo) {
        return `?live=${encodeURIComponent(demo.id)}`;
    }

    /** Changes the view without loading the page again */
    function navigate(url) {
        window.history.pushState(null, '', url);
        onRouteChange();
    }

    function brand() {
        return h(
            'a',
            { class: 'brand', href: './', 'data-route': true },
            h('img', { src: 'logo.svg', alt: '' }),
            h('span', null, config.brand.name, h('span', null, config.brand.suffix)),
        );
    }

    function languageSwitch() {
        if (!config.languageSwitch) {
            return null;
        }
        return h(
            'span',
            { class: 'lang-switch' },
            LANGUAGES.map(code =>
                h(
                    'button',
                    {
                        type: 'button',
                        'aria-pressed': code === lang ? 'true' : 'false',
                        onclick: () => {
                            lang = code;
                            try {
                                window.localStorage.setItem(LANG_KEY, code);
                            } catch {
                                // not remembered in private windows
                            }
                            render();
                        },
                    },
                    code.toUpperCase(),
                ),
            ),
        );
    }

    function firstLiveDemo() {
        return liveDemos().find(demo => availability[demo.id] !== false) || liveDemos()[0];
    }

    function renderHeader(t) {
        const firstDemo = firstLiveDemo();
        const links = [];
        if (firstDemo) {
            links.push(h('a', { class: 'm-link m-link--bare', href: liveUrl(firstDemo), 'data-route': true }, t.navLive));
        }
        if (config.sections.length) {
            links.push(h('a', { class: 'm-link m-link--bare', href: `#${DEMOS_ID}` }, tr(config.demosTitle)));
        }
        if (config.howto) {
            links.push(h('a', { class: 'm-link m-link--bare', href: '#howto' }, tr(config.howto.nav)));
        }
        for (const link of config.navLinks) {
            links.push(h('a', { class: 'm-link m-link--bare', href: link.url }, tr(link.label)));
        }
        return h(
            'header',
            { class: 'site-header nav' },
            h(
                'div',
                { class: 'wrap' },
                h('a', { class: 'skip-link', href: '#main' }, t.skip),
                brand(),
                h('nav', { 'aria-label': t.mainNav, class: 'site-nav' }, links, languageSwitch()),
            ),
        );
    }

    function renderHero(t) {
        const hero = config.hero;
        if (!hero) {
            return null;
        }
        const firstDemo = firstLiveDemo();
        return h(
            'section',
            // Only the first paint enters: a later rerender (language, availability) just stands
            { class: 'hero', 'data-enter': !heroEntered, 'aria-labelledby': 'hero-title' },
            h(
                'div',
                { class: 'wrap hero-wrap' },
                h(
                    'div',
                    { class: 'hero-text hero-grid' },
                    h(
                        'div',
                        { class: 'hero-copy' },
                        tr(hero.kicker) && h('p', { class: 'kicker' }, tr(hero.kicker)),
                        h('h1', { id: 'hero-title' }, tr(hero.title)),
                        tr(hero.text) && h('p', { class: 'hero-lead' }, tr(hero.text)),
                        h(
                            'div',
                            { class: 'hero-actions' },
                            firstDemo && h('a', { class: 'btn btn--primary', href: liveUrl(firstDemo), 'data-route': true }, t.openLive, icon('arrow')),
                            config.sections.length > 0 &&
                                h('a', { class: 'btn btn--secondary', href: `#${DEMOS_ID}` }, tr(config.demosTitle).toLocaleUpperCase(lang)),
                        ),
                    ),
                    hero.image &&
                        h(
                            'div',
                            { class: 'hero-media' },
                            firstDemo && h('span', { class: 'live-pill' }, h('span', { class: 'dot' }), t.live),
                            h('div', { class: 'hero-shot', 'data-enter-media': true }, h('img', { src: hero.image, alt: tr(hero.title) })),
                        ),
                ),
                renderHighlights(),
            ),
        );
    }

    function renderHighlights() {
        if (!config.highlights.length) {
            return null;
        }
        return h(
            'div',
            { class: 'grid-highlights' },
            config.highlights.map(item =>
                h(
                    'div',
                    { class: 'highlight' },
                    h('p', { class: 'highlight-title' }, tr(item.title)),
                    h('p', null, tr(item.text)),
                ),
            ),
        );
    }

    function renderDemoCard(demo, t) {
        const available = !demo.soon && availability[demo.id] !== false;
        const download = demo.download;
        return h(
            'article',
            { class: `panel card demo-card${available ? '' : ' m-nolift'}` },
            h(
                available ? 'a' : 'div',
                {
                    class: 'demo-media m-zoom',
                    href: available ? liveUrl(demo) : null,
                    'data-route': available,
                    'aria-label': available ? `${t.navLive}: ${tr(demo.title)}` : null,
                },
                demo.image
                    ? h('img', { class: 'shot', src: demo.image, alt: tr(demo.title), loading: 'lazy' })
                    : h(
                          'div',
                          { class: 'demo-placeholder' },
                          h('img', { src: 'logo.svg', alt: '' }),
                          demo.typeLabel,
                      ),
                demo.soon
                    ? h('span', { class: 'badge' }, t.soonBadge)
                    : !available
                      ? h('span', { class: 'badge' }, h('span', { class: 'dot off' }), t.unavailable)
                      : download?.url
                        ? h('span', { class: 'badge' }, t.downloadReady)
                        : download?.soon
                          ? h('span', { class: 'badge' }, t.soonBadge)
                          : null,
            ),
            h(
                'div',
                { class: 'demo-body' },
                h('h4', null, tr(demo.title)),
                tr(demo.desc) && h('p', null, tr(demo.desc)),
                demo.tags.length ? h('div', { class: 'tags' }, demo.tags.map(tag => h('span', { class: 'tag' }, tag))) : null,
            ),
            h(
                'div',
                { class: 'demo-actions' },
                demo.soon
                    ? h('span', { class: 'btn btn-muted' }, t.soon)
                    : available
                      ? h(
                            'a',
                            { class: 'btn btn-quiet', href: liveUrl(demo), 'data-route': true },
                            h('span', { class: 'dot' }),
                            t.live,
                        )
                      : h('span', { class: 'btn btn-muted' }, t.unavailable),
                download?.url &&
                    h('a', { class: 'btn btn--primary', href: download.url, download: '' }, icon('download'), t.download),
                !demo.soon && !download?.url && download?.soon && h('span', { class: 'btn btn-muted' }, icon('download'), t.soon),
            ),
        );
    }

    /** One block per visualization. Its size says how many columns of the page it takes. */
    function renderBlock(section, t) {
        return h(
            'section',
            { id: section.id, class: `demo-block demo-block--${Math.min(section.demos.length, 3)}` },
            h('h3', { class: 'block-title' }, tr(section.title)),
            h('div', { class: 'grid-demos' }, section.demos.map(demo => renderDemoCard(demo, t))),
        );
    }

    function renderDemos(t) {
        const demos = config.sections.flatMap(section => section.demos);
        const soon = demos.filter(demo => demo.soon).length;
        const ready = demos.filter(demo => demo.download?.url).length;
        const live = demos.length - soon;
        const summary = [live && t.views(live), ready && t.ready(ready), soon && t.soonCount(soon)].filter(Boolean).join(', ');
        return h(
            'section',
            { id: DEMOS_ID, class: 'section' },
            h(
                'div',
                { class: 'wrap' },
                h(
                    'div',
                    { class: 'section-head' },
                    h('h2', null, `// ${tr(config.demosTitle).toLocaleUpperCase(lang)}`),
                    h('p', null, summary),
                ),
                h('div', { class: 'demo-blocks' }, config.sections.map(section => renderBlock(section, t))),
            ),
        );
    }

    function renderHowto(t) {
        const howto = config.howto;
        if (!howto) {
            return null;
        }
        const firstDemo = firstLiveDemo();
        const action =
            firstDemo &&
            h(
                'div',
                { class: 'howto-action' },
                h('a', { class: 'btn btn--primary', href: liveUrl(firstDemo), 'data-route': true }, t.openLive, icon('arrow')),
            );
        const stepNumber = index => String(index + 1).padStart(2, '0');
        // With a picture for every step, the section walks through them while it holds on screen
        if (howto.steps.length >= 2 && howto.steps.length <= 4 && howto.steps.every(step => step.image)) {
            return h(
                'section',
                { id: 'howto', class: 'section howto-chapters', 'data-moment': 'pinned-chapters', 'aria-labelledby': 'howto-title' },
                h(
                    'div',
                    { class: 'wrap mo-pc__grid' },
                    h(
                        'div',
                        { class: 'mo-pc__text' },
                        h('h2', { id: 'howto-title', class: 'section-title' }, `// ${tr(howto.title)}`),
                        h(
                            'ol',
                            { class: 'mo-pc__steps' },
                            howto.steps.map((step, index) =>
                                h(
                                    'li',
                                    { class: 'mo-pc__step' },
                                    h('h3', null, h('span', { class: 'step-no-inline' }, stepNumber(index)), tr(step.title)),
                                    h('p', null, tr(step.text)),
                                    h('figure', { class: 'mo-pc__visual' }, h('img', { src: step.image, alt: tr(step.title), loading: 'lazy' })),
                                ),
                            ),
                        ),
                        action,
                    ),
                    h('div', { class: 'mo-pc__visuals frame' }),
                ),
            );
        }
        return h(
            'section',
            { id: 'howto', class: 'section' },
            h(
                'div',
                { class: 'wrap' },
                h('div', { class: 'section-head' }, h('h2', null, `// ${tr(howto.title)}`)),
                h(
                    'div',
                    { class: 'grid-steps' },
                    howto.steps.map((step, index) =>
                        h(
                            'div',
                            { class: 'panel step' },
                            h('p', { class: 'step-no' }, stepNumber(index)),
                            h('h3', null, tr(step.title)),
                            h('p', null, tr(step.text)),
                        ),
                    ),
                ),
                action,
            ),
        );
    }

    function renderCta() {
        const cta = config.install;
        if (!cta) {
            return null;
        }
        return h(
            'div',
            { class: 'panel cta' },
            h(
                'div',
                { class: 'cta-copy' },
                h('h2', null, tr(cta.title)),
                tr(cta.text) && h('p', null, tr(cta.text)),
            ),
            cta.url && h('a', { class: 'btn btn-quiet', href: cta.url }, tr(cta.button), icon('arrow')),
        );
    }

    function renderFooter() {
        const footer = config.footer;
        return h(
            'footer',
            { class: 'site-footer closing' },
            h(
                'div',
                { class: 'wrap' },
                renderCta(),
                h(
                    'div',
                    { class: 'footer-bar' },
                    h('span', null, tr(footer.text)),
                    h(
                        'span',
                        { class: 'footer-links' },
                        footer.links.map(link => h('a', { class: 'm-link', href: link.url }, tr(link.label))),
                    ),
                ),
            ),
        );
    }

    function renderOverview(t) {
        return [
            renderHeader(t),
            h(
                'main',
                { id: 'main', tabindex: '-1' },
                renderHero(t) || (config.highlights.length ? h('section', { class: 'section' }, h('div', { class: 'wrap' }, renderHighlights())) : null),
                config.sections.length
                    ? renderDemos(t)
                    : h('section', { class: 'section' }, h('div', { class: 'wrap' }, h('div', { class: 'panel empty' }, t.noDemos))),
                renderHowto(t),
            ),
            renderFooter(),
        ];
    }

    function renderStage(demo, t) {
        const url = demoUrl(demo);
        if (availability[demo.id] === false) {
            return h(
                'div',
                { class: 'live-message' },
                demo.image && h('img', { src: demo.image, alt: tr(demo.title) }),
                h('h2', null, t.unavailableTitle),
                h('p', null, t.unavailableText),
            );
        }
        if (!canEmbed(demo)) {
            return h(
                'div',
                { class: 'live-message' },
                demo.image && h('img', { src: demo.image, alt: tr(demo.title) }),
                h('h2', null, t.externalTitle),
                h('p', null, t.externalText),
                h('a', { class: 'btn btn--primary', href: url, target: '_blank', rel: 'noopener' }, t.openTab, icon('arrow')),
            );
        }
        return [
            h('iframe', { id: 'stage', src: url, title: tr(demo.title), allow: 'fullscreen' }),
            !stageShowing &&
                h(
                    'div',
                    { class: 'live-loading', role: 'status' },
                    demo.image && h('img', { src: demo.image, alt: '' }),
                    h('span', { class: 'live-loading-note' }, h('span', { class: 'spinner' }), t.loading),
                ),
        ];
    }

    /**
     * Takes the preview away as soon as the live view shows something. The load event of the frame is no
     * help: a visualization only starts to build its view then, behind its own loading animation. Its
     * first text is the sign that the view stands. A frame on another origin cannot be asked, there the
     * load event has to do.
     */
    function watchStage() {
        const frame = document.getElementById('stage');
        if (!frame || frame === watchedFrame || stageShowing) {
            return;
        }
        watchedFrame = frame;
        const started = Date.now();
        let loaded = false;
        frame.addEventListener('load', () => (loaded = true), { once: true });
        const timer = setInterval(() => {
            if (frame !== document.getElementById('stage')) {
                clearInterval(timer);
                return;
            }
            const view = frame.contentDocument;
            const showing = loaded && (!view || view.body?.innerText?.trim());
            if (showing || Date.now() - started > STAGE_WAIT_MS) {
                clearInterval(timer);
                stageShowing = true;
                const preview = app.querySelector('.live-loading');
                preview?.classList.add('is-done');
                setTimeout(() => preview?.remove(), STAGE_FADE_MS);
            }
        }, STAGE_POLL_MS);
    }

    function renderLive(demo, t) {
        const available = availability[demo.id] !== false;
        const download = demo.download;
        const embedded = available && canEmbed(demo);
        return h(
            'div',
            { class: 'live' },
            h(
                'header',
                { class: 'live-header' },
                brand(),
                h('span', { class: 'live-pill' }, h('span', { class: `dot${available ? '' : ' off'}` }), available ? t.live : t.unavailable),
                h(
                    'nav',
                    { class: 'live-tabs', 'aria-label': t.viewNav },
                    liveDemos().map(item =>
                        h(
                            'button',
                            {
                                type: 'button',
                                'aria-pressed': item.id === demo.id ? 'true' : 'false',
                                onclick: () => navigate(liveUrl(item)),
                            },
                            tr(item.tab) || tr(item.title),
                        ),
                    ),
                ),
                h(
                    'div',
                    { class: 'live-actions' },
                    embedded &&
                        h(
                            'button',
                            {
                                type: 'button',
                                class: 'btn btn--secondary',
                                onclick: () => document.getElementById('stage')?.requestFullscreen?.(),
                            },
                            icon('fullscreen'),
                            t.fullscreen,
                        ),
                    download?.url &&
                        h('a', { class: 'btn btn--primary', href: download.url, download: '' }, icon('download'), t.downloadTemplate),
                    !download?.url && download?.soon && h('span', { class: 'btn btn-muted' }, icon('download'), t.downloadSoon),
                    languageSwitch(),
                ),
            ),
            h(
                'main',
                { class: 'live-main' },
                h('div', { class: 'live-stage' }, renderStage(demo, t)),
                h(
                    'aside',
                    { class: 'live-side' },
                    h(
                        'section',
                        { class: 'panel' },
                        h('p', { class: 'side-label' }, t.thisView),
                        h('h1', null, tr(demo.title)),
                        tr(demo.desc) && h('p', null, linkify(tr(demo.desc))),
                        demo.tags.length
                            ? [
                                  h('p', { class: 'side-note' }, t.usedAdapters),
                                  h('div', { class: 'tags' }, demo.tags.map(tag => h('span', { class: 'tag' }, tag))),
                              ]
                            : null,
                    ),
                    tr(config.notice) &&
                        h(
                            'section',
                            { class: 'panel' },
                            h('p', { class: 'side-label' }, t.notice),
                            h('p', null, tr(config.notice)),
                        ),
                    setupProject(demo)
                        ? h(
                              'button',
                              { type: 'button', class: 'btn btn--secondary btn-row', onclick: () => openSetup(demo) },
                              SETUP[lang === 'en' ? 'en' : 'de'].button,
                              icon('download'),
                          )
                        : config.guide?.url &&
                          h('a', { class: 'btn btn--secondary btn-row', href: config.guide.url }, tr(config.guide.label), icon('arrow')),
                ),
            ),
        );
    }

    /*
     * "Projekt herunterladen": a dialog with the files of a vis-2 project and the steps to set it up at home.
     * The files lie in demo-page.0/downloads/<project>.zip (vis-2 import format) and
     * demo-page.0/downloads/<project>-datenpunkte.json (objects for the Admin import).
     */
    const DOWNLOADS = '../demo-page.0/downloads/';
    const ADAPTER_NOTES = {
        de: {
            'vis-2-widgets-jaeger-design': 'Widgets im Jäger Design, brauchen eine eigene Lizenz',
            'vis-2-widgets-glashaus': 'Widgets im Glashaus-Stil',
            'mihome-vacuum': 'nur für die Karte des Saugroboters',
        },
        en: {
            'vis-2-widgets-jaeger-design': 'widgets in the Jäger design, need a license of their own',
            'vis-2-widgets-glashaus': 'widgets in the Glashaus style',
            'mihome-vacuum': 'only for the map of the robot vacuum',
        },
    };
    const SETUP = {
        de: {
            button: 'PROJEKT HERUNTERLADEN',
            title: 'Projekt herunterladen und einrichten',
            intro: 'So bekommen Sie diese Visualisierung in Ihr eigenes ioBroker. Sie brauchen dafür zwei Dateien:',
            fileProject: 'Projekt für vis-2 (.zip)',
            fileStates: 'Datenpunkte (.json)',
            steps: [
                ['Adapter installieren', 'In ioBroker Admin unter „Adapter“ installieren: web und vis-2'],
                [
                    'Datenpunkte anlegen',
                    'In Admin „Objekte“ öffnen, den Expertenmodus einschalten und über das Symbol zum Hochladen die Datei mit den Datenpunkten importieren. Es entsteht der Ordner 0_userdata.0.Demo mit allen Datenpunkten, die das Projekt benutzt.',
                ],
                [
                    'Projekt importieren',
                    'Den vis-2 Editor öffnen, oben auf „Projekte“ gehen und „Projekt importieren“ wählen. Die .zip-Datei auswählen und den Namen „%s“ unverändert lassen, denn Bilder und Dateien werden unter diesem Namen gesucht.',
                ],
                [
                    'Eigene Geräte verbinden',
                    'Im Editor ein Widget anklicken und bei der Objekt-ID den Demo-Datenpunkt durch den eigenen ersetzen. Alternativ schreibt ein Skript die Werte Ihrer Geräte in die Demo-Datenpunkte.',
                ],
            ],
            alsoAdapters: 'Dazu für dieses Projekt:',
            hint: 'Solange keine Geräte verbunden sind, bleiben die Werte leer. Zum Ausprobieren lassen sich Werte in Admin unter „Objekte“ von Hand setzen.',
            more: 'Mehr Anleitungen auf iobroker.com',
            close: 'Schließen',
        },
        en: {
            button: 'DOWNLOAD PROJECT',
            title: 'Download and set up the project',
            intro: 'This is how you get this visualization into your own ioBroker. You need two files:',
            fileProject: 'Project for vis-2 (.zip)',
            fileStates: 'States (.json)',
            steps: [
                ['Install adapters', 'In ioBroker Admin under "Adapters" install: web and vis-2'],
                [
                    'Create the states',
                    'Open "Objects" in Admin, switch on the expert mode and import the file with the states with the upload icon. This creates the folder 0_userdata.0.Demo with all states the project uses.',
                ],
                [
                    'Import the project',
                    'Open the vis-2 editor, go to "Projects" and choose "Import project". Select the .zip file and keep the name "%s", because pictures and files are looked up under this name.',
                ],
                [
                    'Connect your own devices',
                    'Click a widget in the editor and replace the demo state in its object ID with your own. Or let a script write the values of your devices into the demo states.',
                ],
            ],
            alsoAdapters: 'Plus for this project:',
            hint: 'As long as no devices are connected, the values stay empty. To try it out, set values by hand in Admin under "Objects".',
            more: 'More guides on iobroker.com',
            close: 'Close',
        },
    };

    /** The vis-2 project of a demo, or '' if it has nothing to download */
    function setupProject(demo) {
        if (demo.type !== 'vis-2' || !demo.live?.url) {
            return '';
        }
        const match = /\?([^#&]+)/.exec(demo.live.url);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function openSetup(demo) {
        const s = SETUP[lang === 'en' ? 'en' : 'de'];
        const notes = ADAPTER_NOTES[lang === 'en' ? 'en' : 'de'];
        const project = setupProject(demo);
        const extra = demo.tags.filter(tag => tag !== 'vis-2');
        const dialog = h(
            'dialog',
            { class: 'setup-dialog', 'aria-labelledby': 'setup-title' },
            h(
                'div',
                { class: 'setup-head' },
                h('div', null, h('p', { class: 'side-label' }, tr(demo.title)), h('h2', { id: 'setup-title' }, s.title)),
                h('button', { type: 'button', class: 'setup-close', 'aria-label': s.close, onclick: () => dialog.close() }, '×'),
            ),
            h('p', { class: 'setup-intro' }, s.intro),
            h(
                'div',
                { class: 'setup-files' },
                h('a', { class: 'btn btn--primary', href: `${DOWNLOADS}${project}.zip`, download: '' }, icon('download'), s.fileProject),
                h(
                    'a',
                    { class: 'btn btn--secondary', href: `${DOWNLOADS}${project}-datenpunkte.json`, download: '' },
                    icon('download'),
                    s.fileStates,
                ),
            ),
            h(
                'ol',
                { class: 'setup-steps' },
                s.steps.map(([title, text], i) =>
                    h(
                        'li',
                        null,
                        h('h3', null, title),
                        h('p', null, text.replace('%s', project)),
                        i === 0 && extra.length
                            ? h(
                                  'p',
                                  null,
                                  s.alsoAdapters,
                                  h('ul', null, extra.map(tag => h('li', null, h('b', null, tag), notes[tag] ? `: ${notes[tag]}` : ''))),
                              )
                            : null,
                    ),
                ),
            ),
            h('p', { class: 'setup-hint' }, s.hint),
            config.guide?.url && h('a', { class: 'setup-more', href: config.guide.url }, s.more, icon('arrow')),
        );
        dialog.addEventListener('close', () => dialog.remove());
        dialog.addEventListener('click', event => event.target === dialog && dialog.close());
        document.body.append(dialog);
        dialog.showModal();
    }

    /** The demo of a `?live=<id>` address, or null for the overview */
    function currentDemo() {
        const id = new URLSearchParams(window.location.search).get('live');
        return (id && liveDemos().find(demo => demo.id === id)) || null;
    }

    let renderedDemoId = null;
    let rendered = false;
    /** Whether the current live frame shows its view, and the frame that is being watched for it */
    let stageShowing = false;
    let watchedFrame = null;
    /** The motion layer and the moment load after the first paint, because they work on the rendered page */
    let motionLoader = null;
    let momentsLoader = null;

    function startMotion() {
        motionLoader = motionLoader || import('./assets/motion/motion.js').catch(error => console.warn(`No motion layer: ${error}`));
        motionLoader.then(motion => motion?.refresh());
        const moments = app.querySelectorAll('[data-moment]');
        if (moments.length) {
            momentsLoader = momentsLoader || import('./assets/moments/moments.js').catch(error => console.warn(`No moment: ${error}`));
            momentsLoader.then(loader => moments.forEach(element => loader?.mount(element)));
        }
    }

    function render() {
        if (!config) {
            return;
        }
        const t = UI[lang];
        document.documentElement.lang = lang;
        const demo = currentDemo();
        const site = `${config.brand.name}${config.brand.suffix}`;
        document.title = demo ? `${tr(demo.title)}: ${site}` : config.hero ? `${site}: ${tr(config.hero.title)}` : site;
        const description = document.querySelector('meta[name="description"]');
        if (description && config.hero && tr(config.hero.text)) {
            description.setAttribute('content', tr(config.hero.text));
        }

        // A rerender must not reload the running visualization, so a live iframe is kept when it still fits
        const frame = document.getElementById('stage');
        const keepFrame = !!(demo && frame && renderedDemoId === demo.id && availability[demo.id] !== false && canEmbed(demo));
        if (keepFrame) {
            frame.remove();
        } else {
            stageShowing = false;
        }
        const scrollY = window.scrollY;
        momentsLoader?.then(loader => loader?.unmountAll(app));
        app.replaceChildren(...[demo ? renderLive(demo, t) : renderOverview(t)].flat(2).filter(Boolean));
        if (keepFrame) {
            document.getElementById('stage')?.replaceWith(frame);
        }
        window.scrollTo(0, scrollY);
        renderedDemoId = demo ? demo.id : null;
        rendered = true;
        heroEntered = heroEntered || !demo;
        watchStage();
        startMotion();
    }

    function onRouteChange() {
        const hash = window.location.hash;
        const demo = currentDemo();
        // A jump inside the overview must not rebuild the page: images and the moment would start again
        if (!rendered || (demo ? demo.id : null) !== renderedDemoId) {
            render();
        }
        const target = !demo && hash.length > 1 ? document.getElementById(hash.substring(1)) : null;
        if (target) {
            target.scrollIntoView();
            if (target.id === 'main') {
                target.focus({ preventScroll: true });
            }
        } else {
            window.scrollTo(0, 0);
        }
    }

    function showStatus(text) {
        app.replaceChildren(h('div', { class: 'status' }, text));
    }

    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[data-route]');
        if (link && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            navigate(link.href);
        }
    });

    lang = pickLanguage();
    showStatus(UI[lang].loading);
    fetch(CONFIG_URL, { cache: 'no-cache', credentials: 'same-origin' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            config = data;
            lang = pickLanguage(config.defaultLanguage);
            let shown = false;
            const checks = checkAvailability().then(() => {
                if (shown && liveDemos().some(demo => availability[demo.id] === false)) {
                    render();
                }
            });
            return Promise.race([checks, new Promise(resolve => setTimeout(resolve, PROBE_WAIT_MS))]).then(() => {
                shown = true;
                onRouteChange();
            });
        })
        .catch(error => {
            console.error(`Cannot load the page description: ${error}`);
            showStatus(UI[lang].loadError);
        });
})();
