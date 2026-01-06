/**
 * Date and time utility functions
 */

/**
 * Get current timestamp
 * @returns {Date}
 */
const now = () => {
    return new Date();
};

/**
 * Get current timestamp in milliseconds
 * @returns {number}
 */
const nowMs = () => {
    return Date.now();
};

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date}
 */
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

/**
 * Add hours to a date
 * @param {Date} date - Base date
 * @param {number} hours - Number of hours to add
 * @returns {Date}
 */
const addHours = (date, hours) => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
};

/**
 * Add minutes to a date
 * @param {Date} date - Base date
 * @param {number} minutes - Number of minutes to add
 * @returns {Date}
 */
const addMinutes = (date, minutes) => {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
};

/**
 * Check if a date is in the past
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
const isPast = (date) => {
    return date < new Date();
};

/**
 * Check if a date is in the future
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
const isFuture = (date) => {
    return date > new Date();
};

/**
 * Format date to ISO string
 * @param {Date} date - Date to format
 * @returns {string}
 */
const toISOString = (date) => {
    return date.toISOString();
};

/**
 * Get start of day
 * @param {Date} date - Date
 * @returns {Date}
 */
const startOfDay = (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
};

/**
 * Get end of day
 * @param {Date} date - Date
 * @returns {Date}
 */
const endOfDay = (date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
};

/**
 * Get difference in milliseconds between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number}
 */
const diffInMs = (date1, date2) => {
    return Math.abs(date1.getTime() - date2.getTime());
};

/**
 * Get difference in seconds between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number}
 */
const diffInSeconds = (date1, date2) => {
    return Math.floor(diffInMs(date1, date2) / 1000);
};

/**
 * Get difference in minutes between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number}
 */
const diffInMinutes = (date1, date2) => {
    return Math.floor(diffInMs(date1, date2) / (1000 * 60));
};

/**
 * Parse ISO string to Date
 * @param {string} isoString - ISO date string
 * @returns {Date}
 */
const parseISO = (isoString) => {
    return new Date(isoString);
};

module.exports = {
    now,
    nowMs,
    addDays,
    addHours,
    addMinutes,
    isPast,
    isFuture,
    toISOString,
    startOfDay,
    endOfDay,
    diffInMs,
    diffInSeconds,
    diffInMinutes,
    parseISO,
};
