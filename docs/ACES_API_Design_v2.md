# ACES API - Architectural & Design Specification

This document presents the finalized, refined architectural design for the **ACES API**. It serves as the official technical blueprint for the development team building the backend system for the student association.

---

## 1. Executive Summary & Architecture

The **ACES API** is built using a **Modular Monolith** pattern within a single root project. This architecture grants the operational simplicity of a single deployment unit while strictly enforcing domain isolation and package boundaries—paving a seamless path toward microservices if scaled in the future.

### Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB (Mongoose ODM)
* **Media Storage:** Cloudinary
* **Tooling & Standard:** ESLint (for package enforcement), JWT (Authentication)

---

## 2. Directory Structure & Boundary Enforcement

To prevent tight coupling and accidental leaks across domain boundaries, every domain module follows a strict **Package-Oriented Design** (`pkg` / `internal` abstraction).

```text
aces_api/
├── orchestration/          # Gateway Layer: HTTP routing, global auth, rate limiting
│   ├── orchestrator/       # Central initialization & module composition
│   └── http/               # Global middlewares & root router
├── iam/                    # Identity & Access Management Module
│   ├── index.js            # PUBLIC INTERFACE (Exposes IAMService to other modules)
│   ├── internal/           # PRIVATE (Schemas, DB access, internal logic)
│   └── http/               # Express routes & controllers for IAM endpoints
├── events/                 # Event Lifecycle Management Module
│   ├── index.js            # PUBLIC INTERFACE (Exposes EventsService)
│   ├── internal/           # PRIVATE (Schemas, DB access, internal logic)
│   └── http/               # Express routes & controllers for Events endpoints
├── forms/                  # Dynamic Form & Response Consolidation Module
│   ├── index.js            # PUBLIC INTERFACE (Exposes FormsService)
│   ├── internal/           # PRIVATE (Schemas, DB access, internal logic)
│   └── http/               # Express routes & controllers for Forms endpoints
├── announcements/          # Broadcast & Public News Module
│   ├── index.js            # PUBLIC INTERFACE (Exposes AnnouncementsService)
│   ├── internal/           # PRIVATE (Schemas, DB access, internal logic)
│   └── http/               # Express routes & controllers for Announcements endpoints
└── gallery/                # Media & Digital Asset Management Module
    ├── index.js            # PUBLIC INTERFACE (Exposes GalleryService)
    ├── internal/           # PRIVATE (Cloudinary integrations & schemas)
    └── http/               # Express routes for presigned upload signatures
```

### Module Boundary Rules

1. **Strict Internal Isolation:** 
   No module may directly import from another module's `internal/` directory. For instance, `events/http/events.controller.js` is strictly prohibited from importing `forms/internal/forms.model.js`.
2. **Public Interface (`index.js`):** 
   When Module A needs data or actions from Module B, it **must** call the public service function exported by Module B’s root `index.js`.
   ```javascript
   // ✅ ALLOWED: Accessing via public service contract
   import { FormsService } from '../forms/index.js';

   // ❌ PROHIBITED: Directly accessing private internal models
   import { FormModel } from '../forms/internal/forms.model.js';
   ```
3. **Automated Enforcement:** 
   Module boundaries are strictly enforced via ESLint (`eslint-plugin-import` path restrictions) during CI/CD to prevent direct cross-module file imports.

---

## 3. Module Specifications & Data Models

### 3.1 Orchestration Module (Gateway Layer)
Acts as the unified entry point for external client requests.
* **Responsibilities:** Request parsing, global error handling, centralized JWT validation, request rate limiting, and mapping unified routes (e.g., `/api/v1/events`).
* **Isolation Rule:** Keeps all Express routing composition separate from domain-level business logic.

