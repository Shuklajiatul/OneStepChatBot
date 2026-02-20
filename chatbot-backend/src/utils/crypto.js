const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

const hashPassword = async (password) => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

// Compare password with hash
const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

// Generate a random token

const generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

const generateNumericCode = (length = 6) => {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

const encrypt = (text, key) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
};

const decrypt = (encryptedText, key) => {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// Create SHA256 hash

const createHash = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    generateNumericCode,
    encrypt,
    decrypt,
    createHash,
};
