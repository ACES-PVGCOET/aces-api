# ACES Announcements API Documentation

Comprehensive API specifications and developer reference documentation for the **Announcements** module of the ACES API platform.

---

## 1. Overview & Architecture

The **Announcements Module** (`announcements/`) handles broadcast announcements, updates, and official news postings across the ACES platform.

### Architectural Boundaries & Encapsulation
* **Public Service Interface ([`announcements/index.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/index.js))**: Exports `AnnouncementsService` for inter-module programmatic calls.
* **HTTP Layer ([`announcements/http/`](file:///home/yashj/cross-root/aces/aces_api/announcements/http))**: Express router ([`announcements.routes.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/http/announcements.routes.js)) and controller ([`announcements.controller.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/http/announcements.controller.js)).
* **Internal Layer ([`announcements/internal/`](file:///home/yashj/cross-root/aces/aces_api/announcements/internal))**: Mongoose model ([`announcement.model.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/internal/announcement.model.js)) and business service ([`announcements.service.internal.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/internal/announcements.service.internal.js)).

> [!IMPORTANT]
> External modules must interact with Announcements only via `AnnouncementsService` exported in [`announcements/index.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/index.js). Direct imports from `announcements/internal/*` are strictly forbidden.

---

## 2. General Specifications

### Base URLs
* **Development:** `http://localhost:5000/api/v1/announcements`
* **Production:** `https://api.aces.association/api/v1/announcements`

### Authentication & Authorization
* **Public Endpoints (`GET /`, `GET /:id`)**: Open access (no token required).
* **Protected Endpoints (`POST /`, `PUT /:id`, `DELETE /:id`)**:
  - Requires JWT Bearer Token in `Authorization` header or `jwt` cookie.
  - Enforced via Authority middleware: `authorize('announcements.create')`, `authorize('announcements.update')`, `authorize('announcements.delete')`.
  - Authority Mapping ([`authorities.json`](file:///home/yashj/cross-root/aces/aces_api/authorities.json)): `"announcements.*": ["marketing_team", "admin"]`.

### Standard Response Envelopes

#### Success Response (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

#### Error Response (`4xx` / `5xx`)
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
| `INVALID_INPUT` | `400 Bad Request` | Missing required fields (`topic`, `description`) or invalid ObjectId format. |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing or invalid authentication token. |
| `FORBIDDEN` | `403 Forbidden` | Authenticated user lacks required authority (`announcements.*` / `marketing_team`). |
| `NOT_FOUND` | `404 Not Found` | Requested announcement ID does not exist. |
| `INTERNAL_ERROR` | `500 Internal Error` | Unexpected backend server error. |

---

## 3. Data Models & Schemas

### Announcement Schema (`AnnouncementModel`)

```json
{
  "id": "66b64f9e1234567890annc01",
  "topic": "Registration Open for ACES Hackathon 2026",
  "description": "Submissions are officially open! Join us for a 48-hour coding challenge.",
  "created_by": "66b64f9e1234567890user01",
  "updated_by": null,
  "created_at": "2026-08-10T08:00:00.000Z",
  "updated_at": "2026-08-10T08:00:00.000Z"
}
```

#### Field Specifications
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | String (ObjectId) | Yes | Unique identifier for announcement (transformed from `_id`). |
| `topic` | String | Yes | Title/topic summary of announcement (trimmed). |
| `description` | String | Yes | Detailed body text of announcement (trimmed). |
| `created_by` | String (ObjectId) | Yes | Member ID of creator. |
| `updated_by` | String (ObjectId) | No | Member ID of last modifier (default: `null`). |
| `created_at` | Date / ISO String | Yes | Timestamp of creation. |
| `updated_at` | Date / ISO String | Yes | Timestamp of last modification. |

---

## 4. Endpoints & Route Definitions

### 4.1 List Announcements (Paginated)
* **Method:** `GET`
* **Endpoint:** `/api/v1/announcements`
* **Auth Required:** No (Public)
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | Integer | No | `1` | Page number for pagination. |
  | `limit` | Integer | No | `10` | Number of records per page (max: 100). |

* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "announcements": [
        {
          "id": "66b64f9e1234567890annc01",
          "topic": "Registration Open for ACES Hackathon 2026",
          "description": "Submissions are officially open! Join us for a 48-hour coding challenge.",
          "created_by": "66b64f9e1234567890user01",
          "updated_by": null,
          "created_at": "2026-08-10T08:00:00.000Z",
          "updated_at": "2026-08-10T08:00:00.000Z"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 10,
      "total_pages": 1
    },
    "error": null
  }
  ```

---

### 4.2 Get Announcement Details
* **Method:** `GET`
* **Endpoint:** `/api/v1/announcements/:id`
* **Auth Required:** No (Public)
* **URL Parameters:**
  - `id` (String, required): Valid MongoDB ObjectId of announcement.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "66b64f9e1234567890annc01",
      "topic": "Registration Open for ACES Hackathon 2026",
      "description": "Submissions are officially open! Join us for a 48-hour coding challenge.",
      "created_by": "66b64f9e1234567890user01",
      "updated_by": null,
      "created_at": "2026-08-10T08:00:00.000Z",
      "updated_at": "2026-08-10T08:00:00.000Z"
    },
    "error": null
  }
  ```
* **Error Scenarios:**
  - `400 Bad Request` (`INVALID_INPUT`): Malformed ObjectId format.
  - `404 Not Found` (`NOT_FOUND`): Announcement not found.

---

### 4.3 Create Announcement
* **Method:** `POST`
* **Endpoint:** `/api/v1/announcements`
* **Auth Required:** Yes
* **Authority:** `announcements.create` (Roles: `marketing_team`, `admin`)
* **Request Body:**
  ```json
  {
    "topic": "Registration Open for ACES Hackathon 2026",
    "description": "Submissions are officially open! Join us for a 48-hour coding challenge."
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "66b64f9e1234567890annc01",
      "topic": "Registration Open for ACES Hackathon 2026",
      "description": "Submissions are officially open! Join us for a 48-hour coding challenge.",
      "created_by": "66b64f9e1234567890user01",
      "updated_by": null,
      "created_at": "2026-08-10T08:00:00.000Z",
      "updated_at": "2026-08-10T08:00:00.000Z"
    },
    "error": null
  }
  ```
* **Error Scenarios:**
  - `400 Bad Request` (`INVALID_INPUT`): Missing `topic` or `description`.

---

### 4.4 Update Announcement
* **Method:** `PUT`
* **Endpoint:** `/api/v1/announcements/:id`
* **Auth Required:** Yes
* **Authority:** `announcements.update` (Roles: `marketing_team`, `admin`)
* **Request Body:**
  ```json
  {
    "topic": "Registration Open for ACES Hackathon 2026 (Extended)",
    "description": "Deadline extended to August 25th!"
  }
  ```
* **Success Response (`200 OK`):** Updated announcement object payload.

---

### 4.5 Delete Announcement
* **Method:** `DELETE`
* **Endpoint:** `/api/v1/announcements/:id`
* **Auth Required:** Yes
* **Authority:** `announcements.delete` (Roles: `marketing_team`, `admin`)
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "deleted": true,
      "id": "66b64f9e1234567890annc01"
    },
    "error": null
  }
  ```

---

## 5. Public Service Interface Reference

Inter-module calls within the ACES API platform must import `AnnouncementsService` from [`announcements/index.js`](file:///home/yashj/cross-root/aces/aces_api/announcements/index.js).

```js
import { AnnouncementsService } from './announcements/index.js';
```

| Method | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `createAnnouncement(data, user)` | `data: Object, user: Object` | `Promise<Object>` | Programmatically creates announcement. |
| `listAnnouncements(params)` | `params: { page, limit }` | `Promise<Object>` | Retrieves paginated announcements. |
| `getAnnouncementById(id)` | `id: String` | `Promise<Object>` | Fetches single announcement details by ID. |
| `updateAnnouncement(id, data, user)` | `id: String, data: Object, user: Object` | `Promise<Object>` | Updates topic/description and records editor. |
| `deleteAnnouncement(id)` | `id: String` | `Promise<Object>` | Deletes announcement by ID. |
