const redis = require("ioredis");

let client = {},
    statusConnectRedis = {
        CONNECT: 'connect',
        END: 'end',
        RECONNECTING: 'reconnecting',
        ERROR: 'error',
    },
    connectedTimeout = null;

const REDIS_CONNECT_TIMEOUT = 10000,
    REDIS_CONNECT_RETRY = 5,
    REDIS_CONNECT_RETRY_DELAY = 1000,
    REDIS_CONNECT_MESSAGE = {
        code: -99,
        message: 'Redis connect timeout',
    };

const handleConnectTimeout = () => {
    connectedTimeout = setTimeout(() => {
        throw new Error(JSON.stringify(REDIS_CONNECT_MESSAGE));
    }, REDIS_CONNECT_TIMEOUT);
};

const retryConnect = (retry) => {
    if (retry <= REDIS_CONNECT_RETRY) {
        setTimeout(() => {
            console.log(`Retry connect to Redis ${retry}`);
            initRedis();
            retryConnect(retry + 1);
        }, REDIS_CONNECT_RETRY_DELAY);
    } else {
        handleConnectTimeout();
    }
};

const handleEventConnect = (instanceRedis) => {
    instanceRedis.on(statusConnectRedis.CONNECT, () => {
        console.log(`Redis is connected`);
        clearTimeout(connectedTimeout);
    });
    instanceRedis.on(statusConnectRedis.END, () => {
        console.log(`Redis is end`);
        handleConnectTimeout();
    });
    instanceRedis.on(statusConnectRedis.RECONNECTING, () => {
        console.log(`Redis is reconnecting`);
    });
    instanceRedis.on(statusConnectRedis.ERROR, (error) => {
        console.log(`Redis is error: ${error}`);
        retryConnect(0);
        // handleConnectTimeout();
    });
};

const initRedis = () => {
    if (client.instanceRedis) {
        console.log('Redis is already connected');
        return;
    }
    const instanceRedis = new redis.Redis({
        enableAutoPipelining: true,
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        // password: process.env.REDIS_PASSWORD,
        // username: process.env.REDIS_USERNAME,
    });
    client.instanceRedis = instanceRedis;
    handleEventConnect(instanceRedis);
};
const getRedis = () => client;
const closeRedis = () => {
    if (client.instanceRedis) {
        console.log('Close Redis');
        client.instanceRedis.disconnect();
    }
};

process.on('exit', function () {
    closeRedis();
});

module.exports = { initRedis, getRedis, closeRedis, retryConnect };
