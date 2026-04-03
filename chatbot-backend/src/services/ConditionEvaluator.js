const logger = require('../config/logger');
const { parseSessionData } = require('../models/Conversation');

class ConditionEvaluator {
    
    // Evaluate a condition

    static evaluate(condition, conversation) {
        try {
            const sessionData = parseSessionData(conversation);
            const variableValue = this.getVariableValue(sessionData, condition.variable);

            return this.compareValues(variableValue, condition.operator, condition.value);
        } catch (error) {
            global.slashLogs(`Error evaluating condition ${error.message}`, true, true);
            return false;
        }
    }

    // Evaluate multiple conditions and return the first matching next node
    static evaluateConditions(conditions, defaultNext, conversation) {
        for (const condition of conditions) {
            if (this.evaluate(condition, conversation)) {
                return condition.next;
            }
        }

        return defaultNext;
    }

    // Get variable value from session data
    static getVariableValue(sessionData, variableName) {
        const parts = variableName.split('.');
        let value = sessionData;

        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }

        return value;
    }

    // Compare two values using an operator
    static compareValues(leftValue, operator, rightValue) {
        // Convert to strings for comparison if needed
        const left = leftValue !== null && leftValue !== undefined ? String(leftValue) : '';
        const right = rightValue !== null && rightValue !== undefined ? String(rightValue) : '';

        switch (operator) {
            case '==':
            case 'equals':
                return left === right;

            case '!=':
            case 'not_equals':
                return left !== right;

            case '>':
            case 'greater_than':
                return this.toNumber(left) > this.toNumber(right);

            case '>=':
            case 'greater_than_or_equal':
                return this.toNumber(left) >= this.toNumber(right);

            case '<':
            case 'less_than':
                return this.toNumber(left) < this.toNumber(right);

            case '<=':
            case 'less_than_or_equal':
                return this.toNumber(left) <= this.toNumber(right);

            case 'contains':
                return left.toLowerCase().includes(right.toLowerCase());

            case 'not_contains':
                return !left.toLowerCase().includes(right.toLowerCase());

            case 'starts_with':
                return left.toLowerCase().startsWith(right.toLowerCase());

            case 'ends_with':
                return left.toLowerCase().endsWith(right.toLowerCase());

            case 'is_empty':
                return left === '' || left === null || left === undefined;

            case 'is_not_empty':
                return left !== '' && left !== null && left !== undefined;

            case 'matches_regex':
                try {
                    const regex = new RegExp(right);
                    return regex.test(left);
                } catch (error) {
                    global.slashLogs(`Invalid regex pattern ${error.message}`, true, true);
                    return false;
                }

            default:
                global.slashLogs(`Unknown operator ${error.message}`, true, true);
                return false;
        }
    }

    // Convert value to number
    static toNumber(value) {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

    // Validate condition structure
    static validateCondition(condition) {
        if (!condition.variable) {
            return { isValid: false, error: 'Condition must have a variable' };
        }

        if (!condition.operator) {
            return { isValid: false, error: 'Condition must have an operator' };
        }

        if (!condition.next) {
            return { isValid: false, error: 'Condition must have a next node' };
        }

        const validOperators = [
            '==', 'equals', '!=', 'not_equals',
            '>', 'greater_than', '>=', 'greater_than_or_equal',
            '<', 'less_than', '<=', 'less_than_or_equal',
            'contains', 'not_contains', 'starts_with', 'ends_with',
            'is_empty', 'is_not_empty', 'matches_regex',
        ];

        if (!validOperators.includes(condition.operator)) {
            return { isValid: false, error: `Invalid operator: ${condition.operator}` };
        }

        return { isValid: true };
    }
}

module.exports = ConditionEvaluator;
