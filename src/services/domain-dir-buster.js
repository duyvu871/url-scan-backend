const Writable = require('stream').Writable;
const nodeBuster = require('dirbuster');
const {join} = require("node:path");

const domainDirBuster = (url, events, timeout = 60000 * 10) => {
    const options = {
        list: join(globalThis.__rootdir, 'word_lists/directory-list-2.3-big.txt'),
        outStream: new Writable({
            decodeStrings: false,
            objMode: false
        }),
        url: url,
        export: 'json',
        methods: ['GET', 'POST'],
        depth: 2,
        throttle: 5
    };
    options.outStream.on('error', function (err) {
        console.log('err: ', err);
        events.error && events.error(err);
    })

    options.outStream._write = function (chunk, enc, next) {
        // console.logs(chunk.toString('utf8'));
        events.data && events.data(chunk.toString('utf8'));
        next()
    };

    options.outStream.on('finish', function () {
        console.log('ended');
        events.end && events.end();
    });

    if (!globalThis.__dirbusterStream__) {
        globalThis.__dirbusterStream__ = {};
    }
    if (events.clientId) {
        globalThis.__dirbusterStream__[events.clientId] = options.outStream;
    } else {
        setTimeout(() => {
            options.outStream.end();
        }, timeout);
    }

    nodeBuster(options);
}

module.exports = domainDirBuster;