const https = require('https');

/**
 * @typedef {Object} IResolvedValues
 * @property {boolean} valid - Whether the certificate is valid.
 * @property {string} validFrom - The start date of the certificate's validity period.
 * @property {string} validTo - The end date of the certificate's validity period.
 * @property {number} daysRemaining - The number of days remaining until the certificate expires.
 * @property {string[]} [validFor] - An array of domains the certificate is valid for (if `validateSubjectAltName` is true).
 */

/**
 * Checks if a port is valid.
 * @param {unknown} port - The port to check.
 * @returns {boolean} - True if the port is valid, false otherwise.
 */
const checkPort = (port) => !isNaN(parseFloat(port)) && Math.sign(port) === 1;

/**
 * Calculates the number of days between two dates.
 * @param {Date} validFrom - The start date.
 * @param {Date} validTo - The end date.
 * @returns {number} - The number of days between the two dates.
 */
const getDaysBetween = (validFrom, validTo) => Math.round(Math.abs(+validFrom - +validTo) / 8.64e7);

/**
 * Calculates the number of days remaining until a certificate expires.
 * @param {Date} validFrom - The start date of the certificate's validity period.
 * @param {Date} validTo - The end date of the certificate's validity period.
 * @returns {number} - The number of days remaining. Returns a negative number if the certificate has expired.
 */
const getDaysRemaining = (validFrom, validTo) => {
    const daysRemaining = getDaysBetween(validFrom, validTo);
    if (new Date(validTo).getTime() < new Date().getTime()) {
        return -daysRemaining;
    }
    return daysRemaining;
};

/**
 * @typedef {Object} Options
 * @property {boolean} [validateSubjectAltName] - Whether to validate the Subject Alternative Name (SAN) of the certificate.
 */

/**
 * Default options for the SSL checker.
 * @type {Partial<Options>}
 */
const DEFAULT_OPTIONS = {
    agent: new https.Agent({ maxCachedSessions: 0 }),
    method: 'HEAD',
    port: 443,
    rejectUnauthorized: false,
    validateSubjectAltName: false,
};

/**
 * Checks the SSL certificate of a given host.
 * @param {string} host - The hostname to check.
 * @param {Partial<Options>} [options] - Optional parameters.
 * @returns {Promise<IResolvedValues>} - A promise that resolves with information about the SSL certificate.
 */
const sslChecker = (host, options = {}) => {
    return new Promise((resolve, reject) => {
        options = Object.assign({}, DEFAULT_OPTIONS, options);

        if (!checkPort(options.port)) {
            reject(Error("Invalid port"));
            return;
        }

        try {
            const requestOptions = { host, ...options };

            const handleResponse = (res) => {
                let { valid_from, valid_to, subjectaltname } = res.socket.getPeerCertificate();
                res.socket.destroy();

                if (!valid_from || !valid_to) {
                    reject(new Error("No certificate"));
                    return;
                }

                const validTo = new Date(valid_to);
                const resolvedValues = {
                    daysRemaining: getDaysRemaining(new Date(), validTo),
                    valid: res.socket.authorized || false, // Assuming 'authorized' property exists
                    validFrom: new Date(valid_from).toISOString(),
                    validTo: validTo.toISOString(),
                };

                if (options.validateSubjectAltName && subjectaltname) {
                    resolvedValues.validFor = subjectaltname
                        .replace(/DNS:|IP Address:/g, "")
                        .split(", ");
                }

                resolve(resolvedValues);
            };

            const req = options.validateSubjectAltName
                ? https.request(requestOptions, handleResponse)
                : https.request(requestOptions, handleResponse);

            req.on("error", reject);
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Timed Out"));
            });
            req.end();
        } catch (e) {
            reject(e);
        }
    });
};

module.exports = sslChecker;