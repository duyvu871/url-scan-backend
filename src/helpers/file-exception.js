const fs = require('fs').promises;

async function writeFile(filePath, buffer, res) {
    try {
        await fs.writeFile(filePath, new Uint8Array(buffer));
        return [null, null];
    } catch (err) {
        console.error('Error when save file:', err);
        return [err, null];
    }
}

async function readFile(filePath, options) {
    try {
        return [null, await fs.readFile(filePath, options)];
    } catch (err) {
        console.error('Error when read file:', err);
        return [err, null];
    }
}
module.exports = {
    readFile,
    writeFile,
};