'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, it } = require('node:test');
const { PROVIDERS, getProjects, getViews, getVisualizations } = require('../../lib/providers');
const { buildPage, fileUrl, safeUrl } = require('../../lib/page');

const AURA_DASHBOARD = JSON.stringify({
    version: 1,
    state: {
        layouts: [
            {
                id: 'l1',
                name: 'Wohnung',
                slug: 'wohnung',
                sections: [{ id: 's1', name: 'Haupt', slug: 'haupt', tabs: [{ id: 't1', name: 'Start', slug: 'start' }] }],
            },
            {
                id: 'l2',
                name: 'Haus',
                slug: 'haus',
                sections: [
                    { id: 's1', name: 'Oben', slug: 'oben', tabs: [{ id: 't1', name: 'Bad', slug: 'bad' }] },
                    { id: 's2', name: 'Unten', slug: 'unten', tabs: [{ id: 't2', name: 'Flur' }] },
                ],
            },
        ],
    },
});

function fakeAdapter() {
    const files = {
        'vis-2.0': {
            'glashaus-demo/vis-views.json': JSON.stringify({ ___settings: {}, zuhause: {}, energie: {} }),
            'modern/vis-views.json': JSON.stringify({ saugroboter: {} }),
        },
    };
    const objects = {
        'system.adapter.vis-2.0': { _id: 'system.adapter.vis-2.0', common: { name: 'vis-2' }, native: {} },
        'system.adapter.aura.0': { _id: 'system.adapter.aura.0', common: { name: 'aura' }, native: { port: 8095, webInstance: '' } },
        'system.adapter.devices.0': { _id: 'system.adapter.devices.0', common: { name: 'devices' }, native: {} },
        'system.adapter.iqontrol.1': {
            _id: 'system.adapter.iqontrol.1',
            common: { name: 'iqontrol' },
            native: { views: [{ commonName: 'Wohnzimmer' }, { commonName: 'Küche' }] },
        },
        'echarts.0.energy': { _id: 'echarts.0.energy', common: { name: { de: 'Energie' } } },
    };
    const warnings = [];
    return {
        warnings,
        log: { warn: text => warnings.push(text) },
        getObjectViewAsync: async (design, view, { startkey }) => {
            if (design === 'system') {
                return { rows: Object.values(objects).filter(o => o._id.startsWith('system.adapter.')).map(value => ({ value })) };
            }
            return { rows: Object.values(objects).filter(o => o._id.startsWith(startkey)).map(value => ({ value })) };
        },
        getForeignObjectAsync: async id => objects[id] || null,
        getForeignStateAsync: async id => (id === 'aura.0.config.dashboard' ? { val: AURA_DASHBOARD } : null),
        readDirAsync: async () => [
            { file: 'glashaus-demo', isDir: true },
            { file: 'modern', isDir: true },
            { file: 'empty-leftover', isDir: true },
            { file: 'vis-common-user.css', isDir: false },
        ],
        fileExistsAsync: async (storage, name) => !!files[storage]?.[name],
        readFileAsync: async (storage, name) => ({ file: files[storage][name] }),
    };
}

describe('lists for the configuration', () => {
    it('offers only installed visualizations and the free address', async () => {
        const values = (await getVisualizations(fakeAdapter())).map(item => item.value);
        assert.deepEqual(values, ['vis-2', 'aura', 'devices', 'iqontrol', 'custom']);
    });

    it('lists vis-2 projects without folders that have no views', async () => {
        const projects = await getProjects(fakeAdapter(), 'vis-2');
        assert.deepEqual(projects.map(item => item.value), ['glashaus-demo', 'modern']);
    });

    it('lists vis-2 views without the settings', async () => {
        const views = await getViews(fakeAdapter(), 'vis-2', 'glashaus-demo');
        assert.deepEqual(views.map(item => item.value), ['', 'zuhause', 'energie']);
    });

    it('lists the layouts of Aura', async () => {
        const projects = await getProjects(fakeAdapter(), 'aura');
        assert.deepEqual(projects.map(item => item.value), ['aura.0/', 'aura.0/wohnung', 'aura.0/haus']);
    });

    it('names the Aura section only if a layout has several, as Aura itself does', async () => {
        assert.deepEqual((await getViews(fakeAdapter(), 'aura', 'aura.0/wohnung')).map(i => i.value), ['', 'tab/start']);
        assert.deepEqual((await getViews(fakeAdapter(), 'aura', 'aura.0/haus')).map(i => i.value), [
            '',
            's/oben/tab/bad',
            's/unten/tab/t2',
        ]);
    });

    it('lists iQontrol instances and their views', async () => {
        assert.deepEqual((await getProjects(fakeAdapter(), 'iqontrol')).map(i => i.value), ['iqontrol.1']);
        assert.deepEqual((await getViews(fakeAdapter(), 'iqontrol', 'iqontrol.1')).map(i => i.value), ['', 'Wohnzimmer', 'Küche']);
    });

    it('returns nothing for an unknown type', async () => {
        assert.deepEqual(await getProjects(fakeAdapter(), 'nope'), []);
        assert.deepEqual(await getViews(fakeAdapter(), 'nope', 'x'), []);
    });
});

