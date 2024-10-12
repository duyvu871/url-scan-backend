const ipGeoTest = require('../src/services/ip-geo');

async function testIPGeo() {
    const ip = '118.69.84.237';
    const reloadConf = await ipGeoTest.reloadConf();
    console.log('Reload Conf:', reloadConf);
    const ipInfo = await ipGeoTest.getIPInfo(ip);
    console.log('IP Info:', ipInfo);
    const asnInfo = await ipGeoTest.getASNInfo(ip);
    console.log('ASN Info:', asnInfo);
}

testIPGeo();