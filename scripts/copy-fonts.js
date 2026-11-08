'use strict';
// Copies the self-hosted web fonts from the @fontsource packages to www/fonts.
// They are committed, so that the public page never has to load fonts from Google (GDPR).
const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const target = join(__dirname, '..', 'www', 'fonts');
mkdirSync(target, { recursive: true });

// Must match the @font-face rules in www/style.css. Headings only need the Latin subset.
const files = [
    ['audiowide', 'latin', 400],
    ['audiowide', 'latin-ext', 400],
    ['roboto', 'latin', 400],
    ['roboto', 'latin-ext', 400],
    ['roboto', 'latin', 500],
    ['roboto', 'latin', 700],
    ['roboto', 'latin', 900],
];
for (const [family, subset, weight] of files) {
    const file = `${family}-${subset}-${weight}-normal.woff2`;
    copyFileSync(join(__dirname, '..', 'node_modules', '@fontsource', family, 'files', file), join(target, file));
}
