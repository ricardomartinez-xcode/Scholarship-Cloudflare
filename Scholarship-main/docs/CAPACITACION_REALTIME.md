# Capacitación / Rolplay - Supabase Realtime Integration

## Overview

The `/capacitacion/rolplay` feature provides real-time collaborative chat training sessions using Supabase Realtime as the transport layer, while maintaining Neon as the source of truth for persistence.

### Architecture

```
┌─────────────────────────┐
│   Client (React)        │
│  - useRolplayChat       │
│  - useRolplayPresence   │
└──────────────┬──────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐    ┌──────────────────┐
│  Supabase   │    │  Neon (Prisma)   │
│  Realtime   │    │  - Messages      │
│  - Broadcast│    │  - Rooms         │
│  - Presence │    │  - Members       │
└─────────────┘    └──────────────────┘
```

## Key Components

### 1. Supabase Client (`src/lib/supabase/client.ts`)

Isolated from Neon Auth/DB. Used ONLY for real-time features.

**Exported Functions:**
- `subscribeToRoomMessages(roomId, callback)` - Listen to new messages
- `publishMessageToRoom(roomId, message)` - Publish message (broadcast only, not persisted)
- `subscribeToRoomPresence(roomId, callback)` - Listen to online users
- `trackUserPresence(roomId, userData)` - Track current user online status

### 2. React Hooks

#### `useRolplayChat(roomId)`
Manages real-time chat messages.
```typescript
const { messages, isLoading, error, addMessage } = useRolplayChat(roomId);
```

#### `useRolplayPresence(roomId, currentUser)`
Tracks online users in a room.
```typescript
const { onlineUsers, isLoading } = useRolplayPresence(roomId, currentUser);
```

## Topic Conventions

- `room:{roomId}:messages` - Broadcast for chat messages
- `room:{roomId}:presence` - Presence for online users (who's in the room)
- `org:{orgId}:rolplay` - Organization-scoped notifications (future)

## Data Flow

### Sending a Message

1. **Client** → Calls `addMessage(message)` from `useRolplayChat` hook
2. **Hook** → Optimistically adds to local state
3. **Hook** → Calls `publishMessageToRoom()` to Supabase Broadcast
4. **Supabase** → Broadcasts message to all subscribers
5. **API Layer** → (Optional) Receives webhook or validation request
6. **Neon** → Message is persisted via API endpoint (not shown in realtime flow, but happens separately)

### Receiving Messages

1. **Supabase Broadcast** → Emits `new_message` event
2. **Hook** → Updates local state with new message
3. **Component** → Re-renders with new message

### Presence (Online Users)

1. **User Joins Room** → `trackUserPresence()` called
2. **Supabase Presence** → Tracks user in `room:{roomId}:presence` channel
3. **Broadcast** → Notifies others of join/leave events
4. **Hook** → Updates `onlineUsers` state

## Prisma Models

```prisma
model TrainingRoom {
  id              String
  organizationId  String
  name            String
  visibility      TrainingRoomVisibility  // private, org, public
  createdBy       String
  members         TrainingRoomMember[]
  messages        TrainingMessage[]
}

model TrainingRoomMember {
  id              String
  roomId          String
  userId          String
  role            TrainingRoomRole  // participant, trainer, facilitator
  isAnonymous     Boolean
  anonymousAlias  String?  // "Participante 01", "Asesor anónimo"
}

model TrainingMessage {
  id        String
  roomId    String
  userId    String
  content   String
  createdAt DateTime
}

model TrainingRoomPermission {
  id              String
  userId          String
  organizationId  String
  canViewRolplay  Boolean
  canJoinRolplay  Boolean
  canCreateRoom   Boolean
}
```

## API Endpoints (To Be Implemented)

### `POST /api/capacitacion/rooms`
Create a new training room.

### `GET /api/capacitacion/rooms?orgId=...`
List rooms for organization.

### `POST /api/capacitacion/messages`
Persist a message to database.
```json
{
  "roomId": "uuid",
  "userId": "uuid",
  "content": "message text"
}
```

### `GET /api/capacitacion/permissions?userId=...&orgId=...`
Check user permissions for rolplay.

## Environment Variables

Add to `.env.local` (development) or Vercel (production):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_REALTIME_JWT_SECRET=xxx
```

**Why public?**
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are intentionally public for client-side Realtime only
- They do NOT allow DB access (Realtime channels are authenticated separately)
- No sensitive data should be exposed in these keys
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_REALTIME_JWT_SECRET` are server-only secrets and must never use the `NEXT_PUBLIC_` prefix

## Security & Permissions

### Client-Side
- Permission checks on visibility of Rolplay nav link (layout)
- Permission checks before rendering rolplay UI

### Server-Side
- Validate user permissions before allowing room access
- Validate message content length and rate limiting
- Implement Realtime channel authorization (if needed)

### Anonymous Aliases
- In UI: Display "Participante 01", "Asesor anónimo", etc.
- In DB: Store real `userId` for audit trails
- Admins can see real identities; regular users cannot

## Testing Locally

1. **Setup Supabase Project**
   - Create free project at supabase.com
   - Get URL and anon key
   - Add to `.env.local`

2. **Start Dev Server**
   ```bash
   npm run dev
   ```

3. **Test in Multiple Tabs**
   - Open `http://localhost:3000/capacitacion/rolplay` in two tabs
   - Send message in tab 1
   - Should appear in tab 2 in real-time

4. **Check Presence**
   - Online users list should update as you switch tabs

## Limitations & Notes

- **Rate Limiting**: Supabase Realtime is rate-limited to 10 events/sec per client
- **Message History**: Messages are NOT automatically synced from DB on join
  - Need separate API endpoint to hydrate chat history
- **Offline Support**: Not implemented (requires local persistence layer)
- **Typing Indicators**: Not implemented (can be added to presence)
- **Message Reactions**: Not implemented (can be added to messages table)

## Migration Path

### Current (MVP)
- Mock data in UI
- Supabase Realtime configured
- Hooks ready for integration

### Phase 1 (Next Sprint)
- API endpoints for message persistence
- Permission validation
- Chat history hydration

### Phase 2
- Typing indicators
- Message reactions/edits
- Room management UI

### Phase 3
- Recording/playback of sessions
- Analytics (participation, duration, etc.)
- Advanced scheduling

## Troubleshooting

### Messages not appearing
- Check Supabase URL and key in `.env.local`
- Check browser console for errors
- Verify room exists in DB
- Check user has permission

### Presence not updating
- Ensure `trackUserPresence()` is called on mount
- Check for cleanup on unmount (untrack + removeChannel)

### Performance issues
- Reduce number of subscribed channels
- Implement pagination for message history
- Use message batching if possible

## References

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Broadcast API](https://supabase.com/docs/guides/realtime/broadcast)
- [Presence API](https://supabase.com/docs/guides/realtime/presence)
