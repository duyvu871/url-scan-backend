const ipLocation = require('ip-location-api');
const path = require('path');
const fs = require('fs');
const maxmind =  require('maxmind')

async function reloadConf() {
    return await ipLocation.reload({
        fields: 'all',
    })
}

async function getIPInfo(ip) {
    await reloadConf();
    const result = await ipLocation.lookup(ip);
    // console.logs(result);
    // ipLocation.watchDb();
    console.log(result)
    return result;
}

async function getASNInfo(ip) {
    const dbPath = path.posix.join(process.cwd(), 'ip-geo/country_asn.mmdb');
    console.log(dbPath)
    const db = await maxmind.open(dbPath);
    const result = await db.get(ip);
    console.log(result);
    return result;
}

module.exports = {
    getASNInfo,
    reloadConf,
    getIPInfo
};