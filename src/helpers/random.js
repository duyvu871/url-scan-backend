const crypto = require('crypto');

function getRandomInt(min, max) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const randomNumber = randomBuffer[0] / (0xFFFFFFFF + 1);
    return Math.floor(randomNumber * (max - min + 1)) + min;
}

function getRandomString(length) {
    const randomBytes = crypto.randomBytes(length);
    return randomBytes.toString('hex');
}

module.exports = {
    getRandomInt,
    getRandomString,
};