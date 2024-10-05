const {initRedis} = require("../configs/redis");
const nmap = require("../services/nmap");

const startNmapSubscribe = async () => {
    initRedis();

    const redisInstance = require('../configs/redis').getRedis().instanceRedis;
    redisInstance.subscribe('nmap', (err, count) => {
        if (err) {
            console.log(err);
        }
        console.log(`Subscribed to ${count} channel. Listening for updates on the ${count} channel.`);
    });
    redisInstance.on("message", async (channel, message) => {
        console.log(`Message: ${message} on channel: ${channel}`);
        const data = JSON.parse(message);
        console.log(data);
        if (data.url) {
            const nmap = require("../services/nmap");
            const nmapResults = await nmap(data.url);
            if (nmapResults) {
                redisInstance.publish('nmap', JSON.stringify(nmapResults));
            }
        }
    });
}

module.exports = startNmapSubscribe;