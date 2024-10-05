const dns = require('node:dns');
/**
 * Phân giải hostname thành địa chỉ IP.
 *
 * @param {string} hostname - Hostname cần phân giải.
 * @param {object} [options] - Tùy chọn cho `dns.lookup`.
 * @returns {Promise<{address: string, family: string} | null>} Địa chỉ IP hoặc null nếu có lỗi.
 */
async function resolveHostname(hostname, options = {}) {
    return new Promise((resolve, reject) => {
        dns.lookup(hostname, options, (err, address, family) => {
            if (err) {
                console.error(`Lỗi phân giải DNS cho ${hostname}:`, err);
                resolve(null);
            } else {
                resolve({ address, family });
            }
        });
    });
}

/**
 * Phân giải hostname thành danh sách địa chỉ IPv4.
 *
 * @param {string} hostname - Hostname cần phân giải.
 * @param {object} [options] - Tùy chọn cho `dns.resolve4`.
 * @returns {Promise<string[] | null>} Danh sách địa chỉ IPv4 hoặc null nếu có lỗi.
 */
async function resolve4(hostname, options = {}) {
    return new Promise((resolve, reject) => {
        dns.resolve4(hostname, (err, addresses) => {
            if (err) {
                console.error(`Lỗi phân giải DNS cho ${hostname}:`, err);
                resolve(null);
            } else {
                resolve(addresses);
            }
        });
    });
}

/**
 * Phân giải hostname thành danh sách địa chỉ IPv6.
 *
 * @param {string} hostname - Hostname cần phân giải.
 * @param {object} [options] - Tùy chọn cho `dns.resolve6`.
 * @returns {Promise<string[] | null>} Danh sách địa chỉ IPv6 hoặc null nếu có lỗi.
 */
async function resolve6(hostname, options = {}) {
    return new Promise((resolve, reject) => {
        dns.resolve6(hostname, (err, addresses) => {
            if (err) {
                console.error(`Lỗi phân giải DNS cho ${hostname}:`, err);
                resolve(null);
            } else {
                resolve(addresses);
            }
        });
    });
}

/**
 * Phân giải hostname thành danh sách CNAME.
 * @param hostname
 * @param options
 * @returns {Promise<string[]|null>}
 */

async function resolveCname(hostname, options = {}) {
    return new Promise((resolve, reject) => {
        dns.resolveCname(hostname, (err, addresses) => {
            if (err) {
                console.error(`Lỗi phân giải DNS cho ${hostname}:`, err);
                resolve(null);
            } else {
                resolve(addresses);
            }
        });
    });
}

async function resolveAny(hostname, options = {}) {
    return new Promise((resolve, reject) => {
        dns.resolveAny(hostname, (err, addresses) => {
            if (err) {
                console.error(`Lỗi phân giải DNS cho ${hostname}:`, err);
                resolve(null);
            } else {
                resolve(addresses);
            }
        });
    });
}

async function checkDomainExists(domain) {
    try {
        await dns.promises.lookup(domain);
        return true;
    } catch (error) {
        if (error.code === 'ENOTFOUND') {
            return false;
        }
        throw error;
    }
}

async function test() {
    console.log(await resolveHostname('connectedbrain.com.vn'));
    // console.log(await resolve4('google.com'));
    // console.log(await resolve6('google.com'));
    // console.log(await resolveCname('google.com'));
    // console.log(await resolveAny('connectedbrain.com.vn'));
}
// test()

module.exports = {
    checkDomainExists,
    resolveHostname,
    resolve4,
    resolve6,
    resolveCname,
    resolveAny
};