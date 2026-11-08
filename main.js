'use strict';
const utils = require('@iobroker/adapter-core');
const { getProjects, getViews, getVisualizations } = require('./lib/providers');
const { buildPage } = require('./lib/page');

const ADAPTER_NAME = 'demo-page';
/** rw-r--r--: The page and its images are for everybody, also if new files are not readable by default */
const PUBLIC_FILE_MODE = 0x644;
/**
 * An upload of the adapter or a new image in the configuration brings files with the default rights of
 * the system. So the rights are not only set at the start.
 */
const RIGHTS_INTERVAL_MS = 10 * 60 * 1000;

class DemoPage extends utils.Adapter {
    /** @param {Partial<utils.AdapterOptions>} [options] */
    constructor(options = {}) {
        super({ ...options, name: ADAPTER_NAME });
        this.rightsTimer = null;
        this.on('ready', () => this.onReady());
        this.on('message', message => this.onMessage(message));
        this.on('unload', callback => this.onUnload(callback));
    }

    async onReady() {
        // The instance restarts when its configuration is saved, so this also publishes every change
        try {
            const page = await buildPage(this, this.config);
            await this.writeFileAsync(this.namespace, 'config.json', JSON.stringify(page));
            const demos = page.sections.reduce((sum, section) => sum + section.demos.length, 0);
            this.log.info(`Published the page with ${demos} demo(s) in ${page.sections.length} section(s)`);
        } catch (error) {
            this.log.error(`Cannot publish the page: ${error.message}`);
        }
        await this.applyPublicRights();
        this.rightsTimer = this.setInterval(() => this.applyPublicRights(), RIGHTS_INTERVAL_MS);
    }

    /** Makes the own files readable for guests. Only own files: other adapters stay as configured. */
    async applyPublicRights() {
        for (const storage of [ADAPTER_NAME, this.namespace]) {
            try {
                const changed = await this.openDirectory(storage, '');
                if (changed) {
                    this.log.info(`Made ${changed} file(s) of "${storage}" readable for guests`);
                }
            } catch (error) {
                this.log.warn(`Cannot set the rights of "${storage}": ${error.message}`);
            }
        }
    }

    /**
     * Goes through the files one by one, as `chmodFile` refuses the root of a storage. It only writes
     * where something is to change, so the regular run costs no writes to the file database.
     *
     * @param {string} storage
     * @param {string} directory
     * @returns {Promise<number>} the number of changed files
     */
    async openDirectory(storage, directory) {
        let changed = 0;
        for (const entry of await this.readDirAsync(storage, directory)) {
            const name = directory ? `${directory}/${entry.file}` : entry.file;
            if (entry.isDir) {
                changed += await this.openDirectory(storage, name);
            } else if (entry.acl?.permissions !== PUBLIC_FILE_MODE) {
                await this.chmodFileAsync(storage, name, { mode: PUBLIC_FILE_MODE });
                changed++;
            }
        }
        return changed;
    }

    /** @param {ioBroker.Message} message */
    async onMessage(message) {
        if (!message?.callback) {
            return;
        }
        const data = message.message || {};
        let result = [];
        try {
            switch (message.command) {
                case 'getVisualizations':
                    result = await getVisualizations(this);
                    break;
                case 'getProjects':
                    result = await getProjects(this, data.type);
                    break;
                case 'getViews':
                    result = await getViews(this, data.type, data.project);
                    break;
                default:
                    this.log.warn(`Unknown command: ${message.command}`);
            }
        } catch (error) {
            this.log.warn(`Cannot process "${message.command}": ${error.message}`);
        }
        this.sendTo(message.from, message.command, result, message.callback);
    }

    /** @param {() => void} callback */
    onUnload(callback) {
        try {
            if (this.rightsTimer) {
                this.clearInterval(this.rightsTimer);
                this.rightsTimer = null;
            }
        } finally {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = options => new DemoPage(options);
} else {
    new DemoPage();
}
