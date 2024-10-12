const validator = require('validator');

function isValidUrl(string) {
    if (!string) return false;
    return validator.isURL(string, {
        require_protocol: true // optional: enforce protocol
    });
}

function isValidEmail(string) {
    return validator.default.isEmail(string);
}

function isValidUsername(string) {
    return validator.default.isAlphanumeric(string);
}

function isValidPassword(string) {
    return validator.default.isStrongPassword(string);
}

module.exports = {
    isValidUrl,
    isValidEmail,
    isValidUsername,
    isValidPassword,
};