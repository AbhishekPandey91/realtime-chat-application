# Real-Time Chat Application

A real-time chat application built with **Node.js, Express, MongoDB, and WebSockets**, focused on reliable message delivery, authentication, message ordering, idempotency, and asynchronous AI assistance.

## Features

- Real-time messaging using WebSockets
- JWT-based authentication and authorization
- One-to-one conversations
- Online/offline presence tracking
- Message ordering and reliable delivery
- Message idempotency to prevent duplicate processing
- Message catch-up after reconnection
- AI-powered reply suggestions
- AI-based conversation summarization
- Asynchronous AI processing using a queue and worker
- MongoDB-based message and conversation persistence

## Architecture

```text
                         Client
                           |
                    HTTP / WebSocket
                           |
                    Node.js Server
                    /            \
               Express          WebSocket
                  |                 |
            REST APIs         Message Handler
                  |                 |
                  |          Conversation Service
                  |                 |
                  +--------> MongoDB <+

                           AI Handler
                               |
                           AI Service
                               |
                            AI Queue
                               |
                           AI Worker
                               |
                     Reply Suggestions /
                    Conversation Summary
```

## Message Flow

```text
Client
  |
  | WebSocket Message
  v
WebSocket Server
  |
  v
Authentication
  |
  v
Message Handler
  |
  +--> Idempotency Check
  |
  +--> Ordering / Validation
  |
  v
Conversation Service
  |
  +--> Persist Message
  |
  v
Recipient WebSocket
  |
  v
Real-Time Delivery
```

## Reliability

### Message Idempotency

Each message is processed using a unique identifier to prevent duplicate processing caused by retries, reconnections, or network failures.

```text
Message
   |
   v
Already Processed?
   |             |
  Yes            No
   |             |
 Ignore      Process + Persist
                 |
                 v
              Deliver
```

### Message Ordering

The application maintains message ordering to ensure that messages are processed and presented in the correct sequence, even when messages are sent concurrently or network conditions vary.

### Reconnection & Catch-Up

When a user reconnects after a disconnection, the system can identify and deliver messages that were missed during the disconnected period.

## AI Processing

AI functionality is separated from the main real-time messaging path using an asynchronous queue and worker architecture.

```text
Message / Conversation
          |
          v
      AI Handler
          |
          v
      AI Service
          |
          v
       AI Queue
          |
          v
       AI Worker
        /     \
       v       v
  Reply      Summary
 Suggestions
```

This keeps potentially expensive AI processing separate from the latency-sensitive WebSocket flow.

## Project Structure

```text
src/
├── ai/
│   ├── aiPrompts.js
│   ├── aiQueue.js
│   ├── aiService.js
│   ├── replySuggester.js
│   └── summarizer.js
│
├── config/
│   └── db.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── conversation.controller.js
│   └── user.controller.js
│
├── middlewares/
│   └── auth.middleware.js
│
├── models/
│   ├── conversation.models.js
│   ├── message.models.js
│   └── users.models.js
│
├── routes/
│   ├── auth.routes.js
│   ├── conversation.routes.js
│   └── user.routes.js
│
├── websocket/
│   ├── aiHandler.js
│   ├── catchUp.js
│   ├── connectionManager.js
│   ├── conversationService.js
│   ├── index.js
│   ├── messageHandler.js
│   ├── presence.js
│   └── pubsub.js
│
├── workers/
│   └── aiWorker.js
│
├── app.js
└── server.js
```

## Tech Stack

- **Backend:** Node.js, Express.js
- **Real-Time Communication:** WebSockets (`ws`)
- **Database:** MongoDB
- **Authentication:** JWT
- **Language:** JavaScript
- **AI:** AI service with asynchronous worker processing

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/AbhishekPandey91/realtime-chat-application.git
cd realtime-chat-application
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Add any additional AI-related environment variables required by your configuration.

### 4. Start the application

```bash
npm start
```

## Engineering Focus

This project focuses on backend and real-time system concepts including:

- WebSocket connection lifecycle
- JWT authentication
- Real-time message routing
- Message idempotency
- Message ordering
- Reconnection handling
- Presence management
- Database persistence
- Asynchronous processing
- Queue and worker architecture
- Separation of concerns

## Author

**Abhishek Pandey**
B.Tech, Electrical Engineering — MNNIT Allahabad

[GitHub](https://github.com/AbhishekPandey91)