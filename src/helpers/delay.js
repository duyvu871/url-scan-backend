module.exports = function timeout(delay, cb = () => {}) {
    return new Promise(resolve => setTimeout(resolve, delay)).then(cb);
}