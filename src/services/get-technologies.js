const cache = require("./cache");
const getHTML = require("html-get");
const Wrappalyzer = require("simple-wappalyzer");

async function getTechnologies(url){
    const searchedCache = cache.get(`tech_list:${url}`);
    if (searchedCache) return searchedCache;

    const htmlPage = await getHTML(url, {
        getBrowserless: require("browserless"),
    });
    const wappalyzer = await Wrappalyzer({
        url: htmlPage.url,
        html: htmlPage.html,
        statusCode: htmlPage.statusCode,
        headers: htmlPage.headers,
    });

    if (wappalyzer) {
        cache.set(`tech_list:${url}`, wappalyzer, 60000 * 60); // 1 hour
        return wappalyzer;
    }

    return null;
}

module.exports = getTechnologies;