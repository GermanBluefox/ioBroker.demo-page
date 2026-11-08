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
    /** How long the first paint waits for the availability check, so that the hero enters only once */
    const PROBE_WAIT_MS = 400;

    const UI = {
        de: {
            live: 'LIVE',
            openLive: 'LIVE-DEMO ÖFFNEN',
            navLive: 'Live-Demo',
            home: 'Startseite',
            skip: 'Zum Inhalt springen',
            mainNav: 'Hauptnavigation',
            viewNav: 'Ansichten der Demo',
            download: 'HERUNTERLADEN',
            soon: 'BALD',
            soonBadge: 'DEMNÄCHST',
            downloadReady: 'DOWNLOAD BEREIT',
            downloadTemplate: 'VORLAGE HERUNTERLADEN',
            downloadSoon: 'VORLAGE DEMNÄCHST',
            fullscreen: 'VOLLBILD',
            openTab: 'IN NEUEM TAB ÖFFNEN',
            thisView: 'DIESE ANSICHT',
            usedAdapters: 'Verwendete Adapter',
            notice: 'HINWEIS',
            unavailable: 'NICHT VERFÜGBAR',
            unavailableTitle: 'Diese Demo ist gerade nicht erreichbar',
            unavailableText: 'Die Visualisierung ist für Gäste nicht freigegeben oder momentan nicht verfügbar. Bitte versuchen Sie es später noch einmal.',
            externalTitle: 'Diese Demo öffnet sich in einem eigenen Tab',
            externalText: 'Diese Visualisierung läuft unter einer eigenen Adresse und kann nicht in diese Seite eingebettet werden.',
            views: count => (count === 1 ? '1 Ansicht' : `${count} Ansichten`),
            ready: count => `${count} davon als Download bereit`,
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
            viewNav: 'Demo views',
            download: 'DOWNLOAD',
            soon: 'SOON',
            soonBadge: 'COMING SOON',
            downloadReady: 'DOWNLOAD READY',
            downloadTemplate: 'DOWNLOAD TEMPLATE',
            downloadSoon: 'TEMPLATE COMING SOON',
            fullscreen: 'FULL SCREEN',
            openTab: 'OPEN IN NEW TAB',
            thisView: 'THIS VIEW',
            usedAdapters: 'Adapters used',
            notice: 'NOTE',
            unavailable: 'NOT AVAILABLE',
            unavailableTitle: 'This demo is currently not available',
            unavailableText: 'This visualization is not released for guests or is not reachable right now. Please try again later.',
            externalTitle: 'This demo opens in its own tab',
            externalText: 'This visualization runs under its own address and cannot be embedded in this page.',
            views: count => (count === 1 ? '1 view' : `${count} views`),
            ready: count => `${count} of them ready to download`,
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

    function allDemos() {
        return config.sections.flatMap(section => section.demos);
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
            allDemos().map(demo =>
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
        return allDemos().find(demo => availability[demo.id] !== false) || allDemos()[0];
    }

    function renderHeader(t) {
        const firstDemo = firstLiveDemo();
        const links = [];
        if (firstDemo) {
            links.push(h('a', { class: 'm-link', href: liveUrl(firstDemo), 'data-route': true }, t.navLive));
        }
        for (const section of config.sections) {
            links.push(h('a', { class: 'm-link', href: `#${section.id}` }, tr(section.nav) || tr(section.title)));
        }
        if (config.howto) {
            links.push(h('a', { class: 'm-link', href: '#howto' }, tr(config.howto.nav)));
        }
        for (const link of config.navLinks) {
            links.push(h('a', { class: 'm-link', href: link.url }, tr(link.label)));
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
                            config.sections[0] &&
                                h('a', { class: 'btn btn--secondary', href: `#${config.sections[0].id}` }, tr(config.sections[0].title)),
                        ),
                    ),
                    hero.image &&
                        h(
                            'div',
                            { class: 'hero-media', 'data-enter-media': true },
                            h('img', { src: hero.image, alt: tr(hero.title) }),
                            firstDemo && h('span', { class: 'live-pill' }, h('span', { class: 'dot' }), t.live),
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
        const available = availability[demo.id] !== false;
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
                !available
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
                h('h3', null, tr(demo.title)),
                tr(demo.desc) && h('p', null, tr(demo.desc)),
                demo.tags.length ? h('div', { class: 'tags' }, demo.tags.map(tag => h('span', { class: 'tag' }, tag))) : null,
            ),
            h(
                'div',
                { class: 'demo-actions' },
                available
                    ? h(
                          'a',
                          { class: 'btn btn-quiet', href: liveUrl(demo), 'data-route': true },
                          h('span', { class: 'dot' }),
                          t.live,
                      )
                    : h('span', { class: 'btn btn-muted' }, t.unavailable),
                download?.url &&
                    h('a', { class: 'btn btn--primary', href: download.url, download: '' }, icon('download'), t.download),
                !download?.url && download?.soon && h('span', { class: 'btn btn-muted' }, icon('download'), t.soon),
            ),
        );
    }

    function renderSection(section, t) {
        const ready = section.demos.filter(demo => demo.download?.url).length;
        const summary = t.views(section.demos.length) + (ready ? `, ${t.ready(ready)}` : '');
        return h(
            'section',
            { id: section.id, class: 'section' },
            h(
                'div',
                { class: 'wrap' },
                h(
                    'div',
                    { class: 'section-head' },
                    h('h2', null, `// ${tr(section.title)}`),
                    h('p', null, summary),
                ),
                h('div', { class: 'grid-demos' }, section.demos.map(demo => renderDemoCard(demo, t))),
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
                    ? config.sections.map(section => renderSection(section, t))
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
        return h('iframe', { id: 'stage', src: url, title: tr(demo.title), allow: 'fullscreen' });
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
                    allDemos().map(item =>
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
                        tr(demo.desc) && h('p', null, tr(demo.desc)),
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
                    config.guide?.url &&
                        h('a', { class: 'btn btn--secondary btn-row', href: config.guide.url }, tr(config.guide.label), icon('arrow')),
                ),
            ),
        );
    }

    /** The demo of a `?live=<id>` address, or null for the overview */
    function currentDemo() {
        const id = new URLSearchParams(window.location.search).get('live');
        return (id && allDemos().find(demo => demo.id === id)) || null;
    }

    let renderedDemoId = null;
    let rendered = false;
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
                if (shown && allDemos().some(demo => availability[demo.id] === false)) {
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
