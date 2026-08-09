# ACES IAM API Documentation

Comprehensive API specifications and developer reference documentation for the **Identity & Access Management (IAM)** module of the ACES API platform.

---

## 1. Overview & Architecture

The **IAM Module** (`iam/`) handles all identity operations, user registration, account onboarding, authentication, session management, team-position hierarchy validation, dynamic role resolution, and Role-Based Access Control (RBAC).

### Architectural Boundaries & Encapsulation
* **Public Service Interface ([`iam/index.js`](file:///home/yashj/cross-root/aces/aces_api/iam/index.js))**: Exports `IAMService` for inter-module calls and orchestration layers.
* **HTTP Layer ([`iam/http/`](file:///home/yashj/cross-root/aces/aces_api/iam/http))**: Contains Express route definitions ([`iam.routes.js`](file:///home/yashj/cross-root/aces/aces_api/iam/http/iam.routes.js)) and HTTP request handlers ([`iam.controller.js`](file:///home/yashj/cross-root/aces/aces_api/iam/http/iam.controller.js)).
* **Internal Layer ([`iam/internal/`](file:///home/yashj/cross-root/aces/aces_api/iam/internal))**: Contains MongoDB Mongoose schema ([`member.model.js`](file:///home/yashj/cross-root/aces/aces_api/iam/internal/member.model.js)), team hierarchy parsing ([`teamHierarchy.service.js`](file:///home/yashj/cross-root/aces/aces_api/iam/internal/teamHierarchy.service.js)), and internal business logic ([`iam.service.internal.js`](file:///home/yashj/cross-root/aces/aces_api/iam/internal/iam.service.internal.js)).

> [!IMPORTANT]
> External modules (e.g., `events`, `announcements`, `forms`, `gallery`) must interact with IAM only via `IAMService` in [`iam/index.js`](file:///home/yashj/cross-root/aces/aces_api/iam/index.js). Directly importing files from `iam/internal/*` in other modules is strictly forbidden.

---

## 2. General Specifications

### Base URLs
* **Development:** `http://localhost:5000/api/v1/iam`
* **Production:** `https://api.aces.association/api/v1/iam`

### Authentication & Authorization
* **Authorization Header:**
  ```http
  Authorization: Bearer <JWT_TOKEN>
  ```
* **Cookie-Based Auth:**
  Logs in set an `HTTP-Only` cookie named `auth_token` valid for 7 days.

### Standard Response Envelopes

#### Success Response Envelope (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

#### Error Response Envelope (`4xx` / `5xx`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

#### Standard Error Codes
| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `INVALID_INPUT` | `400 Bad Request` | Missing required fields, invalid team/position, or validation failure. |
| `UNAUTHORIZED` | `401 Unauthorized` | Invalid/expired JWT token or invalid login credentials. |
| `FORBIDDEN` | `403 Forbidden` | Authenticated user lacks required authority/role to access resource. |
| `NOT_FOUND` | `404 Not Found` | Requested member does not exist or belongs to an internal team. |
| `CONFLICT` | `409 Conflict` | Member email already exists in system. |
| `INTERNAL_ERROR` | `500 Internal Error` | Unexpected backend failure. |

---

## 3. Data Models & Constants

### Member Data Model Schema
```json
{
  "id": "66b64f9e1234567890abcdef",
  "name": "Alex Mercer",
  "email": "alex.mercer@college.edu",
  "team": "Technical Team",
  "position": "Head",
  "status": "ACTIVE",
  "roles": [
    "tech_team"
  ],
  "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v12345678/aces/profile_photos/alex.jpg",
  "social_links": {
    "linkedin": "https://linkedin.com/in/alexmercer",
    "instagram": "https://instagram.com/alexmercer",
    "github": "https://github.com/alexmercer"
  },
  "createdAt": "2026-08-09T14:00:00.000Z",
  "updatedAt": "2026-08-09T14:00:00.000Z"
}
```

#### Field Specifications
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String (ObjectId) | Yes | Unique identifier for member. |
| `name` | String | No | Full display name of the member. Set during onboarding or profile update. |
| `email` | String | Yes | Unique lowercase email address. |
| `team` | String | Yes | Team assignment (validated against `teams.txt`). |
| `position` | String | Yes | Position held within the assigned team. |
| `status` | String | Yes | Account status (`NOT_ACTIVE`, `ACTIVE`). |
| `roles` | Array[String] | Yes | Resolved roles (e.g. `tech_team`, `admin`, `leader`, etc.). |
| `profile_photo_url` | String | No | Secure HTTPS URL from Cloudinary. |
| `social_links` | Object | No | Social handles (`linkedin`, `instagram`, `github`). |

---

## 4. Team Hierarchy & Dynamic Role Resolution

The team and position hierarchy is configured via [`teams.txt`](file:///home/yashj/cross-root/aces/aces_api/teams.txt).

### Valid Teams & Positions Table
| Team Name | Valid Positions | Derived Role |
| :--- | :--- | :--- |
| `Leaders` | `General Secretary`, `Joint General Secretary` | `leader` |
| `Faculty` | `Faculty` | `faculty` |
| `Web Team` | `Head`, `Joint Head`, `Member` | `web_team` |
| `Technical Team` | `Head`, `Joint Head`, `Member` | `tech_team` |
| `Media Team` | `Head`, `Joint Head`, `Member` | `media_team` |
| `Marketing Team` | `Head`, `Joint Head`, `Member` | `marketing_team` |
| `Treasury Team` | `Head`, `Joint Head`, `Member` | `treasury_team` |
| `Event Team` | `Head`, `Joint Head`, `Member` | `event_team` |
| `DnP Team` | `Head`, `Joint Head`, `Member` | `dnp_team` |
| `Editorial Team` | `Head`, `Joint Head`, `Member` | `editorial_team` |
| `Production Team` | `Head`, `Joint Head`, `Member` | `production_team` |
| `Executive` *(Internal)* | `Administrator`, `admin` | `admin` |

> [!NOTE]
> * **Team Aliases:** `Tech Team` maps to `Technical Team`, and `Executive Team` maps to `Executive`.
> * **Internal Teams:** Members belonging to `Executive` are hidden from public read endpoints (`GET /iam/members` and `GET /iam/members/:id`).

---

## 5. HTTP Endpoints Specification

### 5.1 Admin Register Member
Creates a member record in `NOT_ACTIVE` status and triggers an onboarding email containing a single-use token valid for 24 hours.

* **Method:** `POST`
* **Path:** `/api/v1/iam/register`
* **Content-Type:** `multipart/form-data` or `application/json`
* **Authorization:** Required (`admin` role via `members.register` authority)

#### Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String | Yes | Member's unique email address. |
| `team` | String | Yes | Team name (must exist in hierarchy). |
| `position` | String | Yes | Position (must be valid for specified team). |
| `name` | String | No | Optional display name. |
| `roles` | Array[String] | No | Optional explicit role overrides (merged with dynamic team roles). |
| `social_links` | Object / JSON String | No | Object containing `linkedin`, `instagram`, `github`. |
| `profile_photo` | File (Image) | No | Optional image file (`profile_photo_url` automatically set via Cloudinary upload). |

#### Request Example (JSON)
```http
POST /api/v1/iam/register HTTP/1.1
Host: localhost:5000
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "email": "sarah.connor@college.edu",
  "team": "Web Team",
  "position": "Head",
  "social_links": {
    "github": "https://github.com/sarahconnor"
  }
}
```

#### Response Example (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "66b6512a876543210fedcba9",
    "name": "",
    "email": "sarah.connor@college.edu",
    "team": "Web Team",
    "position": "Head",
    "status": "NOT_ACTIVE",
    "roles": [
      "web_team"
    ],
    "profile_photo_url": "",
    "social_links": {
      "linkedin": "",
      "instagram": "",
      "github": "https://github.com/sarahconnor"
    },
    "createdAt": "2026-08-09T14:15:00.000Z",
    "updatedAt": "2026-08-09T14:15:00.000Z"
  },
  "error": null
}
```

---

### 5.2 Complete Member Onboarding
Public activation endpoint for registered members using the email onboarding token to set their password.

* **Method:** `POST`
* **Path:** `/api/v1/iam/onboard`
* **Content-Type:** `application/json`
* **Authorization:** None (Public)

#### Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `token` | String | Yes | Single-use hex onboarding token from email link. |
| `password` | String | Yes | New password for the account. |
| `name` | String | No | Optional member display name update. |

#### Request Example
```http
POST /api/v1/iam/onboard HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "token": "e4d3c2b1a09876543210fedcba9876543210fedcba9876543210fedcba987654",
  "password": "SecurePassword123!",
  "name": "Sarah Connor"
}
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "66b6512a876543210fedcba9",
    "name": "Sarah Connor",
    "email": "sarah.connor@college.edu",
    "team": "Web Team",
    "position": "Head",
    "status": "ACTIVE",
    "roles": [
      "web_team"
    ],
    "profile_photo_url": "",
    "social_links": {
      "linkedin": "",
      "instagram": "",
      "github": "https://github.com/sarahconnor"
    },
    "createdAt": "2026-08-09T14:15:00.000Z",
    "updatedAt": "2026-08-09T14:20:00.000Z"
  },
  "error": null
}
```

---

### 5.3 Member Login
Authenticates member credentials, returns account details, and attaches a JWT authentication token in an HTTP-only cookie.

* **Method:** `POST`
* **Path:** `/api/v1/iam/login`
* **Content-Type:** `application/json`
* **Authorization:** None (Public)

#### Request Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String | Yes | Member's registered email address. |
| `password` | String | Yes | Account password. |

#### Request Example
```http
POST /api/v1/iam/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "sarah.connor@college.edu",
  "password": "SecurePassword123!"
}
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "66b6512a876543210fedcba9",
      "name": "Sarah Connor",
      "email": "sarah.connor@college.edu",
      "team": "Web Team",
      "position": "Head",
      "status": "ACTIVE",
      "roles": [
        "web_team"
      ],
      "profile_photo_url": "",
      "social_links": {
        "linkedin": "",
        "instagram": "",
        "github": "https://github.com/sarahconnor"
      },
      "createdAt": "2026-08-09T14:15:00.000Z",
      "updatedAt": "2026-08-09T14:20:00.000Z"
    }
  },
  "error": null
}
```
*Note: Sets `Set-Cookie: auth_token=<JWT_TOKEN>; Path=/; HttpOnly; Max-Age=604800` response header.*

---

### 5.4 List Members
Retrieves a list of public team members with optional filters. Internal teams (`Executive`) are automatically excluded.

* **Method:** `GET`
* **Path:** `/api/v1/iam/members`
* **Authorization:** Optional (`optionalAuthenticate`)

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `team` | String | No | Case-insensitive filter by team name (e.g. `web`, `technical`). |
| `status` | String | No | Filter by account status (`ACTIVE`, `NOT_ACTIVE`). |

#### Request Example
```http
GET /api/v1/iam/members?team=Web%20Team&status=ACTIVE HTTP/1.1
Host: localhost:5000
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "66b6512a876543210fedcba9",
        "name": "Sarah Connor",
        "email": "sarah.connor@college.edu",
        "team": "Web Team",
        "position": "Head",
        "status": "ACTIVE",
        "roles": [
          "web_team"
        ],
        "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v12345678/aces/profile_photos/sarah.jpg",
        "social_links": {
          "linkedin": "",
          "instagram": "",
          "github": "https://github.com/sarahconnor"
        },
        "createdAt": "2026-08-09T14:15:00.000Z",
        "updatedAt": "2026-08-09T14:20:00.000Z"
      }
    ]
  },
  "error": null
}
```

---

### 5.5 Get Member by ID
Retrieves details for a single public member by ID.

* **Method:** `GET`
* **Path:** `/api/v1/iam/members/:id`
* **Authorization:** Optional (`optionalAuthenticate`)

#### Path Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | String | MongoDB ObjectId string of member. |

#### Request Example
```http
GET /api/v1/iam/members/66b6512a876543210fedcba9 HTTP/1.1
Host: localhost:5000
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "66b6512a876543210fedcba9",
    "name": "Sarah Connor",
    "email": "sarah.connor@college.edu",
    "team": "Web Team",
    "position": "Head",
    "status": "ACTIVE",
    "roles": [
      "web_team"
    ],
    "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v12345678/aces/profile_photos/sarah.jpg",
    "social_links": {
      "linkedin": "",
      "instagram": "",
      "github": "https://github.com/sarahconnor"
    },
    "createdAt": "2026-08-09T14:15:00.000Z",
    "updatedAt": "2026-08-09T14:20:00.000Z"
  },
  "error": null
}
```

---

### 5.6 Update Member Profile
Updates a member's profile. A non-admin member can only update their own profile; admins can update any profile.

* **Method:** `PUT`
* **Path:** `/api/v1/iam/members/:id`
* **Content-Type:** `multipart/form-data` or `application/json`
* **Authorization:** Required (`authenticate` - Self or Admin)

#### Field Security Rules
* **Self-Updates (Non-Admin):** `status`, `roles`, `email`, and `team` updates are ignored/stripped.
* **Admin Updates:** Admins can modify all fields including `team`, `position`, `roles`, and `status`.

#### Request Example (JSON)
```http
PUT /api/v1/iam/members/66b6512a876543210fedcba9 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <USER_JWT_TOKEN>
Content-Type: application/json

