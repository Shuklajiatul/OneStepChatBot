const cassandra = require('cassandra-driver');
const logger = require('./logger');

/**
 * ScyllaDB (Cassandra) database configuration and connection management
 */

class DatabaseConfig {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    /**
     * Initialize database connection
     * returns {Promise<cassandra.Client>}
     */
    async connect() {
        if (this.isConnected && this.client) {
            return this.client;
        }

        try {
            const contactPoints = process.env.SCYLLA_CONTACT_POINTS
                ? process.env.SCYLLA_CONTACT_POINTS.split(',')
                : ['127.0.0.1'];

            const authProvider = process.env.SCYLLA_USERNAME
                ? new cassandra.auth.PlainTextAuthProvider(
                    process.env.SCYLLA_USERNAME,
                    process.env.SCYLLA_PASSWORD
                )
                : null;

            this.client = new cassandra.Client({
                contactPoints,
                localDataCenter: process.env.SCYLLA_DATACENTER || 'datacenter1',
                keyspace: process.env.SCYLLA_KEYSPACE || 'chatbot_crm',
                authProvider,
                pooling: {
                    coreConnectionsPerHost: {
                        [cassandra.types.distance.local]: 2,
                        [cassandra.types.distance.remote]: 1,
                    },
                },
                queryOptions: {
                    consistency: cassandra.types.consistencies.localQuorum,
                    prepare: true,
                },
                socketOptions: {
                    connectTimeout: 10000,
                    readTimeout: 30000,
                },
            });

            await this.client.connect();
            this.isConnected = true;

            console.log('Successfully connected to ScyllaDB');

            return this.client;
        } catch (error) {
            console.log('Failed to connect to ScyllaDB', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Get database client instance
     * returns {cassandra.Client}
     */
    getClient() {
        if (!this.isConnected || !this.client) {
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.client;
    }

    /**
     * Close database connection
     * returns {Promise<void>}
     */
    async disconnect() {
        if (this.client) {
            await this.client.shutdown();
            this.isConnected = false;
            console.log('Disconnected from ScyllaDB');
        }
    }

    /**
     * Execute a query with parameters
     * param {string} query - CQL query
     * param {Array} params - Query parameters
     * param {Object} options - Query options
     * returns {Promise<Object>}
     */
    async execute(query, params = [], options = {}) {
        try {
            const client = this.getClient();
            const result = await client.execute(query, params, {
                prepare: true,
                ...options,
            });
            return result;
        } catch (error) {
            logger.error('Database query error', {
                query,
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Execute a batch of queries
     * param {Array} queries - Array of query objects {query, params}
     * param {Object} options - Batch options
     * returns {Promise<Object>}
     */
    async batch(queries, options = {}) {
        try {
            const client = this.getClient();
            const result = await client.batch(queries, {
                prepare: true,
                ...options,
            });
            return result;
        } catch (error) {
            logger.error('Database batch error', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Check if database is healthy
     * returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            await this.execute('SELECT now() FROM system.local');
            return true;
        } catch (error) {
            logger.error('Database health check failed', { error: error.message });
            return false;
        }
    }
}

// Export singleton instance
const databaseConfig = new DatabaseConfig();

module.exports = databaseConfig;
