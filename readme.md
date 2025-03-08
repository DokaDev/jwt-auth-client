# JWT Authentication System Documentation

## Overview

This document provides a comprehensive explanation of the JWT (JSON Web Token) authentication system implemented in this application. The system is designed to handle user authentication using a combination of AccessToken and RefreshToken, providing secure and efficient API access with automatic token renewal.

## Table of Contents
1. [Architecture](#architecture)
2. [Token Management](#token-management)
3. [Authentication Flow](#authentication-flow)
4. [Token Renewal Mechanism](#token-renewal-mechanism)
5. [API Request Handling](#api-request-handling)
6. [Component Communication](#component-communication)
7. [Security Considerations](#security-considerations)
8. [Testing and Debugging](#testing-and-debugging)

## Architecture

The JWT authentication system follows a layered architecture with clear separation of concerns:

### Core Components:

1. **Auth Utilities (`auth.ts`):**
   - Responsible for token generation, validation, and decoding
   - Handles test login and token refresh functionality
   - Provides utilities for calculating token expiration times

2. **Auth Context (`AuthContext.tsx`):**
   - Implements React Context for global authentication state management
   - Manages tokens and user information across the application
   - Handles periodic token checks and automatic refreshes
   - Provides authentication hooks for components

3. **API Test Utilities (`apiTest.ts`):**
   - Simulates API endpoints with varying security requirements
   - Implements token validation and auto-refresh during API calls
   - Provides detailed responses with token refresh status

4. **UI Components:**
   - Authentication buttons for login/logout functionality
   - API test buttons for demonstrating token usage
   - Real-time token status display

### Data Flow Diagram:

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│               │       │               │       │               │
│  Auth Utils   │◄─────►│  Auth Context │◄─────►│  UI Components│
│   (auth.ts)   │       │(AuthContext.tsx)      │(AuthButtons/  │
│               │       │               │       │ApiTestButtons)│
└───────┬───────┘       └───────────────┘       └───────────────┘
        │                                               ▲
        │                                               │
        │                      ┌───────────────┐        │
        └────────────────────►│  API Test     │────────┘
                              │  (apiTest.ts) │
                              │               │
                              └───────────────┘
```

## Token Management

The system employs two types of tokens:

### AccessToken:
- Short-lived (30 seconds in test mode)
- Used for authenticating API requests
- Contains user identity and role information
- Automatically refreshed when nearing expiration

### RefreshToken:
- Longer-lived (1 minute in test mode)
- Used only for obtaining new AccessTokens
- Stored alongside AccessToken
- Requires re-login when expired

### Token Structure:
Each JWT token consists of three parts:
1. **Header:** Contains token type and signing algorithm
   ```json
   {
     "alg": "HS256",
     "typ": "JWT"
   }
   ```

2. **Payload:** Contains claims about the user
   ```json
   {
     "sub": "1",              // User ID
     "email": "test@example.com",
     "name": "Test User",
     "role": "user",
     "iat": 1615480215,       // Issued at timestamp
     "exp": 1615480245        // Expiration timestamp
   }
   ```

3. **Signature:** Ensures token integrity (simplified in test implementation)

## Authentication Flow

### Login Process:
1. User submits credentials (email/password)
2. `login()` function in AuthContext is called
3. Credentials are validated against test data
4. Upon successful authentication:
   - AccessToken and RefreshToken are generated
   - Tokens are stored in LocalStorage
   - User information is extracted from token and stored
   - AuthContext state is updated, triggering UI re-renders
   - Timer for token checks is initiated

### Sequence Diagram - Login:
```
┌─────┐          ┌─────────────┐          ┌──────────┐          ┌────────────┐
│ UI  │          │ AuthContext │          │ auth.ts  │          │ LocalStorage│
└──┬──┘          └──────┬──────┘          └────┬─────┘          └─────┬──────┘
   │                    │                      │                      │
   │ login(email, pwd)  │                      │                      │
   ├───────────────────►│                      │                      │
   │                    │ loginTest(creds)     │                      │
   │                    ├─────────────────────►│                      │
   │                    │                      │                      │
   │                    │  {user, tokens}      │                      │
   │                    │◄─────────────────────┤                      │
   │                    │                      │                      │
   │                    │ updateTokens()       │                      │
   │                    ├┐                     │                      │
   │                    ││ setTokens()         │                      │
   │                    ││ setUser()           │                      │
   │                    ││                     │          save tokens │
   │                    ││                     │                      │
   │                    │└──────────────────────────────────────────►│
   │ UI updates         │                      │                      │
   │◄───────────────────┤                      │                      │
   │                    │                      │                      │
```

### Logout Process:
1. User clicks logout button
2. `logout()` function in AuthContext is called
3. User data and tokens are cleared from state
4. Token data is removed from LocalStorage
5. UI updates to reflect logged-out state

## Token Renewal Mechanism

The system includes two complementary token renewal mechanisms:

### 1. Proactive Renewal (Timer-based):
- A timer runs every 15 seconds to check token status
- If AccessToken has less than 10 seconds remaining:
  - RefreshToken is used to obtain new tokens
  - New tokens replace old ones in state and storage
  - UI automatically updates to show new expiration times

### 2. Reactive Renewal (API Request-based):
- When making API requests, token validity is checked
- If AccessToken is expired but RefreshToken is valid:
  - New tokens are obtained automatically
  - Original API request is retried with new token
  - UI is updated with new token information
  - Response indicates that tokens were refreshed

### Sequence Diagram - API Call with Token Renewal:
```
┌─────┐          ┌───────────┐          ┌──────────┐          ┌────────────┐
│ UI  │          │ apiTest.ts│          │ auth.ts  │          │AuthContext │
└──┬──┘          └─────┬─────┘          └────┬─────┘          └─────┬──────┘
   │ callAPI()         │                      │                      │
   ├──────────────────►│                      │                      │
   │                   │ verifyJwt(token)     │                      │
   │                   ├─────────────────────►│                      │
   │                   │                      │                      │
   │                   │ token expired        │                      │
   │                   │◄─────────────────────┤                      │
   │                   │                      │                      │
   │                   │ refreshToken()       │                      │
   │                   ├─────────────────────►│                      │
   │                   │                      │                      │
   │                   │ new tokens           │                      │
   │                   │◄─────────────────────┤                      │
   │                   │                      │                      │
   │                   │ retry API call       │                      │
   │                   ├┐                     │                      │
   │                   ││                     │                      │
   │                   │└────────────────────►│                      │
   │                   │                      │                      │
   │                   │ API response         │                      │
   │                   │◄─────────────────────┤                      │
   │                   │                      │                      │
   │ response + tokens │                      │                      │
   │◄──────────────────┤                      │                      │
   │                   │                      │                      │
   │ setTokens()       │                      │                      │
   ├────────────────────────────────────────────────────────────────►│
   │                   │                      │                      │
   │ UI updates        │                      │                      │
   │◄────────────────────────────────────────────────────────────────┤
```

## API Request Handling

The application simulates three types of API endpoints to demonstrate different authentication scenarios:

1. **Public Endpoint:**
   - No authentication required
   - Accessible to all users regardless of login status
   - Always returns success with public data

2. **Protected Endpoint:**
   - Requires valid AccessToken
   - Performs token validation before processing
   - Automatically refreshes token if expired
   - Returns protected data on success

3. **Admin Endpoint:**
   - Requires valid AccessToken with admin privileges
   - Performs both token validation and role-based authorization
   - Simulates permission checks (randomly succeeds/fails for testing)
   - Returns admin data on success

### API Request Flow:
1. Component calls `callTestApi()` with endpoint type and tokens
2. Function checks if authentication is required for the endpoint
3. If required, AccessToken is validated
4. If AccessToken is invalid/expired:
   - RefreshToken is checked and used if valid
   - New tokens are obtained and original request is retried
   - Response includes both API result and token refresh status
5. Component receives response and updates UI
6. If tokens were refreshed, AuthContext is updated

## Component Communication

The system uses React Context API for state management and component communication:

### AuthContext:
- Provides global authentication state to all components
- Offers methods for login, logout, and token management
- Exposes the `useAuth()` hook for components to access auth state
- Handles token persistence through LocalStorage

### Token State Updates:
- UI components display real-time token status
- Token timers update every second, showing remaining validity
- When tokens change (login, refresh, logout), all components re-render
- External events triggering token updates (API calls) properly propagate to UI

### External Token Updates:
When API calls result in token refresh, a special mechanism ensures Context state is updated:
1. API returns refreshed tokens in response
2. Component receives tokens and calls `setTokens()` from AuthContext
3. AuthContext updates its state and LocalStorage
4. All components using the AuthContext re-render with new token information

## Security Considerations

While this implementation is primarily for testing and demonstration, it incorporates several security best practices:

### 1. Token Expiration:
- Short-lived AccessTokens minimize the window for token misuse
- Automatic refresh mechanism prevents user experience disruption

### 2. Token Validation:
- Tokens are validated before use in API requests
- Expired tokens are rejected and refreshed when possible

### 3. Separation of Tokens:
- AccessToken for regular API requests
- RefreshToken only used for obtaining new tokens

### 4. Production Recommendations:
- Use HttpOnly cookies instead of LocalStorage for token storage
- Implement CSRF protection mechanisms
- Apply proper HTTPS and secure cookie settings
- Apply signature verification for tokens
- Add rate limiting for authentication endpoints

## Testing and Debugging

The system includes extensive logging and visualization tools for testing and debugging:

### Console Logging:
- Every authentication action is logged to the console
- Token generation, validation, and refresh operations are recorded
- API calls and token checks are documented
- Timestamps and remaining validity periods are displayed

### UI Visualization:
- Real-time token status display with countdown timers
- Color-coded indicators for valid/expired tokens
- Explicit notification when tokens are refreshed during API calls
- API response display showing success/failure and data/errors

---

This implementation provides a complete JWT authentication system with automatic token refresh, emphasizing both security and user experience. While simplified for demonstration, it follows the core principles of proper JWT implementation and can be extended for production use with the recommended security enhancements. 