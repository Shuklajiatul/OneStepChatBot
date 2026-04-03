const databaseConfig = require('../config/database');
const logger = require('../config/logger');

/**
 * ScyllaDB Schema Creation Script
 * Creates all required tables and indexes for the chatbot platform
 */

const KEYSPACE = process.env.SCYLLA_KEYSPACE || 'chatbot_crm';

/**
 * Create keyspace if it doesn't exist
 */
const createKeyspace = async () => {
    const query = `
    CREATE KEYSPACE IF NOT EXISTS ${KEYSPACE}
    WITH REPLICATION = {
      'class': 'NetworkTopologyStrategy',
      'datacenter1': 3
    }
    AND DURABLE_WRITES = true;
  `;

    try {
        // Connect without keyspace first
        const tempClient = databaseConfig.client;
        await tempClient.execute(query);
        logger.info(`Keyspace ${KEYSPACE} created or already exists`);
    } catch (error) {
        logger.error('Error creating keyspace', { error: error.message });
        throw error;
    }
};

/**
 * Create all tables
 */
const createTables = async () => {
    const tables = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
      user_id UUID PRIMARY KEY,
      email TEXT,
      password_hash TEXT,
      company_name TEXT,
      whatsapp_api_key TEXT,
      whatsapp_phone_number_id TEXT,
      whatsapp_business_account_id TEXT,
      instagram_access_token TEXT,
      instagram_page_id TEXT,
      plan TEXT,
      plan_expires_at TIMESTAMP,
      total_flows INT,
      total_conversations INT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    );`,

        // Flows table
        `CREATE TABLE IF NOT EXISTS flows (
      flow_id UUID PRIMARY KEY,
      user_id UUID,
      flow_name TEXT,
      flow_description TEXT,
      flow_data TEXT,
      channel TEXT,
      whatsapp_number TEXT,
      instagram_username TEXT,
      webhook_url TEXT,
      status TEXT,
      is_published BOOLEAN,
      total_conversations INT,
      total_messages INT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      published_at TIMESTAMP
    );`,

        // Conversations table
        `CREATE TABLE IF NOT EXISTS conversations (
      conversation_id UUID PRIMARY KEY,
      flow_id UUID,
      user_phone TEXT,
      user_name TEXT,
      platform_user_id TEXT,
      current_node_id UUID,
      session_data TEXT,
      status TEXT,
      channel TEXT,
      started_at TIMESTAMP,
      last_message_at TIMESTAMP,
      completed_at TIMESTAMP
    );`,

        // Messages table
        `CREATE TABLE IF NOT EXISTS messages (
      message_id UUID PRIMARY KEY,
      conversation_id UUID,
      flow_id UUID,
      sender TEXT,
      message_type TEXT,
      message_text TEXT,
      message_data TEXT,
      node_id UUID,
      whatsapp_message_id TEXT,
      delivery_status TEXT,
      timestamp TIMESTAMP
    );`,

        // Messages by conversation (for efficient querying)
        `CREATE TABLE IF NOT EXISTS messages_by_conversation (
      conversation_id UUID,
      timestamp TIMESTAMP,
      message_id UUID,
      sender TEXT,
      message_text TEXT,
      message_type TEXT,
      PRIMARY KEY (conversation_id, timestamp)
    ) WITH CLUSTERING ORDER BY (timestamp DESC);`,

        // Collected data table
        `CREATE TABLE IF NOT EXISTS collected_data (
      conversation_id UUID,
      variable_name TEXT,
      variable_value TEXT,
      collected_at TIMESTAMP,
      node_id UUID,
      PRIMARY KEY (conversation_id, variable_name)
    );`,

        // Analytics table
        `CREATE TABLE IF NOT EXISTS flow_analytics (
      flow_id UUID,
      date DATE,
      metric_name TEXT,
      metric_value COUNTER,
      PRIMARY KEY ((flow_id, date), metric_name)
    );`,

        // Media assets table (self-hosted media for flow nodes)
        `CREATE TABLE IF NOT EXISTS media_assets (
      media_id   UUID PRIMARY KEY,
      user_id    UUID,
      file_name  TEXT,
      mime_type  TEXT,
      file_size  INT,
      file_data  BLOB,
      created_at TIMESTAMP
    );`,
    ];

    for (const tableQuery of tables) {
        try {
            await databaseConfig.execute(tableQuery);
            logger.info('Table created successfully');
        } catch (error) {
            logger.error('Error creating table', {
                error: error.message,
                query: tableQuery.substring(0, 100),
            });
            throw error;
        }
    }
};

/**
 * Create indexes
 */
const createIndexes = async () => {
    const indexes = [
        // User indexes
        'CREATE INDEX IF NOT EXISTS users_by_email ON users (email);',

        // Flow indexes
        'CREATE INDEX IF NOT EXISTS flows_by_user ON flows (user_id);',
        'CREATE INDEX IF NOT EXISTS flows_by_whatsapp ON flows (whatsapp_number);',
        'CREATE INDEX IF NOT EXISTS flows_by_status ON flows (status);',

        // Conversation indexes
        'CREATE INDEX IF NOT EXISTS conversations_by_phone ON conversations (user_phone);',
        'CREATE INDEX IF NOT EXISTS conversations_by_flow ON conversations (flow_id);',
        'CREATE INDEX IF NOT EXISTS conversations_by_status ON conversations (status);',

        // Message indexes
        'CREATE INDEX IF NOT EXISTS messages_by_flow ON messages (flow_id);',
        'CREATE INDEX IF NOT EXISTS messages_by_conversation ON messages (conversation_id);',

        // Media indexes
        'CREATE INDEX IF NOT EXISTS media_by_user ON media_assets (user_id);',
    ];

    for (const indexQuery of indexes) {
        try {
            await databaseConfig.execute(indexQuery);
            logger.info('Index created successfully');
        } catch (error) {
            logger.error('Error creating index', {
                error: error.message,
                query: indexQuery,
            });
            // Continue even if index creation fails (might already exist)
        }
    }
};

/**
 * Main schema initialization function
 */
const initializeSchema = async () => {
    try {
        logger.info('Starting database schema initialization...');

        // Connect to database
        await databaseConfig.connect();

        // Create keyspace
        await createKeyspace();

        // Create tables
        logger.info('Creating tables...');
        await createTables();

        // Create indexes
        logger.info('Creating indexes...');
        await createIndexes();

        logger.info('Database schema initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize database schema', {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
};

// Run if executed directly
if (require.main === module) {
    initializeSchema()
        .then(() => {
            logger.info('Schema creation completed');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Schema creation failed', { error: error.message });
            process.exit(1);
        });
}

module.exports = { initializeSchema, createKeyspace, createTables, createIndexes };
