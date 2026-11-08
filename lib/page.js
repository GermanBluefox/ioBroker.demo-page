'use strict';
/*
 * Builds the public page description (config.json) from the instance configuration. Everything in this file
 * ends up readable by anonymous visitors, so only what is explicitly meant for the page is copied.
 */
const { PROVIDERS } = require('./providers');

/** @param {string | undefined} value */
function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * The text of a field and its English variant in `<name>En`.
 *
 * @param {Record<string, any>} source
 * @param {string} name
 */
function text(source, name) {
    return { de: clean(source[name]), en: clean(source[`${name}En`]) };
}

/**
 * Only addresses that a link may open: rejects `javascript:` and the like.
 *
 * @param {string | undefined} value
 */
function safeUrl(value) {
    const url = clean(value);
    if (!url) {
        return '';
    }
    const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme && !['http', 'https', 'mailto'].includes(scheme[1].toLowerCase())) {
        return '';
    }
    return url;
}

/**
 * A file of the ioBroker file storage (`demo-page.0/shot.png`) as an address, or a full URL as it is.
 *
 * @param {string | undefined} value
 */
function fileUrl(value) {
    const url = safeUrl(value);
    if (!url || /^(https?:)?\/\//i.test(url)) {
        return url;
    }
    return `../${url.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`;
}

/** @param {string} value */
function slug(value) {
    return (
        value
            .toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'x'
    );
}

/** Gives unique, stable ids */
function createIdFactory() {
    const used = new Set();
    return base => {
        let id = base;
        for (let i = 2; used.has(id); i++) {
            id = `${base}-${i}`;
        }
        used.add(id);
        return id;
    };
}

/** @param {any[] | undefined} links */
function buildLinks(links) {
    return (links || [])
        .map(link => ({ label: text(link, 'label'), url: safeUrl(link.url) }))
        .filter(link => link.url && link.label.de);
}

/**
 * @param {any} adapter
 * @param {Record<string, any>} row
 */
async function resolveDemo(adapter, row) {
    if (row.type === 'custom') {
        const url = safeUrl(row.customUrl);
        return url ? { title: url, live: { url, probes: /^[a-z]+:|^\/\//i.test(url) ? [] : [url] } } : null;
    }
    const provider = PROVIDERS[row.type];
    if (!provider || (provider.hasProjects && !row.project)) {
        return null;
    }
    return provider.resolve(adapter, { project: clean(row.project), view: provider.hasViews ? clean(row.view) : '' });
}

/**
 * @param {any} adapter
 * @param {any[] | undefined} rows
 */
async function buildSections(adapter, rows) {
    const sectionId = createIdFactory();
    const demoId = createIdFactory();
    const sections = new Map();

    for (const row of rows || []) {
        if (row.enabled === false) {
            continue;
        }
        const name = `${row.type || '?'}${row.project ? ` / ${row.project}` : ''}${row.view ? ` / ${row.view}` : ''}`;
        let resolved = null;
        try {
            resolved = await resolveDemo(adapter, row);
        } catch (error) {
            adapter.log.warn(`Cannot resolve demo "${name}": ${error.message}`);
            continue;
        }
        if (!resolved) {
            adapter.log.warn(`Demo "${name}" is not shown: it is incomplete or its project does not exist any more`);
            continue;
        }

        const typeLabel = row.type === 'custom' ? '' : PROVIDERS[row.type].label;
        const title = text(row, 'title');
        title.de ||= resolved.title;
        const heading = clean(row.section) || typeLabel || 'Demos';
        if (!sections.has(heading)) {
            const headingText = text(row, 'section');
            headingText.de ||= heading;
            sections.set(heading, { id: sectionId(`s-${slug(heading)}`), title: headingText, demos: [] });
        }
        sections.get(heading).demos.push({
            id: demoId(slug(`${row.type}-${row.project || ''}-${row.view || ''}`)),
            type: row.type,
            typeLabel: typeLabel || heading,
            title,
            tab: text(row, 'tab'),
            desc: text(row, 'desc'),
            image: fileUrl(row.image),
            tags: Array.isArray(row.tags) ? row.tags.filter(tag => typeof tag === 'string' && tag.trim()) : [],
            live: { ...resolved.live, newTab: !!row.newTab },
            download: { url: fileUrl(row.downloadUrl), soon: !!row.downloadSoon },
        });
    }
    return [...sections.values()];
}

/**
 * @param {any} adapter
 * @param {Record<string, any>} config the native part of the instance
 */
async function buildPage(adapter, config) {
    return {
        version: 1,
        generated: new Date().toISOString(),
        defaultLanguage: ['de', 'en'].includes(config.defaultLanguage) ? config.defaultLanguage : '',
        languageSwitch: config.languageSwitch !== false,
        brand: { name: clean(config.brandName) || 'iobroker', suffix: clean(config.brandSuffix) },
        hero: config.heroEnabled === false
            ? null
            : {
                  kicker: text(config, 'heroKicker'),
                  title: text(config, 'heroTitle'),
                  text: text(config, 'heroText'),
                  image: fileUrl(config.heroImage),
              },
        highlights: config.highlightsEnabled === false ? [] : (config.highlights || []).map(item => ({
            title: text(item, 'title'),
            text: text(item, 'text'),
        })),
        sections: await buildSections(adapter, config.demos),
        howto: config.howtoEnabled === false || !config.howtoSteps?.length
            ? null
            : {
                  title: text(config, 'howtoTitle'),
                  nav: text(config, 'howtoNav'),
                  steps: config.howtoSteps.map(item => ({
                      title: text(item, 'title'),
                      text: text(item, 'text'),
                      image: fileUrl(item.image),
                  })),
              },
        install: config.installEnabled === false
            ? null
            : {
                  title: text(config, 'installTitle'),
                  text: text(config, 'installText'),
                  button: text(config, 'installButton'),
                  url: safeUrl(config.installUrl),
              },
        notice: text(config, 'notice'),
        guide: { label: text(config, 'guideLabel'), url: safeUrl(config.guideUrl) },
        navLinks: buildLinks(config.navLinks),
        footer: { text: text(config, 'footerText'), links: buildLinks(config.footerLinks) },
    };
}

module.exports = { buildPage, safeUrl, fileUrl };