describe('page description', () => {
    const page = (demos, extra = {}) => buildPage(fakeAdapter(), { demos, ...extra });

    it('builds the address of a vis-2 view and checks runtime and project', async () => {
        const { sections } = await page([{ type: 'vis-2', project: 'glashaus-demo', view: 'energie' }]);
        const { live } = sections[0].demos[0];
        assert.equal(live.url, '../vis-2/index.html?glashaus-demo#energie');
        assert.deepEqual(live.probes, ['../vis-2/index.html', '../vis-2.0/glashaus-demo/vis-views.json']);
    });

    it('builds Aura addresses on the own port and through web', async () => {
        const adapter = fakeAdapter();
        let { sections } = await buildPage(adapter, {
            demos: [{ type: 'aura', project: 'aura.0/haus', view: 's/oben/tab/bad' }],
        });
        assert.deepEqual(
            { port: sections[0].demos[0].live.port, path: sections[0].demos[0].live.path },
            { port: 8095, path: '/#/view/haus/s/oben/tab/bad' },
        );

        (await adapter.getForeignObjectAsync('system.adapter.aura.0')).native.webInstance = 'web.0';
        ({ sections } = await buildPage(adapter, { demos: [{ type: 'aura', project: 'aura.0/' }] }));
        assert.equal(sections[0].demos[0].live.url, '../aura/#/');
    });

    it('builds an iQontrol address', async () => {
        const { sections } = await page([{ type: 'iqontrol', project: 'iqontrol.1', view: 'Küche' }]);
        assert.equal(
            sections[0].demos[0].live.url,
            '../iqontrol/index.html?namespace=iqontrol.1&renderView=iqontrol.1.Views.K%C3%BCche',
        );
    });

    it('needs no project for Devices', async () => {
        const { sections } = await page([{ type: 'devices', project: 'left-over', view: 'left-over' }]);
        assert.equal(sections[0].demos[0].live.url, '../devices/index.html');
    });

    it('groups by section in the configured order and defaults to the visualization', async () => {
        const { sections } = await page([
            { type: 'vis-2', project: 'modern', section: 'Favoriten', sectionEn: 'Favourites' },
            { type: 'devices' },
            { type: 'vis-2', project: 'glashaus-demo', section: 'Favoriten' },
        ]);
        assert.deepEqual(sections.map(s => s.title.de), ['Favoriten', 'Devices']);
        assert.equal(sections[0].title.en, 'Favourites');
        assert.equal(sections[0].demos.length, 2);
    });

    it('leaves out disabled, incomplete and deleted demos, and warns about the last two', async () => {
        const adapter = fakeAdapter();
        const { sections } = await buildPage(adapter, {
            demos: [
                { type: 'vis-2', project: 'modern', enabled: false },
                { type: 'vis-2' },
                { type: 'vis-2', project: 'was-deleted' },
                { type: 'unknown' },
                { type: 'custom' },
            ],
        });
        assert.deepEqual(sections, []);
        assert.equal(adapter.warnings.length, 4);
    });

    it('gives unique ids to two demos of the same view', async () => {
        const { sections } = await page([
            { type: 'vis-2', project: 'modern' },
            { type: 'vis-2', project: 'modern' },
        ]);
        const [a, b] = sections[0].demos;
        assert.notEqual(a.id, b.id);
    });

    it('uses the view as title if none is set', async () => {
        const { sections } = await page([{ type: 'vis-2', project: 'glashaus-demo', view: 'energie', title: ' ' }]);
        assert.equal(sections[0].demos[0].title.de, 'energie');
    });

    it('publishes the picture of a how-to step as a relative address', async () => {
        const result = await page([], {
            howtoSteps: [{ title: 'a', image: 'demo-page.0/images/a b.jpg' }, { title: 'b' }, { title: 'c', image: 'javascript:alert(1)' }],
        });
        assert.equal(result.howto.steps[0].image, '../demo-page.0/images/a%20b.jpg');
        assert.equal(result.howto.steps[1].image, '');
        assert.equal(result.howto.steps[2].image, '');
    });

    it('offers an empty entry in front of the views, so that a chosen view can be removed', async () => {
        for (const [type, project] of [['vis-2', 'glashaus-demo'], ['aura', 'aura.0/wohnung'], ['iqontrol', 'iqontrol.1']]) {
            const views = await getViews(fakeAdapter(), type, project);
            assert.deepEqual(views[0], { value: '', label: '(Standard)' });
            assert.ok(views.length > 1, type);
        }
    });

    it('offers no view list without a project or for a visualization without views', async () => {
        assert.deepEqual(await getViews(fakeAdapter(), 'vis-2', ''), []);
        assert.deepEqual(await getViews(fakeAdapter(), 'devices', 'x'), []);
    });

    it('hides switched off sections', async () => {
        const result = await page([], {
            heroEnabled: false,
            highlightsEnabled: false,
            highlights: [{ title: 'x' }],
            howtoEnabled: false,
            howtoSteps: [{ title: 'x' }],
            installEnabled: false,
        });
        assert.equal(result.hero, null);
        assert.deepEqual(result.highlights, []);
        assert.equal(result.howto, null);
        assert.equal(result.install, null);
    });

    it('never publishes settings that are not meant for the page', async () => {
        const result = await page([], { secretOfSomething: 'do-not-publish' });
        assert.ok(!JSON.stringify(result).includes('do-not-publish'));
    });

    it('lets a free address open a same-origin path with a check, and an external one without', async () => {
        const { sections } = await page([
            { type: 'custom', customUrl: '../my/index.html', section: 'x' },
            { type: 'custom', customUrl: 'https://example.org/', section: 'x' },
        ]);
        assert.deepEqual(sections[0].demos[0].live.probes, ['../my/index.html']);
        assert.deepEqual(sections[0].demos[1].live.probes, []);
    });
});

