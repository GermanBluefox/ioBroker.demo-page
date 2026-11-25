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
            heroShow: 'Visualisierungen der Demo',
            heroGo: 'Zeigen: %s',
            openLive: 'LIVE-DEMO ÖFFNEN',
            navLive: 'Live-Demo',
            home: 'Startseite',
            skip: 'Zum Inhalt springen',
            mainNav: 'Hauptnavigation',
            viewNav: 'Visualisierungen',
            groupNav: 'Gruppen',
            deviceNav: 'Für welches Gerät?',
            deviceAll: 'Alle',
            devices: { phone: 'Handy', tablet: 'Tablet', screen: 'Bildschirm', any: 'Passt sich jedem Gerät an' },
            pickView: 'Visualisierung wählen',
            prevView: 'Vorherige Visualisierung',
            nextView: 'Nächste Visualisierung',
            close: 'Schließen',
            groups: { standard: 'Standard-Widgets', design: 'Design-Vorlagen', plan: 'Grundriss und 3D', more: 'Weitere Oberflächen' },
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
            heroShow: 'Visualizations of the demo',
            heroGo: 'Show: %s',
            openLive: 'OPEN LIVE DEMO',
            navLive: 'Live demo',
            home: 'Home',
            skip: 'Skip to content',
            mainNav: 'Main navigation',
            viewNav: 'Visualizations',
            groupNav: 'Groups',
            deviceNav: 'For which device?',
            deviceAll: 'All',
            devices: { phone: 'Phone', tablet: 'Tablet', screen: 'Screen', any: 'Fits any device' },
            pickView: 'Choose a visualization',
            prevView: 'Previous visualization',
            nextView: 'Next visualization',
            close: 'Close',
            groups: { standard: 'Standard widgets', design: 'Design templates', plan: 'Floor plan and 3D', more: 'More interfaces' },
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
        phone: { size: [16, 16], box: '0 0 24 24', paths: ['M9 2.5h6a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z', 'M11 18.5h2'] },
        tablet: { size: [16, 16], box: '0 0 24 24', paths: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M18 12h.01'] },
        screen: { size: [16, 16], box: '0 0 24 24', paths: ['M4.5 4h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8 21h8', 'M12 17v4'] },
        any: { size: [16, 16], box: '0 0 24 24', paths: ['M3.5 4h11a1.5 1.5 0 0 1 1.5 1.5V13', 'M2 5.5V12.5A1.5 1.5 0 0 0 3.5 14H12', 'M6 18h6', 'M16.8 9h3.9a1.3 1.3 0 0 1 1.3 1.3v8.4a1.3 1.3 0 0 1-1.3 1.3h-3.9a1.3 1.3 0 0 1-1.3-1.3v-8.4A1.3 1.3 0 0 1 16.8 9z'] },
        chevron: { size: [14, 14], box: '0 0 24 24', paths: ['M6 9l6 6 6-6'] },
        prev: { size: [20, 20], box: '0 0 24 24', paths: ['M15 6l-6 6 6 6'] },
        next: { size: [20, 20], box: '0 0 24 24', paths: ['M9 6l6 6-6 6'] },
    };

    const app = document.getElementById('app');
    /** Result of the availability check per demo id: true, false or undefined (not known yet) */
    const availability = {};
    let config = null;
    let lang = 'de';
    let heroEntered = false;
    /** The slide the hero shows; it outlives a rerender, so a language switch does not start over */
    let heroSlide = 0;
    let heroTimer = null;

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
        for (const child of children.flat(Infinity)) {
            if (child !== undefined && child !== null && child !== false) {
                element.append(child);
            }
        }
        return element;
    }

    /**
     * Plain text with its links turned into links that open in a new tab: a web address stands for itself,
     * [label](https://…) shows the label instead of the address
     */
    function linkify(text) {
        const parts = [];
        const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;
        let last = 0;
        let match;
        while ((match = pattern.exec(text))) {
            parts.push(text.slice(last, match.index));
            const url = match[2] || match[3];
            parts.push(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, match[1] || url));
            last = pattern.lastIndex;
        }
        parts.push(text.slice(last));
        return parts;
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
                    (hero.image || heroSlides().length > 1) &&
                        h(
                            'div',
                            { class: 'hero-media' },
                            firstDemo && h('span', { class: 'live-pill' }, h('span', { class: 'dot' }), t.live),
                            heroSlides().length > 1
                                ? renderHeroCarousel(t)
                                : h('div', { class: 'hero-shot', 'data-enter-media': true }, h('img', { src: hero.image, alt: tr(hero.title) })),
                        ),
                ),
                renderHighlights(),
            ),
        );
    }

    /** Every demo that can be opened and has a picture: the hero shows them one after the other */
    function heroSlides() {
        return liveDemos().filter(demo => demo.image && availability[demo.id] !== false);
    }

    const HERO_SLIDE_MS = 2800;

    function renderHeroCarousel(t) {
        const slides = heroSlides();
        heroSlide = heroSlide % slides.length;
        const caption = h('a', { class: 'hero-caption-title', href: liveUrl(slides[heroSlide]), 'data-route': true }, tr(slides[heroSlide].title));
        const dots = slides.map((demo, index) =>
            h('button', {
                type: 'button',
                class: 'hero-dot',
                'aria-label': t.heroGo.replace('%s', tr(demo.title)),
                'aria-current': index === heroSlide ? 'true' : false,
                onclick: () => {
                    showHeroSlide(index);
                    restartHeroTimer();
                },
            }),
        );
        const carousel = h(
            'div',
            {
                class: 'hero-shot hero-carousel',
                'data-enter-media': true,
                role: 'group',
                'aria-roledescription': 'carousel',
                'aria-label': t.heroShow,
                // Pointer or keyboard on the pictures holds them still
                onmouseenter: () => stopHeroTimer(),
                onmouseleave: () => restartHeroTimer(),
                onfocusin: () => stopHeroTimer(),
                onfocusout: () => restartHeroTimer(),
            },
            h(
                'div',
                { class: 'hero-slides' },
                slides.map((demo, index) =>
                    h(
                        'a',
                        {
                            class: `hero-slide${index === heroSlide ? ' is-active' : ''}`,
                            href: liveUrl(demo),
                            'data-route': true,
                            'aria-hidden': index === heroSlide ? false : 'true',
                            tabindex: index === heroSlide ? false : '-1',
                        },
                        h('img', { src: demo.image, alt: tr(demo.title), loading: index ? 'lazy' : false, decoding: 'async' }),
                    ),
                ),
            ),
            h('div', { class: 'hero-caption' }, caption, h('div', { class: 'hero-dots' }, dots)),
        );
        restartHeroTimer();
        return carousel;
    }

    function showHeroSlide(index) {
        const slides = heroSlides();
        const carousel = app.querySelector('.hero-carousel');
        if (!carousel || !slides.length) {
            return;
        }
        heroSlide = (index + slides.length) % slides.length;
        carousel.querySelectorAll('.hero-slide').forEach((slide, i) => {
            const active = i === heroSlide;
            slide.classList.toggle('is-active', active);
            if (active) {
                slide.removeAttribute('aria-hidden');
                slide.removeAttribute('tabindex');
            } else {
                slide.setAttribute('aria-hidden', 'true');
                slide.setAttribute('tabindex', '-1');
            }
        });
        carousel.querySelectorAll('.hero-dot').forEach((dot, i) => {
            if (i === heroSlide) {
                dot.setAttribute('aria-current', 'true');
            } else {
                dot.removeAttribute('aria-current');
            }
        });
        const caption = carousel.querySelector('.hero-caption-title');
        caption.textContent = tr(slides[heroSlide].title);
        caption.setAttribute('href', liveUrl(slides[heroSlide]));
    }

    function stopHeroTimer() {
        clearInterval(heroTimer);
        heroTimer = null;
    }

    function restartHeroTimer() {
        stopHeroTimer();
        // Whoever has asked the system for less motion picks the pictures with the dots
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        heroTimer = setInterval(() => {
            if (!app.querySelector('.hero-carousel')) {
                stopHeroTimer();
            } else if (!document.hidden) {
                showHeroSlide(heroSlide + 1);
            }
        }, HERO_SLIDE_MS);
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
                    h('p', null, linkify(tr(item.text))),
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
        if (setupProject(demo)?.kind === 'home3d') {
            presetHome3dStyle();
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
    /**
     * Whether a page in the frame shows something: text in the page itself, or text inside a web component.
     * 3D Home draws all its text in the shadow root of <home3d-panel>, there the page itself has no text.
     */
    function hasContent(doc) {
        if (doc.body?.innerText?.trim()) {
            return true;
        }
        for (const el of doc.querySelectorAll('*')) {
            if (el.shadowRoot?.textContent?.trim()) {
                return true;
            }
        }
        return false;
    }

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
            // the load event may come before this watcher is attached: a finished document counts as loaded
            if (!loaded && view?.readyState === 'complete' && view.URL !== 'about:blank') {
                loaded = true;
            }
            const showing = loaded && (!view || hasContent(view));
            if (showing || Date.now() - started > STAGE_WAIT_MS) {
                clearInterval(timer);
                stageShowing = true;
                const preview = app.querySelector('.live-loading');
                preview?.classList.add('is-done');
                setTimeout(() => preview?.remove(), STAGE_FADE_MS);
            }
        }, STAGE_POLL_MS);
    }

    /*
     * Order of the live view: four groups, inside a group the views with a short name and a symbol for the device they
     * are made for. Two views with the same short name (e.g. the floor plan for screens and for tablets) are one entry
     * with a switch. A new vis-2 project lands in the design templates by itself.
     */
    const LIVE_GROUPS = [
        { id: 'plan', match: demo => /grundriss|floor plan|^custom-home3d/i.test(`${demo.id} ${demo.title.de || ''}`) },
        { id: 'standard', match: demo => /^vis-2-(standard-widgets|glashaus-widgets|jaeger-design-widgets)/.test(demo.id) },
        { id: 'design', match: demo => demo.type === 'vis-2' },
        { id: 'more', match: () => true },
    ];

    /** The order on the page; LIVE_GROUPS is the order in which a view is assigned */
    const GROUP_ORDER = ['standard', 'design', 'plan', 'more'];

    function groupOf(demo) {
        return LIVE_GROUPS.find(group => group.match(demo)).id;
    }

    /** The device a view is made for, from its German title: Handy, Tablet, Bildschirm, otherwise any device */
    function deviceOf(demo) {
        const title = demo.title.de || tr(demo.title);
        if (/\bHandy\b/i.test(title)) return 'phone';
        if (/\bTablet\b/i.test(title)) return 'tablet';
        if (/\bBildschirm\b/i.test(title)) return 'screen';
        return 'any';
    }

    /** The short name inside its group: the own tab name, otherwise the title without device and group words */
    function shortName(demo) {
        const own = tr(demo.tab);
        if (own) return own;
        let name = tr(demo.title);
        if (groupOf(demo) === 'standard' && /^Standard[-\s]widgets(\s+(für|for)\s+|:\s*)./i.test(name)) {
            // "Standard-Widgets für Handy" is "Handy", "Standard-Widgets: Wetter" is "Wetter"
            name = name.replace(/^Standard[-\s]widgets(\s+(für|for)\s+|:\s*)/i, '');
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
        return name.replace(/\s+(für|for)\s+(Handy|Tablet|Bildschirm|phones?|tablets?|screens?)$/i, '').replace(/[-\s]widgets$/i, '');
    }

    function fitsDevice(demo) {
        const device = deviceOf(demo);
        return liveDevice === 'all' || device === 'any' || device === liveDevice;
    }

    /** The entries of one group: views with the same short name are one entry with variants */
    function groupEntries(groupId) {
        const entries = [];
        for (const demo of liveDemos()) {
            // the open view always stays in the list, also when the device filter would hide it
            if (groupOf(demo) !== groupId || (!fitsDevice(demo) && demo.id !== currentLiveId)) continue;
            const name = shortName(demo);
            const entry = entries.find(item => item.name === name);
            if (entry) entry.variants.push(demo);
            else entries.push({ name, variants: [demo] });
        }
        return entries;
    }

    /** All views in the order of the groups, as the arrows on a phone step through them */
    function orderedDemos() {
        return GROUP_ORDER.flatMap(id => groupEntries(id).flatMap(entry => entry.variants));
    }

    function setLiveState(change) {
        Object.assign(state, change);
        liveGroup = state.liveGroup;
        liveDevice = state.liveDevice;
        pickerOpen = state.pickerOpen;
        render();
    }
    const state = { liveGroup: null, liveDevice: 'all', pickerOpen: false };
    let currentLiveId = null;

    function deviceFilter(t) {
        return h(
            'div',
            { class: 'live-devices', role: 'group', 'aria-label': t.deviceNav },
            ['all', 'phone', 'tablet', 'screen'].map(device =>
                h(
                    'button',
                    {
                        type: 'button',
                        'aria-pressed': liveDevice === device ? 'true' : 'false',
                        title: device === 'all' ? t.deviceAll : t.devices[device],
                        'aria-label': device === 'all' ? t.deviceAll : t.devices[device],
                        onclick: () => setLiveState({ liveDevice: device }),
                    },
                    device === 'all' ? t.deviceAll : icon(device),
                ),
            ),
        );
    }

    function deviceIcon(demo, t) {
        const device = deviceOf(demo);
        const svg = icon(device);
        return h('span', { class: 'live-device', title: t.devices[device] }, svg);
    }

    function renderLiveNav(demo, t) {
        currentLiveId = demo.id;
        const current = liveGroup || groupOf(demo);
        const groups = GROUP_ORDER.map(id => ({ id, entries: groupEntries(id) }));
        const shown = groups.find(group => group.id === current) || groups[0];
        const order = orderedDemos();
        const index = order.findIndex(item => item.id === demo.id);
        const step = delta => {
            if (!order.length) return;
            const target = order[(index + delta + order.length) % order.length];
            setLiveState({ liveGroup: null });
            navigate(liveUrl(target));
        };
        return [
            // Bildschirm und Tablet: Gruppen, darunter die Visualisierungen der Gruppe
            h(
                'div',
                { class: 'live-groups' },
                h(
                    'nav',
                    { class: 'live-group-list', 'aria-label': t.groupNav },
                    groups.map(group =>
                        h(
                            'button',
                            {
                                type: 'button',
                                'aria-pressed': group.id === shown.id ? 'true' : 'false',
                                disabled: group.entries.length ? null : '',
                                onclick: () => setLiveState({ liveGroup: group.id }),
                            },
                            t.groups[group.id],
                            h('small', null, String(group.entries.length)),
                        ),
                    ),
                ),
                deviceFilter(t),
            ),
            h(
                'nav',
                { class: 'live-tabs', 'aria-label': t.viewNav },
                shown.entries.map(entry => {
                    const active = entry.variants.find(item => item.id === demo.id);
                    if (entry.variants.length === 1) {
                        const item = entry.variants[0];
                        return h(
                            'button',
                            { type: 'button', 'aria-pressed': active ? 'true' : 'false', onclick: () => navigate(liveUrl(item)) },
                            entry.name,
                            deviceIcon(item, t),
                        );
                    }
                    return h(
                        'div',
                        { class: `live-variant${active ? ' is-active' : ''}` },
                        h(
                            'button',
                            {
                                type: 'button',
                                class: 'live-variant-name',
                                'aria-pressed': active ? 'true' : 'false',
                                onclick: () => navigate(liveUrl(active || entry.variants[0])),
                            },
                            entry.name,
                        ),
                        h(
                            'span',
                            { class: 'live-variant-switch' },
                            entry.variants.map(item =>
                                h(
                                    'button',
                                    {
                                        type: 'button',
                                        'aria-pressed': item.id === demo.id ? 'true' : 'false',
                                        onclick: () => navigate(liveUrl(item)),
                                    },
                                    t.devices[deviceOf(item)] || shortName(item),
                                ),
                            ),
                        ),
                    );
                }),
            ),
            // Handy: eine Zeile mit Pfeilen, ein Tipp öffnet die ganze Liste
            h(
                'div',
                { class: 'live-picker' },
                h('button', { type: 'button', class: 'live-step', 'aria-label': t.prevView, onclick: () => step(-1) }, icon('prev')),
                h(
                    'button',
                    { type: 'button', class: 'live-current', 'aria-label': t.pickView, 'aria-expanded': pickerOpen ? 'true' : 'false', onclick: () => setLiveState({ pickerOpen: true }) },
                    h('span', null, h('small', null, t.groups[groupOf(demo)]), h('b', null, tr(demo.title))),
                    icon('chevron'),
                ),
                h('button', { type: 'button', class: 'live-step', 'aria-label': t.nextView, onclick: () => step(1) }, icon('next')),
            ),
            pickerOpen &&
                h(
                    'div',
                    { class: 'live-sheet-wrap', onclick: event => event.target === event.currentTarget && setLiveState({ pickerOpen: false }) },
                    h(
                        'div',
                        { class: 'live-sheet', role: 'dialog', 'aria-label': t.pickView },
                        h(
                            'div',
                            { class: 'live-sheet-head' },
                            h('span', null, t.deviceNav),
                            deviceFilter(t),
                            h('button', { type: 'button', class: 'live-sheet-close', 'aria-label': t.close, onclick: () => setLiveState({ pickerOpen: false }) }, '×'),
                        ),
                        groups
                            .filter(group => group.entries.length)
                            .map(group => [
                                h('h4', null, t.groups[group.id]),
                                group.entries.flatMap(entry =>
                                    entry.variants.map(item =>
                                        h(
                                            'button',
                                            {
                                                type: 'button',
                                                class: 'live-sheet-row',
                                                'aria-current': item.id === demo.id ? 'true' : null,
                                                onclick: () => {
                                                    setLiveState({ pickerOpen: false, liveGroup: null });
                                                    navigate(liveUrl(item));
                                                },
                                            },
                                            entry.variants.length > 1 ? tr(item.title) : entry.name,
                                            deviceIcon(item, t),
                                        ),
                                    ),
                                ),
                            ]),
                    ),
                ),
        ];
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
                // the actions stand in the first row beside the brand, the views get the second row
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
                renderLiveNav(demo, t),
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
                        // the action stands in the head of the description, beside the title, and takes no row of its own
                        h(
                            'div',
                            { class: 'side-head' },
                            h('div', null, h('p', { class: 'side-label' }, t.thisView), h('h1', null, tr(demo.title))),
                            renderSideAction(demo),
                        ),
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
                ),
            ),
        );
    }

    /**
     * The action of a live view: the download of its project. A demo without a project to download gets no button:
     * a link to the start page of iobroker.com would only send the visitor away without an answer.
     */
    function renderSideAction(demo) {
        // a template marked as coming soon (e.g. its adapter is not released yet) offers no download dialog yet
        if (!setupProject(demo) || (demo.download?.soon && !demo.download?.url)) {
            return null;
        }
        return h(
            'button',
            { type: 'button', class: 'btn btn--secondary btn-row side-action', onclick: () => openSetup(demo) },
            SETUP[lang === 'en' ? 'en' : 'de'].button,
            icon('download'),
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
                [
                    'Adapter installieren',
                    'In ioBroker Admin unter „Adapter“ installieren oder aktualisieren: web und vis-2 ab Version 2.20.10. Ältere vis-2 Versionen zeigen manche Details der Demos nicht, etwa Fotos bei Personen. Andere installierte Widget-Sets ebenfalls aktualisieren, ältere Sets kann die neue vis-2 sonst nicht laden.',
                ],
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
            hint: 'Die Datenpunkte bringen eine Momentaufnahme der Demo-Werte mit, das Projekt sieht also gleich nach dem Import gefüllt aus. Die Werte ändern sich aber erst, wenn eigene Geräte verbunden sind. Zum Ausprobieren lassen sich Werte in Admin unter „Objekte“ von Hand setzen.',
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
                [
                    'Install adapters',
                    'In ioBroker Admin under "Adapters" install or update: web and vis-2 version 2.20.10 or newer. Older vis-2 versions do not show some details of the demos, like photos of persons. Update other installed widget sets as well, the new vis-2 cannot load older sets.',
                ],
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
            hint: 'The states come with a snapshot of the demo values, so the project looks filled right after the import. The values only change once your own devices are connected. To try it out, set values by hand in Admin under "Objects".',
            more: 'More guides on iobroker.com',
            close: 'Close',
        },
    };

    /*
     * 3D Home: the floor plan is exported in the format of its "Projekte" dialog and lies in
     * demo-page.0/downloads/<file>.json, the states again in <file>-datenpunkte.json.
     */
    const HOME3D_FILE = '3d-home-familie-mueller';
    // 3D Home starts in Neon and keeps the visitor's own choice in the browser (localStorage, same origin).
    // The demo opens in the doll house with furniture, as long as the visitor has chosen nothing yet.
    const HOME3D_START_STYLE = 'dollhouse';

    function presetHome3dStyle() {
        try {
            if (window.localStorage.getItem('home3d.theme') === null) {
                window.localStorage.setItem('home3d.theme', HOME3D_START_STYLE);
            }
        } catch {
            // without storage 3D Home simply starts in its own style
        }
    }
    const SETUP_HOME3D = {
        de: {
            intro: 'So bekommen Sie dieses Haus in Ihr eigenes ioBroker. Sie brauchen dafür zwei Dateien:',
            fileProject: 'Grundriss für 3D Home (.json)',
            steps: [
                [
                    'Adapter installieren',
                    'In ioBroker Admin unter „Adapter“ installieren: web und 3D Home (Adapter home3d). 3D Home läuft im web-Adapter, die Seite heißt dort /home3d/index.html.',
                ],
                [
                    'Datenpunkte anlegen',
                    'In Admin „Objekte“ öffnen, den Expertenmodus einschalten und über das Symbol zum Hochladen die Datei mit den Datenpunkten importieren. Es entsteht der Ordner 0_userdata.0.Demo mit allen Datenpunkten, die das Haus benutzt. Erst danach den Grundriss importieren, denn 3D Home prüft beim Import, ob die Datenpunkte da sind.',
                ],
                [
                    'Grundriss importieren',
                    '3D Home öffnen, oben auf „Projekte“ gehen und die Datei „%s.json“ importieren. Sie bringt Etagen, Räume, Möbel, Garten, Dach und die Zuordnung aller Geräte mit.',
                ],
                [
                    'Eigene Geräte verbinden',
                    'Über „Geräte verbinden“ die Demo-Datenpunkte durch eigene ersetzen oder neue Geräte aus dem Objektbaum wählen. Im Editor lassen sich Wände, Räume und Möbel an das eigene Haus anpassen.',
                ],
            ],
            hint: 'Die Datenpunkte bringen eine Momentaufnahme der Demo-Werte mit, das Haus sieht also gleich nach dem Import belebt aus. Die Werte ändern sich aber erst, wenn eigene Geräte verbunden sind.',
        },
        en: {
            intro: 'This is how you get this house into your own ioBroker. You need two files:',
            fileProject: 'Floor plan for 3D Home (.json)',
            steps: [
                [
                    'Install adapters',
                    'In ioBroker Admin under "Adapters" install: web and 3D Home (adapter home3d). 3D Home runs inside the web adapter, its page is /home3d/index.html.',
                ],
                [
                    'Create the states',
                    'Open "Objects" in Admin, switch on the expert mode and import the file with the states with the upload icon. This creates the folder 0_userdata.0.Demo with all states the house uses. Import the floor plan only afterwards, as 3D Home checks on import whether the states exist.',
                ],
                [
                    'Import the floor plan',
                    'Open 3D Home, go to "Projekte" at the top and import the file "%s.json". It brings floors, rooms, furniture, garden, roof and the assignment of all devices.',
                ],
                [
                    'Connect your own devices',
                    'Replace the demo states with your own via "Geräte verbinden", or pick new devices from the object tree. In the editor walls, rooms and furniture can be adapted to your own house.',
                ],
            ],
            hint: 'The states come with a snapshot of the demo values, so the house looks alive right after the import. The values only change once your own devices are connected.',
        },
    };

    /** The project of a demo to download, or null if it has nothing to download */
    function setupProject(demo) {
        if (!demo.live?.url) {
            return null;
        }
        if (demo.type === 'custom' && /\/home3d\/(index\.html)?(\?|#|$)/.test(demo.live.url)) {
            // Every plan of the demo has its own floor plan file, the states are the same for all
            const plan = /[?&]plan=([\w-]+)/.exec(demo.live.url)?.[1];
            const name = plan && plan !== 'main' ? `${HOME3D_FILE}-${plan}` : HOME3D_FILE;
            return { kind: 'home3d', name, states: HOME3D_FILE };
        }
        if (demo.type !== 'vis-2') {
            return null;
        }
        const match = /\?([^#&]+)/.exec(demo.live.url);
        return match ? { kind: 'vis-2', name: decodeURIComponent(match[1]) } : null;
    }

    function openSetup(demo) {
        const language = lang === 'en' ? 'en' : 'de';
        const setup = setupProject(demo);
        const s = setup.kind === 'home3d' ? { ...SETUP[language], ...SETUP_HOME3D[language] } : SETUP[language];
        const notes = ADAPTER_NOTES[language];
        const project = setup.name;
        const projectFile = setup.kind === 'home3d' ? `${project}.json` : `${project}.zip`;
        const extra = demo.tags.filter(tag => tag !== 'vis-2' && tag !== 'home3d');
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
                h('a', { class: 'btn btn--primary', href: `${DOWNLOADS}${projectFile}`, download: '' }, icon('download'), s.fileProject),
                h(
                    'a',
                    { class: 'btn btn--secondary', href: `${DOWNLOADS}${setup.states || project}-datenpunkte.json`, download: '' },
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
    /** Live view: the group whose views are listed, the device filter and whether the list on a phone is open */
    let liveGroup = null;
    let liveDevice = 'all';
    let pickerOpen = false;
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
        // a new view starts with its own group; the device filter stays
        if (demo && renderedDemoId !== demo.id) {
            state.liveGroup = liveGroup = null;
            state.pickerOpen = pickerOpen = false;
        }
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
