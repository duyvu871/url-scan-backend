const mongoose = require('mongoose');
const path = require("node:path");

const headersSchema = new mongoose.Schema({
    _id: false,
    clientId: {type: String, required: true, unique: true},
    url: {type: String, required: true},
    ips: [{
        ip: [{type: String, default: null}],
        family: {type: String, default: null},
    }],
    geo: {
        country: {type: String, default: null},
        city: {type: String, default: null},
        region1: {type: String, default: null},
        region1_name: {type: String, default: null},
        region2: {type: String, default: null},
        region2_name: {type: String, default: null},
        timezone: {type: String, default: null},
        latitude: {type: Number, default: null},
        longitude: {type: Number, default: null},
        eu: {type: Number, default: null},
        area: {type: Number, default: null},
    },
    asn: {
        as_domain: {type: String, default: null},
        as_name: {type: String, default: null},
        asn: {type: String, default: null},
        continent: {type: String, default: null},
        continent_name: {type: String, default: null},
        country: {type: String, default: null},
        country_name: {type: String, default: null},
    },
    status: {type: String, default: null},
    timestamp: {type: Number, default: null},
    technology: {type: String, default: null},
    headers: {type: String, default: null},
    nmap: {type: String, default: null},
    headerChecks: {type: Object, default: null},
    screenshot: {type: String, default: null},
    dirBuster: {type: String, default: null},
}, {
    timestamps: true,
    collection: 'headers-scan',
});

// headersSchema.pre('save', function (next) {
//     this.dirBuster = path.posix.join(process.cwd(), 'storages/dirbuster', `${this.clientId}.txt`);
//     this.screenshot = path.posix.join(process.cwd(), 'storages/screenshots', `screenshot_${this.clientId}.png`);
//     next();
// });

module.exports = mongoose.model('HeadersScan', headersSchema, 'headers-scan');