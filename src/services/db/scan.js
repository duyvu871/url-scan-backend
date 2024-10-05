const scanModel = require('../../models/scan');

async function getHeaders(clientId) {
    return await scanModel.findOne({clientId}).lean().exec();
}

