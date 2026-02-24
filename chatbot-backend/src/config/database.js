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

     // Initialize database connection
     
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

            global.slashLogs('Successfully connected to ScyllaDB', true, true);

            return this.client;
        } catch (error) {
            global.slashLogs(`Failed to connect to ScyllaDB ${error.message}`, true, true);
            throw error;
        }
    }

     // Get database client instance
     
    getClient() {
        if (!this.isConnected || !this.client) {
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.client;
    }

    // Close database connection
    async disconnect() {
        if (this.client) {
            await this.client.shutdown();
            this.isConnected = false;
            console.log('Disconnected from ScyllaDB');
        }
    }

    // Execute a query with parameters
    async execute(query, params = [], options = {}) {
        try {
            const client = this.getClient();
            const result = await client.execute(query, params, {
                prepare: true,
                ...options,
            });
            return result;
        } catch (error) {
            global.slashLogs(`Database query error ${error.message} for query ${query} and params ${params}`, true, true);
            throw error;
        }
    }

    /**
     * Execute a batch of queries
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
            global.slashLogs(`Database batch error ${error.message}`, true, true);
            throw error;
        }
    }

    /**
     * Check if database is healthy
     */
    async healthCheck() {
        try {
            await this.execute('SELECT now() FROM system.local');
            return true;
        } catch (error) {
            global.slashLogs(`Database health check failed ${error.message}`, true, true);
            return false;
        }
    }
}

// Export singleton instance
const databaseConfig = new DatabaseConfig();

module.exports = databaseConfig;
