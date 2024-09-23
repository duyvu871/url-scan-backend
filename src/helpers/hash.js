const crypto = require('crypto');
const bcrypt = require('bcrypt');


function decryptString(encryptedText, secretKey) {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}

function encryptString(text, secretKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}


function hashString(stringToHash) {
    try {
        return crypto.createHash('sha256').update(stringToHash).digest('hex')
    } catch (error) {
        console.error("Lỗi khi hash chuỗi:", error);
        throw error;
    }
}

module.exports = {
    hashString,
    decryptString,
    encryptString,
};