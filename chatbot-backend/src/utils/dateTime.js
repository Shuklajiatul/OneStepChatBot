

// Get current timestamp
const now = () => {
    return new Date();
};

// Get current timestamp in milliseconds
const nowMs = () => {
    return Date.now();
};

// Add days to a date
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// Add hours to a date
const addHours = (date, hours) => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
};

// Add minutes to a date
const addMinutes = (date, minutes) => {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
};

// Check if a date is in the past
const isPast = (date) => {
    return date < new Date();
};

// Check if a date is in the future
const isFuture = (date) => {
    return date > new Date();
};

// Format date to ISO string
const toISOString = (date) => {
    return date.toISOString();
};

// Get start of day
const startOfDay = (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
};

// Get end of day
const endOfDay = (date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
};

// Get difference in milliseconds between two dates
const diffInMs = (date1, date2) => {
    return Math.abs(date1.getTime() - date2.getTime());
};

// Get difference in seconds between two dates
const diffInSeconds = (date1, date2) => {
    return Math.floor(diffInMs(date1, date2) / 1000);
};

// Get difference in minutes between two dates
const diffInMinutes = (date1, date2) => {
    return Math.floor(diffInMs(date1, date2) / (1000 * 60));
};

// Parse ISO string to Date
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
