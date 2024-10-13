const AsyncMiddleware = require("../helpers/async-wrapper");
const cache = require("../services/cache");

const processLookup = AsyncMiddleware.asyncHandler(async (req, res, next) => {
    if (!req.body.clientId) return res.status(200).send({error: 'clientId is not provided'}).end();
    try {
        const cacheData = require('../services/db/scan').getOne({clientId: req.body.clientId});
        // console.logs(cacheData);
        if (!cacheData) return res.status(404).send({error: 'Client not found'}).end();
        req.cacheData = cacheData;
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).send({error: 'Internal server error'}).end();
    }
});

module.exports = {
    processLookup
}