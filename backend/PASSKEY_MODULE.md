# Passkey/WebAuthn Module Implementation

## Overview

This module implements Passkey authentication using the WebAuthn Level 2 specification via `@simplewebauthn/server`. It provides biometric, phishing-resistant authentication using device-bound credentials (Face ID, Touch ID, Windows Hello).

## Installation

The following package has been installed:
- `@simplewebauthn/server` (v13.3.0)

## Database Schema

A new `passkey_credentials` table has been created with the following structure:

```sql
CREATE TABLE "passkey_credentials" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "credential_id" character varying(512) NOT NULL UNIQUE,
  "public_key" bytea NOT NULL,
  "counter" bigint NOT NULL DEFAULT '0',
  "device_type" passkey_device_type NOT NULL, -- 'singleDevice' | 'multiDevice'
  "backed_up" boolean NOT NULL DEFAULT false,
  "transports" text[], -- ['internal', 'usb', 'nfc', 'ble']
  "nickname" character varying(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API Endpoints

### 1. Generate Registration Options
```
POST /passkey/register/options
Authorization: Bearer <JWT>
```

**Request Body:**
```json
{
  "nickname": "My iPhone 15" // optional
}
```

**Response:**
```json
{
  "options": { /* WebAuthn registration options */ },
  "sessionId": "abc123xyz"
}
```

**Process:**
1. Generates WebAuthn registration options using `generateRegistrationOptions()`
2. Stores challenge in Redis with 5-minute TTL
3. Returns options and session ID to client

---

### 2. Verify Registration
```
POST /passkey/register/verify
Authorization: Bearer <JWT>
```

**Request Body:**
```json
{
  "response": { /* WebAuthn registration response from navigator.credentials.create() */ },
  "nickname": "My iPhone 15" // optional
}
```

**Response:** `200 OK` (empty body)

**Process:**
1. Loads challenge from Redis using session ID
2. Verifies registration response using `verifyRegistrationResponse()`
3. Persists `PasskeyCredential` to database
4. Deletes challenge from Redis

**Error Responses:**
- `400 Bad Request` - Challenge expired or verification failed

---

### 3. Generate Authentication Options
```
POST /passkey/auth/options
```

**Request Body:** (optional)
```json
{} // Empty or omitted for discoverable credentials
```

**Response:**
```json
{
  "options": { /* WebAuthn authentication options */ },
  "sessionId": "abc123xyz"
}
```

**Process:**
1. Generates authentication options using `generateAuthenticationOptions()`
2. If user is authenticated, includes their credential IDs
3. Stores challenge in Redis with 5-minute TTL

---

### 4. Verify Authentication
```
POST /passkey/auth/verify
```

**Request Body:**
```json
{
  "response": { /* WebAuthn authentication response from navigator.credentials.get() */ },
  "sessionId": "abc123xyz"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "expiresIn": 900
}
```

**Process:**
1. Loads challenge from Redis
2. Verifies authentication response using `verifyAuthenticationResponse()`
3. Checks for counter regression (replay attack detection)
4. Updates counter in database
5. Issues JWT tokens
6. Deletes challenge from Redis

**Error Responses:**
- `400 Bad Request` - Challenge expired
- `401 Unauthorized` - Credential not found, verification failed, or counter regression detected

---

### 5. List Credentials
```
GET /passkey/credentials
Authorization: Bearer <JWT>
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "credentialId": "AQIDBAUGBwgJCgsMDQ4PEA",
    "deviceType": "multiDevice",
    "backedUp": true,
    "transports": ["internal", "usb"],
    "nickname": "My iPhone 15",
    "createdAt": "2026-03-26T10:00:00Z"
  }
]
```

**Note:** The `publicKey` field is excluded from responses for security.

---

### 6. Delete Credential
```
DELETE /passkey/credentials/:id
Authorization: Bearer <JWT>
```

**Response:** `200 OK` (empty body)

**Error Responses:**
- `400 Bad Request` - Cannot delete the last credential (at least one auth method must remain)
- `404 Not Found` - Credential not found

---

## Environment Variables

Add these to your `.env` file:

```env
# WebAuthn / Passkeys
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000
```

For production:
```env
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_ORIGIN=https://yourdomain.com
```

---

## Security Features

### 1. Challenge-Response Protocol
- Challenges stored in Redis with 5-minute TTL
- Prevents replay attacks

### 2. Counter Regression Detection
- Each credential maintains a signature counter
- Counter must increase on each authentication
- Regression indicates potential credential cloning → `401 Unauthorized`

### 3. User Verification Required
- `requireUserVerification: true` ensures biometric/PIN verification

### 4. Origin Validation
- Responses validated against expected origin
- Prevents cross-site attacks

### 5. Last Credential Protection
- Cannot delete the last passkey credential
- Ensures account always has at least one authentication method

---

## Usage Flow

### Registration Flow

1. **Client:** Request registration options
   ```javascript
   const { options, sessionId } = await fetch('/passkey/register/options', {
     method: 'POST',
     headers: { Authorization: `Bearer ${jwt}` }
   });
   ```

2. **Client:** Create credential
   ```javascript
   const credential = await navigator.credentials.create({
     publicKey: options
   });
   ```

3. **Client:** Submit credential for verification
   ```javascript
   await fetch('/passkey/register/verify', {
     method: 'POST',
     headers: { Authorization: `Bearer ${jwt}` },
     body: JSON.stringify({
       response: credential,
       nickname: 'My iPhone'
     })
   });
   ```

### Authentication Flow

1. **Client:** Request authentication options
   ```javascript
   const { options, sessionId } = await fetch('/passkey/auth/options', {
     method: 'POST'
   });
   ```

2. **Client:** Get credential
   ```javascript
   const credential = await navigator.credentials.get({
     publicKey: options
   });
   ```

3. **Client:** Submit credential for verification
   ```javascript
   const { accessToken, refreshToken } = await fetch('/passkey/auth/verify', {
     method: 'POST',
     body: JSON.stringify({
       response: credential,
       sessionId
     })
   });
   ```

---

## Testing

Unit tests cover:
- ✅ Invalid challenge → `400 Bad Request`
- ✅ Counter regression (replay attack) → `401 Unauthorized`
- ✅ Credential not found → `401 Unauthorized`
- ✅ Verification failure → `401 Unauthorized`
- ✅ Last credential deletion prevention → `400 Bad Request`
- ✅ Credential listing (without publicKey)
- ✅ Challenge expiration

Run tests:
```bash
pnpm run test -- passkey
```

---

## Files Created

```
backend/src/passkey/
├── dto/
│   ├── authenticate-passkey.dto.ts
│   ├── authentication-options-response.dto.ts
│   ├── passkey-credential-response.dto.ts
│   ├── register-passkey-options.dto.ts
│   └── register-passkey-verify.dto.ts
├── entities/
│   └── passkey-credential.entity.ts
├── migrations/
│   └── 1700000000006-CreatePasskeyCredentials.ts
├── passkey.controller.ts
├── passkey.module.ts
├── passkey.service.ts
└── passkey.service.spec.ts
```

---

## Acceptance Criteria Status

- ✅ Install @simplewebauthn/server
- ✅ PasskeyCredential entity with all required fields
- ✅ POST /passkey/register/options
- ✅ POST /passkey/register/verify
- ✅ POST /passkey/auth/options
- ✅ POST /passkey/auth/verify
- ✅ GET /passkey/credentials
- ✅ DELETE /passkey/credentials/:id
- ✅ Unit tests for invalid challenge and counter regression

All acceptance criteria have been met!
