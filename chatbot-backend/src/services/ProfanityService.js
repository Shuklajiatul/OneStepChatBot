const leoProfanity = require('leo-profanity');
const axios        = require('axios');

// PROFANITY_CHECK_MODE=local or ai
class ProfanityService {

    static async check(message) {
        const mode = (process.env.PROFANITY_CHECK_MODE || 'local').toLowerCase();

        if (mode === 'ai') {
            return this.checkWithAI(message);
        }

        return leoProfanity.check(message);
    }

    static checkWithLocal(message) {
        return leoProfanity.check(message);
    }

    static async checkWithAI(message) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const model  = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free';

        if (!apiKey) {
            global.slashLogs('OPENROUTER_API_KEY is not set, falling back to local profanity check', true, true);
            return leoProfanity.check(message);
        }

        try {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are a strict content moderation assistant. ' +
                                'Your job is to detect if a user message contains profanity, abusive language, hate speech, or inappropriate content. ' +
                                'Reply with ONLY the single word "YES" if the message is inappropriate, or "NO" if it is acceptable. ' +
                                'Do not add any explanation or punctuation.',
                        },
                        {
                            role: 'user',
                            content: message,
                        },
                    ],
                    max_tokens: 5,
                    temperature: 0,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.APP_URL || 'http://10.10.15.194:3006',
                        'X-Title': 'Chatbot CRM',
                    },
                    timeout: 8000,
                }
            );
            
            global.slashLogs(`AI profanity response body: ${JSON.stringify(response.data)}`, true, true);
            const reply = response.data?.choices?.[0]?.message?.content?.trim().toUpperCase();
            global.slashLogs(`AI profanity check for "${message}" → ${reply}`, true, true);

            return reply === 'YES';
        } catch (error) {
            const status   = error.response?.status;
            const body     = JSON.stringify(error.response?.data || {});
            global.slashLogs(`AI profanity check failed [${status}]: ${error.message} | Response: ${body} — falling back to local`, true, true);
            return leoProfanity.check(message);
        }
    }
}

module.exports = ProfanityService;
