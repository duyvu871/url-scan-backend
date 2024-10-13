const scanModel = require('../../models/scan');

function getOne(any = {}) {
    return scanModel.findOne(any);
}

/**
 * Get headers
 * @param any
 * @param projection
 */

async function get(any = {}, projection = {}) {
    return await scanModel.findOne(any, projection).lean().exec();
}

/**
 * Create headers
 * @param {string} clientId
 * @param {Record<string, any>} headers
 */

async function create(clientId, headers) {
    return await scanModel.updateOne({clientId}, headers, {upsert: true}).exec();
}

async function update(clientId, headers) {
    return await scanModel.updateOne({clientId}, headers).exec();
}

module.exports = {
    getOne,
    get,
    create,
    update
};