describe('addresses', () => {
    it('refuses addresses that would run code', () => {
        assert.equal(safeUrl('javascript:alert(1)'), '');
        assert.equal(safeUrl(' JAVASCRIPT:alert(1)'), '');
        assert.equal(safeUrl('data:text/html,x'), '');
        assert.equal(safeUrl('https://www.iobroker.com/'), 'https://www.iobroker.com/');
        assert.equal(safeUrl('../vis-2/index.html?a:b'), '../vis-2/index.html?a:b');
        assert.equal(safeUrl('mailto:info@example.org'), 'mailto:info@example.org');
    });

    it('turns storage files into addresses and keeps full URLs', () => {
        assert.equal(fileUrl('demo-page.0/my shot.png'), '../demo-page.0/my%20shot.png');
        assert.equal(fileUrl('/demo-page.0/a/b.png'), '../demo-page.0/a/b.png');
        assert.equal(fileUrl('https://example.org/a.png'), 'https://example.org/a.png');
        assert.equal(fileUrl(''), '');
    });
});

describe('configuration dialog', () => {
    const schema = JSON.parse(readFileSync(join(__dirname, '../../admin/jsonConfig.json'), 'utf8'));
    const rows = schema.items._demos.items.demos.items;
    const typesIn = attr => JSON.parse(rows.find(row => row.attr === attr).hidden.match(/\[.*?\]/)[0].replace(/'/g, '"'));
    const withFlag = flag =>
        Object.entries(PROVIDERS)
            .filter(([, provider]) => provider[flag])
            .map(([type]) => type)
            .sort();

    it('shows the project field exactly for visualizations with projects', () => {
        assert.deepEqual(typesIn('project').sort(), withFlag('hasProjects'));
    });

    it('shows the view field exactly for visualizations with views', () => {
        assert.deepEqual(typesIn('view').sort(), withFlag('hasViews'));
    });

    it('has a default in io-package.json for every setting of the page', () => {
        const ioPackage = JSON.parse(readFileSync(join(__dirname, '../../io-package.json'), 'utf8'));
        const attrs = [
            ...Object.keys(schema.items._page.items),
            ...Object.keys(schema.items._live.items),
            ...Object.keys(schema.items._demos.items),
        ].filter(key => !key.startsWith('_'));
        const missing = attrs.filter(attr => !(attr in ioPackage.native));
        assert.deepEqual(missing, []);
    });

    it('has a translation for every label', () => {
        const en = JSON.parse(readFileSync(join(__dirname, '../../admin/i18n/en.json'), 'utf8'));
        const de = JSON.parse(readFileSync(join(__dirname, '../../admin/i18n/de.json'), 'utf8'));
        const texts = new Set();
        const walk = node => {
            if (Array.isArray(node)) {
                node.forEach(walk);
            } else if (node && typeof node === 'object') {
                for (const key of ['label', 'title', 'text', 'help']) {
                    if (typeof node[key] === 'string' && !['title', 'text'].includes(node.attr)) {
                        texts.add(node[key]);
                    }
                }
                Object.values(node).forEach(walk);
            }
        };
        walk(schema);
        const missing = [...texts].filter(key => !(key in en) || !(key in de));
        assert.deepEqual(missing, []);
    });
});
