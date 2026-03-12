# Chat Attachments Design

## Overview

Enable users to send file attachments (images and documents) to agents via the chat interface, with attachments persisted in the database and displayed in message history.

## Approach

**JSON Body + messages table extension** — Files are base64-encoded on the frontend and sent inline in the existing JSON API. The messages table gains an `attachments TEXT` column storing a JSON array. This is the simplest approach that integrates seamlessly with the existing architecture, suitable for the expected file sizes (<10MB).

## Data Structure

```typescript
interface Attachment {
  filename: string    // Original filename
  mediaType: string   // MIME type, e.g. "image/png", "application/pdf"
  data: string        // Base64-encoded file content
  size: number        // Original file size in bytes
}
```

This structure is used consistently across the entire pipeline: frontend → API → backend → database → display.

## Data Flow

### Sending

```
User selects files → PromptInput produces FileUIPart[]
  → ChatInput.handleSubmit extracts files, converts blob URLs to base64
    → useChat.send(text, attachments[])
      → API client: POST JSON { prompt, chatId, attachments }
        → Backend messages route receives and validates
          → MessageRouter saves to DB (messages.attachments JSON column)
            → AgentQueue → AgentRuntime.process
              → Build Claude SDK content blocks:
                  Image → { type: "image", source: { type: "base64", media_type, data } }
                  Document → { type: "document", source: { type: "base64", media_type, data } }
              → SDK executes, streams response
```

### Displaying

```
GET /api/chats/:chatId/messages → Returns messages with attachments field
  → Frontend useChat parses attachments
    → UserMessage renders:
        Image → Clickable thumbnail (max-width ~200px), lightbox on click
        Document → File card (type icon + filename + readable size)
```

## Frontend Changes

### ChatInput.tsx
- Modify `handleSubmit` to extract `msg.files` and convert `FileUIPart[]` to `Attachment[]`
- Fetch each blob URL → arrayBuffer → base64 conversion

### PromptInput props
- Pass `accept` to restrict to supported image + document types
- Set `maxFileSize: 10MB`
- Set `maxFiles: 5`

### useChat.ts
- Extend `send` signature: `send(prompt: string, attachments?: Attachment[])`
- Include `attachments` in local user message object
- Pass attachments to `sendMessage` API call

### client.ts
- Extend `sendMessage` to accept and include `attachments` in JSON body

### UserMessage.tsx
- Add attachment display area below message text
- Images: thumbnail grid, click to open lightbox
- Documents: file card with type icon, filename, and human-readable size

## Backend Changes

### messages route (src/routes/messages.ts)
- Extend POST handler request body: `attachments?: Attachment[]`
- Validate mediaType against whitelist, validate base64 data

### InboundMessage (src/channel/types.ts)
- Add `attachments?: Attachment[]` field

### MessageRouter (src/channel/router.ts)
- JSON.stringify attachments when saving to database

### Database (src/db/index.ts)
- Migration: `ALTER TABLE messages ADD COLUMN attachments TEXT`
- Uses existing try/catch ALTER TABLE pattern

### Message query
- GET /api/chats/:chatId/messages: JSON.parse `attachments` column in response

### AgentRuntime (src/agent/runtime.ts)
- Extend `ProcessParams`: add `attachments?: Attachment[]`
- In `executeQuery`, build multi-part content when attachments present:
  ```typescript
  // Text only: prompt string
  // With attachments: content block array
  [
    { type: "text", text: prompt },
    { type: "image", source: { type: "base64", media_type, data } },
    { type: "document", source: { type: "base64", media_type, data } },
  ]
  ```

### AgentQueue (src/agent/queue.ts)
- Pass through `attachments` to `AgentRuntime.process()`

## Constraints

### Supported file types
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Documents: `application/pdf`, `text/plain`, `text/markdown`, `text/csv`

### Limits
- Max file size: 10MB per file
- Max attachments: 5 per message
- Validation on both frontend (at selection time) and backend (at receipt)

### Error handling
- File too large → Frontend toast, block send
- Unsupported type → Frontend toast, block add
- Invalid base64 → Backend returns 400
- SDK-unsupported format → Skip attachment, log warning

## Out of Scope
- Upload progress bar (base64 inline, single request)
- Attachment download functionality
- Image compression/resizing
- Assistant message attachments (Claude returns text)
- Drag-to-reorder attachments
