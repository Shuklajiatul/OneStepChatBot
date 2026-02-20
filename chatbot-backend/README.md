# Chatbot Platform Backend

A production-ready WhatsApp/Instagram chatbot platform backend built with Node.js, Express, and ScyllaDB.

## Features

-  Visual flow builder support
-  WhatsApp Business API integration
-  Real-time conversation processing
-  ScyllaDB for scalable data storage
-  JWT authentication
-  Analytics and metrics tracking
-  Webhook support for external integrations
-  High-performance async processing

## Tech Stack

- **Runtime**: Node.js 
- **Framework**: Express.js
- **Database**: ScyllaDB (Cassandra-compatible)
- **Authentication**: JWT


## Prerequisites

- Node.js 18 or higher
- ScyllaDB or Apache Cassandra
- WhatsApp Business API credentials


## API Endpoints

## Flow Structure

Flows consist of nodes that define the conversation logic:

### Node Types

1. **Message** - Send text or media messages
2. **Question** - Ask for user input and store response
3. **Buttons** - Present interactive buttons (max 3)
4. **List** - Present interactive list menu
5. **Condition** - Branch based on conditions
6. **Webhook** - Call external APIs
7. **Delay** - Wait before next action
8. **End** - Complete conversation

### Example Flow

```json
{
  "nodes": [
    {
      "id": "start",
      "type": "message",
      "data": {
        "message": "Hello! Welcome to our service."
      },
      "next": "ask_name"
    },
    {
      "id": "ask_name",
      "type": "question",
      "data": {
        "question": "What's your name?",
        "variable_name": "user_name"
      },
      "next": "greet"
    },
    {
      "id": "greet",
      "type": "message",
      "data": {
        "message": "Nice to meet you, {{user_name}}!"
      },
      "next": "end"
    },
    {
      "id": "end",
      "type": "end"
    }
  ]
}
```

## Variable Replacement

Use `{{variable_name}}` syntax in messages to insert dynamic values:

- User inputs: `{{user_name}}`, `{{email}}`
- Webhook responses: `{{webhook.response.data.id}}`
- Nested values: `{{user.profile.age}}`

## Environment Variables

See `.env.example` for all available configuration options.

### Required Variables

- `SCYLLA_CONTACT_POINTS` - ScyllaDB contact points
- `SCYLLA_KEYSPACE` - Database keyspace name
- `JWT_ACCESS_SECRET` - JWT access token secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `WHATSAPP_API_URL` - WhatsApp API base URL
- `WHATSAPP_VERIFY_TOKEN` - Webhook verification token

## Project Structure

```
src/
├── config/          # Configuration files
├── database/        # Database schema and base repository
├── models/          # Data models
├── repositories/    # Data access layer
├── services/        # Business logic
├── controllers/     # Request handlers
├── routes/          # API routes
├── middleware/      # Express middleware
├── validators/      # Request validation schemas
├── utils/           # Utility functions
├── app.js           # Express app setup
└── server.js        # Server entry point
```

## Error Handling

The API uses standard HTTP status codes and returns errors in this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Input validation with Joi
- Helmet.js security headers
- CORS configuration

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