{
  "name": "Sarah J. Connor",
  "social_links": {
    "linkedin": "https://linkedin.com/in/sarahjconnor",
    "github": "https://github.com/sarahconnor"
  }
}
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "66b6512a876543210fedcba9",
    "name": "Sarah J. Connor",
    "email": "sarah.connor@college.edu",
    "team": "Web Team",
    "position": "Head",
    "status": "ACTIVE",
    "roles": [
      "web_team"
    ],
    "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v12345678/aces/profile_photos/sarah.jpg",
    "social_links": {
      "linkedin": "https://linkedin.com/in/sarahjconnor",
      "instagram": "",
      "github": "https://github.com/sarahconnor"
    },
    "createdAt": "2026-08-09T14:15:00.000Z",
    "updatedAt": "2026-08-09T14:30:00.000Z"
  },
  "error": null
}
```

---

### 5.7 Delete Member
Removes a member from the database.

* **Method:** `DELETE`
* **Path:** `/api/v1/iam/members/:id`
* **Authorization:** Required (`admin` role via `members.delete` authority)

#### Request Example
```http
DELETE /api/v1/iam/members/66b6512a876543210fedcba9 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

#### Response Example (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Member successfully removed."
  },
  "error": null
}
```

---

## 6. Public Service API Reference (`IAMService`)

The public interface for internal module integrations is provided via `IAMService` in [`iam/index.js`](file:///home/yashj/cross-root/aces/aces_api/iam/index.js).

```javascript
import { IAMService } from './iam/index.js';
```

### Available Methods

#### `verifyToken(token: string): Promise<Object>`
Decodes and verifies a JWT token string, returning the payload (`{ id, email, roles, team, position }`).

#### `getMemberById(id: string): Promise<Object>`
Fetches member details by ObjectId string. Throws `NotFoundError` if not found or internal.

#### `getUserPermissions(id: string): Promise<Array<string>>`
Fetches member by ID and returns their roles array (`e.g. ['tech_team', 'admin']`).

#### `registerMember(data: Object, file?: Object): Promise<Object>`
Registers a new member and sends onboarding email notification.

#### `completeOnboarding(data: Object): Promise<Object>`
Completes onboarding with `{ token, password, name }`.

#### `seedInitialAdmin(): Promise<Object | null>`
Checks `INIT_ADMIN_EMAIL` in `.env` and seeds the default admin account on server startup.

#### `validateTeamAndPosition(team: string, position: string): { canonicalTeam: string, canonicalPosition: string }`
Validates input team and position against `teams.txt` and returns normalized canonical names.

#### `getRolesByTeamAndPosition(team: string, position: string): Array<string>`
Calculates role string array based on validated team and position assignment.

#### `isInternalTeam(team: string): boolean`
Returns `true` if team is designated internal (`Executive`).

#### `hasAuthority(userRoles: string[], authorityInput: string): boolean`
Checks if user's roles satisfy authority requirement (e.g., `members.register`, `events.create`).

---

## 7. Startup Seeding

When the API server starts (`npm start` / `server.js`), the application invokes `IAMService.seedInitialAdmin()`.

* **Config Requirement:** `INIT_ADMIN_EMAIL` set in `.env` (optional `INIT_ADMIN_PASSWORD`).
* **Defaults:** Password defaults to `Admin@123456` if omitted.
* **Seeded Record:** `team: "Executive"`, `position: "Administrator"`, `roles: ["admin", "web_team"]`, `status: "ACTIVE"`.
