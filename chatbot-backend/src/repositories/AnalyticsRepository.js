const databaseConfig = require('../config/database');
const logger = require('../config/logger');
const { startOfDay } = require('../utils/dateTime');

/**
 * Analytics Repository
 * Handles analytics data storage and retrieval using counter columns
 */
class AnalyticsRepository {
    constructor() {
        this.tableName = 'flow_analytics';
        this.db = databaseConfig;
    }

    // Increment a metric for a flow
    
    async incrementMetric(flowId, metricName, incrementBy = 1) {
        try {
            const date = startOfDay(new Date());

            const query = `
        UPDATE ${this.tableName}
        SET metric_value = metric_value + ?
        WHERE flow_id = ? AND date = ? AND metric_name = ?
      `;

            await this.db.execute(query, [incrementBy, flowId, date, metricName]);

            global.slashLogs("Metric incremented", true, true);
        } catch (error) {
            global.slashLogs("Error incrementing metric", true, true);
        }
    }

    // Get metrics for a flow on a specific date
    async getMetricsByDate(flowId, date) {
        try {
            const dayStart = startOfDay(date);

            const query = `
        SELECT metric_name, metric_value 
        FROM ${this.tableName}
        WHERE flow_id = ? AND date = ?
      `;

            const result = await this.db.execute(query, [flowId, dayStart]);

            const metrics = {};
            result.rows.forEach((row) => {
                metrics[row.metric_name] = parseInt(row.metric_value, 10);
            });

            return metrics;
        } catch (error) {
            global.slashLogs("Error getting metrics by date", true, true);
            return {};
        }
    }

    /**
     * Get metrics for a flow over a date range
     * param {string} flowId - Flow ID
     * param {Date} startDate - Start date
     * param {Date} endDate - End date
     * returns {Promise<Array>} Array of daily metrics
     */
    async getMetricsRange(flowId, startDate, endDate) {
        try {
            const start = startOfDay(startDate);
            const end = startOfDay(endDate);

            const query = `
        SELECT date, metric_name, metric_value 
        FROM ${this.tableName}
        WHERE flow_id = ? AND date >= ? AND date <= ?
      `;

            const result = await this.db.execute(query, [flowId, start, end]);

            // Group by date
            const metricsByDate = {};

            result.rows.forEach((row) => {
                const dateKey = row.date.toISOString().split('T')[0];

                if (!metricsByDate[dateKey]) {
                    metricsByDate[dateKey] = {
                        date: dateKey,
                        metrics: {},
                    };
                }

                metricsByDate[dateKey].metrics[row.metric_name] = parseInt(row.metric_value, 10);
            });

            return Object.values(metricsByDate);
        } catch (error) {
            global.slashLogs(`Error getting metrics range ${error.message}`, true, true);
            return [];
        }
    }

    /**
     * Track conversation started
     */
    async trackConversationStarted(flowId) {
        await this.incrementMetric(flowId, 'conversations_started');
    }

    /**
     * Track conversation completed
     */
    async trackConversationCompleted(flowId) {
        await this.incrementMetric(flowId, 'conversations_completed');
    }

    /**
     * Track conversation abandoned
     */
    async trackConversationAbandoned(flowId) {
        await this.incrementMetric(flowId, 'conversations_abandoned');
    }

    
    //Track message sent
      
    async trackMessageSent(flowId) {
        await this.incrementMetric(flowId, 'messages_sent');
    }

    
    // Track message received
    
    async trackMessageReceived(flowId) {
        await this.incrementMetric(flowId, 'messages_received');
    }

    // Track node visited
    
    async trackNodeVisited(flowId, nodeId) {
        await this.incrementMetric(flowId, `node_visited_${nodeId}`);
    }

    // Get summary metrics for a flow
   
    async getSummaryMetrics(flowId, days = 30) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const metricsRange = await this.getMetricsRange(flowId, startDate, endDate);

            // Aggregate metrics
            const summary = {
                conversations_started: 0,
                conversations_completed: 0,
                conversations_abandoned: 0,
                messages_sent: 0,
                messages_received: 0,
                completion_rate: 0,
            };

            metricsRange.forEach((day) => {
                Object.keys(day.metrics).forEach((metricName) => {
                    if (summary.hasOwnProperty(metricName)) {
                        summary[metricName] += day.metrics[metricName];
                    }
                });
            });

            // Calculate completion rate
            if (summary.conversations_started > 0) {
                summary.completion_rate = (
                    (summary.conversations_completed / summary.conversations_started) *
                    100
                ).toFixed(2);
            }

            return summary;
        } catch (error) {
            global.slashLogs(`Error getting summary metrics ${error.message}`, true, true);
            return {};
        }
    }
}

module.exports = AnalyticsRepository;
