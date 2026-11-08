'use strict';
/*
 * What the page knows about each visualization: whether it has projects and views, how to list them and
 * under which address they open. Addresses are relative to /demo-page/index.html, so that they also work
 * below a `rootPath` of web or behind a reverse proxy.
 */

const VIS_SETTINGS_PREFIX = '___';

/** @param {string} text */
function enc(text) {
    return encodeURIComponent(text);
}

/** @param {unknown} value */
function parseJson(value) {
    if (typeof value !== 'string') {
        return value && typeof value === 'object' ? value : null;
    }
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * @param {string | Record<string, string> | undefined} name
 * @param {string} fallback
 */
function displayName(name, fallback) {
    if (typeof name === 'string' && name) {
        return name;
    }
    if (name && typeof name === 'object') {
        return name.de || name.en || Object.values(name)[0] || fallback;
    }
    return fallback;
}

/** @param {any} adapter */
async function listInstances(adapter) {
    const view = await adapter.getObjectViewAsync('system', 'instance', {
        startkey: 'system.adapter.',
        endkey: 'system.adapter.香',
    });
    return view.rows.map(row => row.value).filter(Boolean);
}

/**
 * @param {any} adapter
 * @param {string} name
 */
async function instancesOf(adapter, name) {
    const prefix = `system.adapter.${name}.`;
    return (await listInstances(adapter)).filter(obj => obj._id.startsWith(prefix));
}

/**
 * @param {any} adapter
 * @param {string} name
 */
async function presetsOf(adapter, name) {
    const view = await adapter.getObjectViewAsync('chart', 'chart', {
        startkey: `${name}.`,
        endkey: `${name}.香`,
    });
    return view.rows
        .map(row => row.value)
        .filter(Boolean)
        .map(obj => ({ value: obj._id, label: displayName(obj.common?.name, obj._id) }));
}

/**
 * The projects of vis and vis-2: the folders of `<adapter>.0` with a `vis-views.json`. Others (like empty
 * folders that are left over after renaming a project) cannot be opened.
 *
 * @param {any} adapter
 * @param {string} storage
 */
async function visProjects(adapter, storage) {
    const entries = await adapter.readDirAsync(storage, '');
    const projects = [];
    for (const entry of entries.filter(item => item.isDir)) {
        if (await adapter.fileExistsAsync(storage, `${entry.file}/vis-views.json`)) {
            projects.push({ value: entry.file, label: entry.file });
        }
    }
    return projects;
}

/**
 * @param {any} adapter
 * @param {string} storage
 * @param {string} project
 */
async function visViews(adapter, storage, project) {
    const { file } = await adapter.readFileAsync(storage, `${project}/vis-views.json`);
    const views = parseJson(file.toString()) || {};
    return Object.keys(views)
        .filter(name => !name.startsWith(VIS_SETTINGS_PREFIX))
        .map(name => ({ value: name, label: name }));
}

/** @param {string} name */
function visProvider(name, label) {
    const storage = `${name}.0`;
    return {
        label,
        adapter: name,
        hasProjects: true,
        hasViews: true,
        projects: adapter => visProjects(adapter, storage),
        views: (adapter, project) => visViews(adapter, storage, project),
        async resolve(adapter, { project, view }) {
            if (!(await adapter.fileExistsAsync(storage, `${project}/vis-views.json`))) {
                return null;
            }
            const page = `../${name}/index.html`;
            return {
                title: view || project,
                live: {
                    url: `${page}?${enc(project)}${view ? `#${enc(view)}` : ''}`,
                    // The guest needs to be able to read the runtime and also the views of this project
                    probes: [page, `../${storage}/${enc(project)}/vis-views.json`],
                },
            };
        },
    };
}

/** @param {string} name */
function singlePageProvider(name, label) {
    return {
        label,
        adapter: name,
        hasProjects: false,
        hasViews: false,
        projects: async () => [],
        views: async () => [],
        resolve: async () => {
            const url = `../${name}/index.html`;
            return { title: label, live: { url, probes: [url] } };
        },
    };
}

/** @param {string} value in form `aura.0/<layout slug>`, the slug is empty for the first layout */
function splitInstanceValue(value) {
    const pos = (value || '').indexOf('/');
    return pos === -1 ? [value || '', ''] : [value.substring(0, pos), value.substring(pos + 1)];
}

/**
 * @param {any} adapter
 * @param {string} instance
 */
async function auraLayouts(adapter, instance) {
    const state = await adapter.getForeignStateAsync(`${instance}.config.dashboard`);
    const layouts = parseJson(state?.val)?.state?.layouts;
    return Array.isArray(layouts) ? layouts : [];
}

/** Aura is reachable through web (`webInstance`) as /aura/, at `customUrl`, or else on its own port */
function auraBase(obj) {
    const native = obj.native || {};
    if (native.customUrl) {
        return { url: native.customUrl.replace(/\/*$/, '/') };
    }
    if (native.webInstance) {
        return { url: '../aura/' };
    }
    return { port: native.port || 8095, secure: !!native.secure, path: '/' };
}

const auraProvider = {
    label: 'Aura',
    adapter: 'aura',
    hasProjects: true,
    hasViews: true,
    async projects(adapter) {
        const result = [];
        for (const obj of await instancesOf(adapter, 'aura')) {
            const instance = obj._id.substring('system.adapter.'.length);
            result.push({ value: `${instance}/`, label: `${instance}: Standard` });
            for (const layout of await auraLayouts(adapter, instance)) {
                if (layout.slug) {
                    result.push({ value: `${instance}/${layout.slug}`, label: `${instance}: ${layout.name || layout.slug}` });
                }
            }
        }
        return result;
    },
    async views(adapter, project) {
        const [instance, slug] = splitInstanceValue(project);
        const layouts = await auraLayouts(adapter, instance);
        const layout = slug ? layouts.find(item => item.slug === slug) : layouts[0];
        const sections = layout?.sections || [];
        const result = [];
        for (const section of sections) {
            for (const tab of section.tabs || []) {
                const tabSlug = tab.slug ?? tab.id;
                // The app itself only names the section if the layout has several of them
                const value =
                    sections.length > 1 ? `s/${enc(section.slug)}/tab/${enc(tabSlug)}` : `tab/${enc(tabSlug)}`;
                const label = sections.length > 1 ? `${section.name} / ${tab.name}` : tab.name;
                result.push({ value, label: label || tabSlug });
            }
        }
        return result;
    },
    async resolve(adapter, { project, view }) {
        const [instance, slug] = splitInstanceValue(project);
        const obj = await adapter.getForeignObjectAsync(`system.adapter.${instance}`);
        if (!obj) {
            return null;
        }
        const layout = slug ? (await auraLayouts(adapter, instance)).find(item => item.slug === slug) : null;
        if (slug && !layout) {
            return null;
        }
        const hash = slug ? `#/view/${enc(slug)}${view ? `/${view}` : ''}` : '#/';
        const base = auraBase(obj);
        const live = base.url
            ? { url: `${base.url}${hash}`, probes: base.url.startsWith('../') ? [base.url] : [] }
            : { port: base.port, secure: base.secure, path: `/${hash}`, probes: [] };
        return { title: layout?.name || 'Aura', live };
    },
};

const iqontrolProvider = {
    label: 'iQontrol',
    adapter: 'iqontrol',
    hasProjects: true,
    hasViews: true,
    async projects(adapter) {
        return (await instancesOf(adapter, 'iqontrol')).map(obj => {
            const value = obj._id.substring('system.adapter.'.length);
            return { value, label: value };
        });
    },
    async views(adapter, project) {
        const obj = await adapter.getForeignObjectAsync(`system.adapter.${project}`);
        return (obj?.native?.views || [])
            .map(view => view.commonName)
            .filter(Boolean)
            .map(name => ({ value: name, label: name }));
    },
    async resolve(adapter, { project, view }) {
        if (!(await adapter.getForeignObjectAsync(`system.adapter.${project}`))) {
            return null;
        }
        const page = '../iqontrol/index.html';
        const render = view ? `&renderView=${enc(`${project}.Views.${view}`)}` : '';
        return {
            title: view || project,
            live: { url: `${page}?namespace=${enc(project)}${render}`, probes: [page] },
        };
    },
};

const jarvisProvider = {
    label: 'jarvis',
    adapter: 'jarvis',
    hasProjects: true,
    hasViews: true,
    async projects(adapter) {
        return (await instancesOf(adapter, 'jarvis')).map(obj => {
            const value = obj._id.substring('system.adapter.'.length);
            return { value, label: value };
        });
    },
    async views(adapter, project) {
        const state = await adapter.getForeignStateAsync(`${project}.layout`);
        const pages = parseJson(state?.val)?.layout;
        const result = [];
        for (const page of Array.isArray(pages) ? pages : []) {
            for (const tab of page.tabs || []) {
                if (tab.id) {
                    result.push({ value: tab.id, label: `${page.title || page.id} / ${tab.title || tab.id}` });
                }
            }
        }
        return result;
    },
    async resolve(adapter, { project, view }) {
        const obj = await adapter.getForeignObjectAsync(`system.adapter.${project}`);
        if (!obj) {
            return null;
        }
        const instance = Number(project.split('.').pop()) || 0;
        return {
            title: view || project,
            live: {
                port: obj.native?.socketPort || 8400 + instance,
                secure: !!obj.native?.secure,
                path: `/jarvis/${view ? `#/${enc(view)}` : ''}`,
                probes: [],
            },
        };
    },
};

/** Lovelace has an own web server per instance. Its panels are paths of that server. */
const lovelaceProvider = {
    label: 'Lovelace',
    adapter: 'lovelace',
    hasProjects: true,
    hasViews: false,
    async projects(adapter) {
        const result = [];
        for (const obj of await instancesOf(adapter, 'lovelace')) {
            const instance = obj._id.substring('system.adapter.'.length);
            result.push({ value: `${instance}/lovelace`, label: `${instance}: Standard` });
            const storage = await adapter.getForeignObjectAsync(`${instance}.storage.dashboardStorage`);
            for (const board of storage?.native?.dashboards || []) {
                if (board.url_path) {
                    result.push({ value: `${instance}/${board.url_path}`, label: `${instance}: ${board.title || board.url_path}` });
                }
            }
        }
        return result;
    },
    views: async () => [],
    async resolve(adapter, { project }) {
        const [instance, path] = splitInstanceValue(project);
        const obj = await adapter.getForeignObjectAsync(`system.adapter.${instance}`);
        if (!obj) {
            return null;
        }
        return {
            title: path || instance,
            live: {
                port: obj.native?.port || 8091,
                secure: !!obj.native?.secure,
                path: `/${path.split('/').map(enc).join('/')}`,
                probes: [],
            },
        };
    },
};

const echartsProvider = {
    label: 'E-Charts',
    adapter: 'echarts',
    hasProjects: true,
    hasViews: false,
    projects: adapter => presetsOf(adapter, 'echarts'),
    views: async () => [],
    async resolve(adapter, { project }) {
        const obj = await adapter.getForeignObjectAsync(project);
        if (!obj) {
            return null;
        }
        const page = '../echarts/index.html';
        return {
            title: displayName(obj.common?.name, project),
            live: { url: `${page}?preset=${enc(project)}`, probes: [page] },
        };
    },
};

const flotProvider = {
    label: 'Flot',
    adapter: 'flot',
    hasProjects: true,
    hasViews: false,
    projects: adapter => presetsOf(adapter, 'flot'),
    views: async () => [],
    async resolve(adapter, { project }) {
        const obj = await adapter.getForeignObjectAsync(project);
        if (!obj) {
            return null;
        }
        const page = '../flot/preset.html';
        const name = project.split('.').slice(2).join('.');
        return {
            title: displayName(obj.common?.name, project),
            live: { url: `${page}?preset=${enc(name)}`, probes: [page] },
        };
    },
};

/** Free address for everything else. `custom` is handled in page.js, as it needs no adapter. */
const customProvider = {
    label: 'Eigene Adresse (URL)',
    adapter: null,
    hasProjects: false,
    hasViews: false,
    projects: async () => [],
    views: async () => [],
    resolve: async () => null,
};

const PROVIDERS = {
    'vis-2': visProvider('vis-2', 'vis-2'),
    vis: visProvider('vis', 'vis'),
    aura: auraProvider,
    devices: singlePageProvider('devices', 'Devices'),
    iqontrol: iqontrolProvider,
    jarvis: jarvisProvider,
    material: singlePageProvider('material', 'Material'),
    lovelace: lovelaceProvider,
    echarts: echartsProvider,
    flot: flotProvider,
    habpanel: singlePageProvider('habpanel', 'HABPanel'),
    custom: customProvider,
};

/**
 * The visualizations that can be selected: the installed ones and the free address.
 *
 * @param {any} adapter
 */
async function getVisualizations(adapter) {
    const installed = new Set((await listInstances(adapter)).map(obj => obj.common?.name));
    return Object.entries(PROVIDERS)
        .filter(([, provider]) => !provider.adapter || installed.has(provider.adapter))
        .map(([value, provider]) => ({ value, label: provider.label }));
}

/**
 * @param {any} adapter
 * @param {string} type
 */
async function getProjects(adapter, type) {
    return (await PROVIDERS[type]?.projects(adapter)) || [];
}

/** The entry of the view list for "no certain view": the visualization opens with its own start view */
const DEFAULT_VIEW = { value: '', label: '(Standard)' };

/**
 * @param {any} adapter
 * @param {string} type
 * @param {string} project
 */
async function getViews(adapter, type, project) {
    if (!project || !PROVIDERS[type]?.hasViews) {
        return [];
    }
    // The view is optional, so a chosen view must be removable again
    return [DEFAULT_VIEW, ...((await PROVIDERS[type].views(adapter, project)) || [])];
}

module.exports = { DEFAULT_VIEW, PROVIDERS, getVisualizations, getProjects, getViews };
