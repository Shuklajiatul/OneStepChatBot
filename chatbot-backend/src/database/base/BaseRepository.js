const databaseConfig = require('../../config/database');
const logger = require('../../config/logger');
const { generateUUID } = require('../../utils/uuid');
const { now } = require('../../utils/dateTime');
const { DatabaseError, NotFoundError } = require('../../utils/errors');

/**
 * Base Repository class for database operations
 * Provides common CRUD operations for all repositories
 */
class BaseRepository {

    constructor(tableName) {
        this.tableName = tableName;
        this.db = databaseConfig;
    }

    /**
     * Create a new record
     */
    async create(data, generateId = true) {
        try {
            const timestamp = now();
            const record = {
                ...data,
                // created_at: timestamp,
                // updated_at: timestamp,
            };

            // Generate UUID for primary key if needed
            if (generateId && !record[this.getPrimaryKey()]) {
                record[this.getPrimaryKey()] = generateUUID();
            }

            const columns = Object.keys(record);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((col) => record[col]);

            const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `;

            await this.db.execute(query, values);

            global.slashLogs(`Record created in ${this.tableName}`, true, true);

            return record;

        } catch (error) {

            global.slashLogs(`Error creating record in ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to create record in ${this.tableName}`, error);
        }
    }

    /**
     * Find record by primary key
     */
    async findById(id) {
        try {
            const query = `SELECT * FROM ${this.tableName} WHERE ${this.getPrimaryKey()} = ?`;
            const result = await this.db.execute(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            global.slashLogs(`Record found in ${this.tableName}`, true, true);
            return this.mapRow(result.rows[0]);
        } catch (error) {
            global.slashLogs(`Error finding record by ID in ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to find record in ${this.tableName}`, error);
        }
    }

    /**
     * Find one record by conditions
     */
    async findOne(conditions) {
        try {
            const { whereClause, values } = this.buildWhereClause(conditions);
            const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;

            const result = await this.db.execute(query, values);

            if (result.rows.length === 0) {
                return null;
            }
            
            global.slashLogs(`Record found in ${this.tableName}`, true, true);
            return this.mapRow(result.rows[0]);
        } catch (error) {
            global.slashLogs(`Error finding one record in ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to find record in ${this.tableName}`, error);
        }
    }

    /**
     * Find multiple records
     */
    async findMany(conditions = {}, limit = 100, offset = 0) {
        try {
            const { whereClause, values } = this.buildWhereClause(conditions);
            let query = `SELECT * FROM ${this.tableName} ${whereClause}`;

            if (limit) {
                query += ` LIMIT ${limit}`;
            }

            const result = await this.db.execute(query, values);
            return result.rows.map((row) => this.mapRow(row));
        } catch (error) {
            global.slashLogs(`Error finding records in ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to find records in ${this.tableName}`, error);
        }
    }

    /**
     * Update a record by primary key
     */
    async update(id, data) {
        try {
            // Check if record exists
            const existing = await this.findById(id);
            if (!existing) {
                throw new NotFoundError(this.tableName, id);
            }

            const updateData = { ...data };
            
            // Only add updated_at if the table has this column
            if (existing.hasOwnProperty('updated_at')) {
                updateData.updated_at = now();
            }

            const setClauses = [];
            const values = [];

            Object.keys(updateData).forEach((key) => {
                if (key !== this.getPrimaryKey()) {
                    setClauses.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });

            values.push(id);

            const query = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE ${this.getPrimaryKey()} = ?
      `;

            await this.db.execute(query, values);

            global.slashLogs(`Record updated in ${this.tableName}`, true, true);

            // Return updated record
            return this.findById(id);
        } catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            global.slashLogs(`Error updating record in ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to update record in ${this.tableName}`, error);
        }
    }

    /**
     * Delete a record by primary key
     */
    async delete(id) {
        try {
            // Check if record exists
            const existing = await this.findById(id);
            if (!existing) {
                global.slashLogs(`Record not found in ${this.tableName}: ${id}`, true, true);
                throw new NotFoundError(this.tableName, id);
            }

            const query = `DELETE FROM ${this.tableName} WHERE ${this.getPrimaryKey()} = ?`;
            await this.db.execute(query, [id]);

            global.slashLogs(`Record deleted from ${this.tableName}: ${id}`, true, true);
            return true;
        } catch (error) {
            if (error instanceof NotFoundError) {
                global.slashLogs(`Record not found in ${this.tableName}: ${id}`, true, true);
                throw error;
            }
            global.slashLogs(`Error deleting record from ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to delete record from ${this.tableName}`, error);
        }
    }

    /**
     * Batch insert multiple records
     */
    async batchInsert(records) {
        try {
            const timestamp = now();
            const queries = [];

            const processedRecords = records.map((data) => {
                const record = {
                    ...data,
                    created_at: timestamp,
                    updated_at: timestamp,
                };

                if (!record[this.getPrimaryKey()]) {
                    record[this.getPrimaryKey()] = generateUUID();
                }

                const columns = Object.keys(record);
                const placeholders = columns.map(() => '?').join(', ');
                const values = columns.map((col) => record[col]);

                queries.push({
                    query: `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                    params: values,
                });

                return record;
            });

            await this.db.batch(queries);

            global.slashLogs(`Batch inserted ${records.length} records into ${this.tableName}`, true, true);
            return processedRecords;
        } catch (error) {
            global.slashLogs(`Error batch inserting records into ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to batch insert records into ${this.tableName}`, error);
        }
    }

    /**
     * Execute a raw query
     */
    async executeQuery(query, params = []) {
        try {
            const result = await this.db.execute(query, params);
            return result;
        } catch (error) {
            global.slashLogs(`Error executing query on ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to execute query on ${this.tableName}`, error);
        }
    }

    /**
     * Count records matching conditions
     */
    async count(conditions = {}) {
        try {
            const { whereClause, values } = this.buildWhereClause(conditions);
            const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;

            const result = await this.db.execute(query, values);
            return parseInt(result.rows[0].count, 10);
        } catch (error) {
            global.slashLogs(`Error counting records in ${this.tableName}: ${error.message}`, true, true);
            throw new DatabaseError(`Failed to count records in ${this.tableName}`, error);
        }
    }

    /**
     * Build WHERE clause from conditions object
     */
    buildWhereClause(conditions) {
        if (!conditions || Object.keys(conditions).length === 0) {
            return { whereClause: '', values: [] };
        }

        const clauses = [];
        const values = [];

        Object.keys(conditions).forEach((key) => {
            clauses.push(`${key} = ?`);
            values.push(conditions[key]);
        });

        return {
            whereClause: `WHERE ${clauses.join(' AND ')}`,
            values,
        };
    }

    /**
     * Map database row to object
     */
    mapRow(row) {
        return { ...row };
    }

    /**
     * Get primary key column name
     */
    getPrimaryKey() {
        return 'id';
    }
}

module.exports = BaseRepository;
