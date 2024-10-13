const createBrowser = require("browserless");
const hash = require("../helpers/hash");
const path = require("path");
const fs = require("node:fs");
const {writeFile} = require("../helpers/file-exception");

/**
 * Take a screenshot of a webpage.
 * @param {string} url - The URL of the webpage.
 * @returns {Promise<[Error|null, null|string]>} - The screenshot buffer.
 */

async function takePageScreenShot(url) {
    const browser = createBrowser({
        timeout: 25000,
        lossyDeviceName: true,
        ignoreHTTPSErrors: true
    })
    const browserless = await browser.createContext({ retry: 2 })
    const buffer = await browserless.screenshot(url);
    await browser.close();
    const urlEncoded = hash.hashString(url, process.env.SECRET_KEY);
    const fileName = `screenshot_${urlEncoded}.png`;
    const filePath = path.join(globalThis.__rootdir, 'storages/screenshots', fileName);
    console.log('File path:', filePath);

    const [writeError] = await writeFile(filePath, new Uint8Array(buffer));
    if (writeError) {
        return [writeError, null];
    }
    const staticFilePath = path.join('storages/screenshots', fileName);
    await browserless.destroyContext();
    await browser.close();
    return [null, staticFilePath];
}

module.exports = takePageScreenShot;