// Common helper functions

// Check if value is empty (null, undefined, empty string, empty array, empty object)
const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

// Deep clone an object
const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

// Sleep for specified milliseconds
const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

// Retry a function with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const backoffDelay = delay * 2 ** i;
                await sleep(backoffDelay);
            }
        }
    }

    throw lastError;
};

// Chunk an array into smaller arrays
const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

// Remove duplicates from array
const removeDuplicates = (array) => {
    return [...new Set(array)];
};

// Pick specific properties from object
const pick = (obj, keys) => {
    return keys.reduce((result, key) => {
        if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
        return result;
    }, {});
};

// Omit specific properties from object
const omit = (obj, keys) => {
    const result = { ...obj };
    keys.forEach((key) => delete result[key]);
    return result;
};

// Sanitize string for safe output
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

// Generate random string
const randomString = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Truncate string to specified length
const truncate = (str, maxLength, suffix = '...') => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
};

// Parse JSON safely
const safeJSONParse = (jsonString, defaultValue = null) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return defaultValue;
    }
};

// Stringify JSON safely
const safeJSONStringify = (value, defaultValue = '{}') => {
    try {
        return JSON.stringify(value);
    } catch (error) {
        return defaultValue;
    }
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Validate phone number (basic)
const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

module.exports = {
    isEmpty,
    deepClone,
    sleep,
    retryWithBackoff,
    chunkArray,
    removeDuplicates,
    pick,
    omit,
    sanitizeString,
    randomString,
    truncate,
    safeJSONParse,
    safeJSONStringify,
    isValidEmail,
    isValidPhone,
};
