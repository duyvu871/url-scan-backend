const mongoose = require('mongoose');
const path = require("node:path");

const headersSchema = new mongoose.Schema({
    _id: false,
    url: {type: String, required: true},
    ip: {type: String, default: null},
    headers: {type: String, default: null},
    screenshot: {type: String, default: null},
    dirBuster: {type: String, default: null},
    clientId: {type: String, required: true, unique: true},
}, {
    timestamps: true,
    collection: 'headers-scan',
});

// headersSchema.pre('save', function (next) {
//     this.dirBuster = path.posix.join(process.cwd(), 'storages/dirbuster', `${this.clientId}.txt`);
//     this.screenshot = path.posix.join(process.cwd(), 'storages/screenshots', `screenshot_${this.clientId}.png`);
//     next();
// });

module.exports = mongoose.model('HeadersScan', headersSchema);