### 3.2 IAM (Identity & Access Management)
Handles authentication, user session state, and Role-Based Access Control (RBAC) and member profiles management.
* **Roles:** `web_team`, `leader`, `tech_team`, 'media_team`, 'treasury_team`, `event_team`, `editorial_team`, `marketing_team`, `admin`.
* **Public Service API (`iam/index.js`):** `verifyToken()`, `getUserPermissions()`, `getMemberById()`.  

Example Member Schema:
```JavaScript
      "id": "60d5ecb8b5c9c22b10a1d8a1",
      "name": "Alex Mercer",
      "team": "Web Team",
      "position": "joint_head",
      "roles": ["web_team", "admin"],
      "email": "alex.mercer@college.edu",
      "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex_new.jpg",
      "social_links": {
        "linkedin": "https://linkedin.in/in/alexmercer",
        "instagram": "https://instagram.com/alex_mercer_official",
        "github": "https://github.com/alexmercer"
      }

      //hashedPassword
```

### 3.3 Events Module
Manages event listings, rules, and association schedules.
* **Authorization:** Read operations are public/member-accessible. All write operations (Create, Update, Delete) require authenticated `event_team` role.
* **Data Model (`Event`):**
  * `id`: ObjectId
  * `overview`: String (Short summary)
  * `description`: String (Detailed description/Markdown)
  * `terms`: String (Participation conditions)
  * `reg_form_id`: ObjectId (Refers to `Form` via `FormsService`)
  * `banner_url`: String (Reference to Cloudinary asset)
  * `auditing`: `{ created_by, created_at, updated_by, updated_at }`

### 3.4 Forms Module
Engine for dynamic form generation, question policy constraints, and response aggregation.
* **Authorization:** Write operations require authenticated `editorial_team` role. Read/Submit operations depend on form visibility.
* **Data Models:**
  * **Form:**
    * `id`: ObjectId
    * `title`: String
    * `question_ids`: Array of ObjectIds (Ordered references)
  * **Question:**
    * `id`: ObjectId
    * `form_id`: ObjectId
    * `question_serial`: Number (For explicit ordering)
    * `question_statement`: String
    * `question_type`: Enum (`textual`, `multiple_choice`, `file`)
    * `textual_policy`: `{ max_len: Number }`
    * `multiple_choice_policy`: `{ type: Enum('Single', 'Multiple'), options: [String] }`
    * `file_policy`: `{ supported_types: [String], max_size_mb: Number }`
  * **Response:**
    * `id`: ObjectId
    * `form_id`: ObjectId
    * `member_id`: ObjectId
    * `answers`: Map of `question_serial` -> `Array<String>`

### 3.5 Announcements Module
Handles public broadcasts and association updates.
* **Authorization:** Write operations require authenticated `marketing_team` role.
* **Data Model (`Announcement`):**
  * `id`: ObjectId
  * `topic`: String
  * `description`: String
  * `auditing`: `{ created_by, created_at, updated_by, updated_at }`

### 3.6 Gallery Module & Media Flow
Manages photos, videos, and digital magazines.
* **Presigned Upload Pattern:** To avoid clogging the Node.js single-threaded event loop with direct multi-megabyte file uploads, media processing utilizes Cloudinary presigned upload URLs.
  1. Client calls `GET /api/v1/gallery/upload-signature` (handled by `gallery/http`).
  2. `GalleryService` generates a signed payload from Cloudinary credentials.
  3. Client uploads file directly from the browser to Cloudinary CDN.
  4. Client attaches the returned Cloudinary media URL to domain requests (e.g., setting `banner_url` when creating an Event).

---

## 4. Standardized Cross-Cutting Patterns

### 4.1 Uniform API Response Format
All HTTP endpoints must respond using the standardized envelope:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### 4.2 Error Handling Structure
Errors are handled via custom application error classes (`AppError`, `ValidationError`, `UnauthorizedError`) and processed by central orchestration middleware.
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Question serial 3 exceeds maximum length constraint."
  }
}
```

### 4.3 Auditing
Auditing fields (`created_by`, `created_at`, `updated_by`, `updated_at`) are managed automatically using Mongoose plugins/hooks or orchestration interceptors to keep internal service methods clean.
