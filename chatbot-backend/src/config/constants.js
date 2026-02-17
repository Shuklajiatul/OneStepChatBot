/**
 * Constants used throughout the application
 */

// Node Types
const NODE_TYPES = {
    MESSAGE: 'message',
    QUESTION: 'question',
    BUTTONS: 'buttons',
    LIST: 'list',
    CONDITION: 'condition',
    WEBHOOK: 'webhook',
    DELAY: 'delay',
    END: 'end',
};

// Message Types
const MESSAGE_TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    INTERACTIVE: 'interactive',
    LOCATION: 'location',
    CONTACTS: 'contacts',
    REACTION: 'reaction',
};

// Conversation Status
const CONVERSATION_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    ABANDONED: 'abandoned',
    HUMAN_TAKEOVER: 'human_takeover',
};

// Flow Status
const FLOW_STATUS = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    ARCHIVED: 'archived',
};

// Message Sender
const MESSAGE_SENDER = {
    BOT: 'bot',
    USER: 'user',
    SYSTEM: 'system',
};

// Delivery Status
const DELIVERY_STATUS = {
    PENDING: 'pending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    FAILED: 'failed',
};

// Channels
const CHANNELS = {
    WHATSAPP: 'whatsapp',
    INSTAGRAM: 'instagram',
    WEB: 'web',
    PREVIEW: 'preview',
};

// User Plans
const USER_PLANS = {
    FREE: 'free',
    STARTER: 'starter',
    PROFESSIONAL: 'professional',
    ENTERPRISE: 'enterprise',
};

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

// Error Codes
const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    CONFLICT: 'CONFLICT',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// Webhook Event Types
const WEBHOOK_EVENTS = {
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_STATUS: 'message_status',
    CONVERSATION_STARTED: 'conversation_started',
    CONVERSATION_ENDED: 'conversation_ended',
};

// Job Queue Names
const QUEUE_NAMES = {
    MESSAGE_PROCESSING: 'message-processing',
    WEBHOOK_RETRY: 'webhook-retry',
    ANALYTICS_AGGREGATION: 'analytics-aggregation',
};

// Default Values
const DEFAULTS = {
    PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    WEBHOOK_TIMEOUT: 30000,
    WEBHOOK_MAX_RETRIES: 3,
    MESSAGE_RETRY_DELAY: 5000,
    SESSION_TIMEOUT: 3600000, // 1 hour
    MAX_BUTTONS: 3,
    MAX_LIST_ITEMS: 10,
};

module.exports = {
    NODE_TYPES,
    MESSAGE_TYPES,
    CONVERSATION_STATUS,
    FLOW_STATUS,
    MESSAGE_SENDER,
    DELIVERY_STATUS,
    CHANNELS,
    USER_PLANS,
    HTTP_STATUS,
    ERROR_CODES,
    WEBHOOK_EVENTS,
    QUEUE_NAMES,
    DEFAULTS,
};
