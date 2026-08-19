# ACES Forms API Documentation

Comprehensive API specifications and developer reference documentation for the **Forms** module of the ACES API platform.

---

## 1. Overview & Architecture

The **Forms Module** (`forms/`) provides dynamic form management, schema validation, serial-ordered question structures (textual, multiple choice, file upload), public/authenticated response submissions, and response aggregation.

### Architectural Boundaries & Encapsulation
* **Public Service Interface ([`forms/index.js`](file:///home/yashj/cross-root/aces/aces_api/forms/index.js))**: Exports `FormsService` for inter-module programmatic calls (e.g. event registration forms in the `events` module) and orchestration workflows.
* **HTTP Layer ([`forms/http/`](file:///home/yashj/cross-root/aces/aces_api/forms/http))**: Defines Express routes ([`forms.routes.js`](file:///home/yashj/cross-root/aces/aces_api/forms/http/forms.routes.js)) and HTTP controller handlers ([`forms.controller.js`](file:///home/yashj/cross-root/aces/aces_api/forms/http/forms.controller.js)).
* **Internal Layer ([`forms/internal/`](file:///home/yashj/cross-root/aces/aces_api/forms/internal))**: Contains Mongoose models for forms ([`form.model.js`](file:///home/yashj/cross-root/aces/aces_api/forms/internal/form.model.js)), questions ([`question.model.js`](file:///home/yashj/cross-root/aces/aces_api/forms/internal/question.model.js)), responses ([`response.model.js`](file:///home/yashj/cross-root/aces/aces_api/forms/internal/response.model.js)), and business logic ([`forms.service.internal.js`](file:///home/yashj/cross-root/aces/aces_api/forms/internal/forms.service.internal.js)).

> [!IMPORTANT]
> External modules must interact with Forms only via `FormsService` exported in [`forms/index.js`](file:///home/yashj/cross-root/aces/aces_api/forms/index.js). Direct imports from `forms/internal/*` are strictly forbidden.

---

## 2. General Specifications

### Base URLs
* **Development:** `http://localhost:5000/api/v1/forms`
* **Production:** `https://api.aces.association/api/v1/forms`

### Authentication & Authorization
* **Authorization Header:**
  ```http
  Authorization: Bearer <JWT_TOKEN>
  ```
* **Cookie Auth:** `jwt` HTTP-Only cookie.
* **Authority Configuration (`authorities.json`):**
  - Authority: `"forms.*"` -> Allowed roles: `["event_team", "editorial_team", "admin"]`

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
| `INVALID_INPUT` | `400 Bad Request` | Missing required fields, invalid form ID, validation rule breach. |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing or invalid JWT token when authentication is required. |
| `FORBIDDEN` | `403 Forbidden` | Authenticated user lacks required roles/authorities (`editorial_team`, `event_team`, `admin`). |
| `NOT_FOUND` | `404 Not Found` | Requested form or form response does not exist. |
| `INTERNAL_ERROR` | `500 Internal Error` | Unexpected backend server error. |

---

## 3. Data Models & Schemas

### 3.1 Form Schema (`Form`)

```json
{
  "form_id": "66b64f9e1234567890abcdef",
  "title": "ACES Annual Hackathon Registration",
  "description": "Registration form for team applications and track selection.",
  "is_active": true,
  "question_ids": [
    "66b64f9e1234567890aaaa01",
    "66b64f9e1234567890aaaa02"
  ],
  "created_by": "66b64f9e1234567890user01",
  "updated_by": null,
  "createdAt": "2026-08-10T10:00:00.000Z",
  "updatedAt": "2026-08-10T10:00:00.000Z"
}
```

#### Form Field Specifications
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `form_id` | String (ObjectId) | Yes | Unique identifier for form (transformed from `_id`). |
| `title` | String | Yes | Title of the form (trimmed). |
| `description` | String | No | Detailed instructions or context (default: `""`). |
| `is_active` | Boolean | No | Indicates whether form accepts responses (default: `true`). |
| `question_ids` | Array[ObjectId] | No | Array of associated Question document IDs. |
| `created_by` | String (ObjectId) | No | Member ID of creator. |
| `updated_by` | String (ObjectId) | No | Member ID of last editor. |

---

### 3.2 Question Schema (`Question`)

```json
{
  "question_id": "66b64f9e1234567890aaaa01",
  "form_id": "66b64f9e1234567890abcdef",
  "question_serial": 1,
  "question_statement": "Select your domain track",
  "question_type": "multiple_choice",
  "is_required": true,
  "textual_policy": {
    "max_len": 500
  },
  "multiple_choice_policy": {
    "type": "Single",
    "options": ["Artificial Intelligence", "Web Architecture", "Cybersecurity"]
  },
  "file_policy": {
    "supported_types": ["pdf", "zip"],
    "max_size_mb": 5
  }
}
```

#### Question Field Specifications
| Field | Type | Required | Enum / Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `question_id` | String (ObjectId) | Yes | | Unique identifier for question. |
| `form_id` | String (ObjectId) | Yes | | Parent form ID (indexed). |
| `question_serial` | Number | Yes | Positive integer | Order serial within form (compound unique index with `form_id`). |
| `question_statement` | String | Yes | | Prompt text for question. |
| `question_type` | String | Yes | `['textual', 'multiple_choice', 'file']` | Type of question response input. |
| `is_required` | Boolean | No | Default: `true` | Enforces mandatory submission. |
| `textual_policy.max_len` | Number | No | Default: `500` | Character limit for textual answers. |
| `multiple_choice_policy.type` | String | No | `['Single', 'Multiple']` | Choice selection constraint. |
| `multiple_choice_policy.options` | Array[String] | No | | Allowed choices list. |
| `file_policy.supported_types` | Array[String] | No | e.g. `["pdf", "png"]` | Permitted file extensions. |
| `file_policy.max_size_mb` | Number | No | Default: `5` | Max file upload limit in MB. |

---

### 3.3 Form Response Schema (`FormResponse`)

```json
{
  "response_id": "66b64f9e1234567890resp01",
  "form_id": "66b64f9e1234567890abcdef",
  "member_id": "66b64f9e1234567890user01",
  "email": "filler@example.com",
  "answers": {
    "1": ["Artificial Intelligence"],
    "2": ["https://res.cloudinary.com/aces/raw/upload/v123/proposal.pdf"]
  },
  "submitted_at": "2026-08-10T12:30:00.000Z"
}
```

---

## 4. Endpoints & Route Definitions

### 4.1 Create Form
* **Method:** `POST`
* **Endpoint:** `/api/v1/forms`
* **Auth Required:** Yes
* **Roles / Authorities:** `editorial_team`, `event_team`, `admin`
* **Request Body:**
  ```json
  {
    "title": "ACES Annual Hackathon Registration",
    "description": "Please fill out your team registration details.",
    "questions": [
      {
        "question_serial": 1,
        "question_statement": "What is your team name?",
        "question_type": "textual",
        "is_required": true,
        "textual_policy": { "max_len": 100 }
      },
      {
        "question_serial": 2,
        "question_statement": "Select preferred track",
        "question_type": "multiple_choice",
        "is_required": true,
        "multiple_choice_policy": {
          "type": "Single",
          "options": ["AI/ML", "Web Architecture", "Cloud Infrastructure"]
        }
      },
      {
        "question_serial": 3,
        "question_statement": "Upload project proposal (PDF)",
        "question_type": "file",
        "is_required": false,
        "file_policy": {
          "supported_types": ["pdf"],
          "max_size_mb": 10
        }
      }
    ]
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "66b64f9e1234567890abcdef",
      "title": "ACES Annual Hackathon Registration",
      "description": "Please fill out your team registration details.",
      "question_count": 3,
      "created_at": "2026-08-10T10:00:00.000Z"
    },
    "error": null
  }
  ```
* **Error Scenarios:**
  - `400 Bad Request` (`INVALID_INPUT`): Title missing, empty questions array, duplicate `question_serial`, or invalid `question_type`.

---

### 4.2 List Forms (Paginated)
* **Method:** `GET`
* **Endpoint:** `/api/v1/forms`
* **Auth Required:** Optional (`optionalAuthenticate`)
* **Query Parameters:**
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `page` | Integer | No | `1` | Page number for pagination. |
  | `limit` | Integer | No | `10` | Number of records per page (max: 100). |
  | `is_active` | Boolean | No | `undefined` | Filter forms by active status (`true`/`false`). |

* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "forms": [
        {
          "form_id": "66b64f9e1234567890abcdef",
          "title": "ACES Annual Hackathon Registration",
          "description": "Please fill out your team registration details.",
          "is_active": true,
          "question_count": 3,
          "created_at": "2026-08-10T10:00:00.000Z"
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

### 4.3 Get Form Details & Questions
* **Method:** `GET`
* **Endpoint:** `/api/v1/forms/:form_id`
* **Auth Required:** Optional (`optionalAuthenticate`)
* **URL Parameters:**
  - `form_id` (String, required): Valid MongoDB ObjectId of the form.
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "66b64f9e1234567890abcdef",
      "title": "ACES Annual Hackathon Registration",
      "description": "Please fill out your team registration details.",
      "is_active": true,
      "questions": [
        {
          "question_id": "66b64f9e1234567890aaaa01",
          "question_serial": 1,
          "question_statement": "What is your team name?",
          "question_type": "textual",
          "is_required": true,
          "textual_policy": { "max_len": 100 },
          "multiple_choice_policy": { "type": "Single", "options": [] },
          "file_policy": { "supported_types": [], "max_size_mb": 5 }
        }
      ],
      "created_at": "2026-08-10T10:00:00.000Z",
      "updated_at": "2026-08-10T10:00:00.000Z"
    },
    "error": null
  }
  ```
* **Error Scenarios:**
  - `400 Bad Request` (`INVALID_INPUT`): Malformed `form_id`.
  - `404 Not Found` (`NOT_FOUND`): Form with specified `form_id` does not exist.

---

### 4.4 Update Form
* **Method:** `PUT`
* **Endpoint:** `/api/v1/forms/:form_id`
* **Auth Required:** Yes
* **Roles / Authorities:** `editorial_team`, `event_team`, `admin`
* **Request Body:** (Partial update supported for metadata; optional replacement of questions array)
  ```json
  {
    "title": "ACES Hackathon 2026 Registration (Updated)",
    "is_active": false
  }
  ```
* **Success Response (`200 OK`):** Full updated Form payload (same structure as `GET /api/v1/forms/:form_id`).

---

### 4.5 Delete Form
* **Method:** `DELETE`
* **Endpoint:** `/api/v1/forms/:form_id`
* **Auth Required:** Yes
* **Roles / Authorities:** `editorial_team`, `event_team`, `admin`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "66b64f9e1234567890abcdef",
      "message": "Form and all associated data deleted successfully."
    },
    "error": null
  }
  ```

---

### 4.6 Submit Form Response
* **Method:** `POST`
* **Endpoint:** `/api/v1/forms/:form_id/responses`
* **Auth Required:** Optional (`optionalAuthenticate` - attaches `member_id` if logged in)
* **Request Body:**
  ```json
  {
    "email": "filler@example.com",
    "answers": {
      "1": ["Binary Beasts"],
      "2": ["AI/ML"],
      "3": ["https://res.cloudinary.com/aces/raw/upload/v123/proposal.pdf"]
    }
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "response_id": "66b64f9e1234567890resp01",
      "form_id": "66b64f9e1234567890abcdef",
      "email": "filler@example.com",
      "submitted_at": "2026-08-10T12:30:00.000Z"
    },
    "error": null
  }
  ```
* **Error Scenarios:**
  - `400 Bad Request` (`INVALID_INPUT`):
    - Form filler `email` is missing or invalid.
    - Response already submitted for this email address on this form.
    - Form is inactive (`is_active = false`).
    - Missing answer for a required question.
    - Textual answer exceeds `max_len`.
    - Multiple choice selection invalid or selecting multiple options when `Single` is required.
    - File extension not supported in `supported_types`.

---

### 4.7 Check Response Existence by Email
* **Method:** `GET`
* **Endpoint:** `/api/v1/forms/:form_id/responses/check`
* **Auth Required:** Optional (`optionalAuthenticate`)
* **Query Parameters:**
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `email` | String | Yes | Email address of the form filler to query. |

* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "66b64f9e1234567890abcdef",
      "email": "filler@example.com",
      "exists": true
    },
    "error": null
  }
  ```
* **Error Scenarios:**
  - `400 Bad Request` (`INVALID_INPUT`): Missing `email` query parameter or invalid `form_id`.
  - `404 Not Found` (`NOT_FOUND`): Form not found.

---

### 4.7 Get All Responses for Form
* **Method:** `GET`
* **Endpoint:** `/api/v1/forms/:form_id/responses`
* **Auth Required:** Yes
* **Roles / Authorities:** `editorial_team`, `event_team`, `admin`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "66b64f9e1234567890abcdef",
      "title": "ACES Annual Hackathon Registration",
      "total_responses": 1,
      "responses": [
        {
          "response_id": "66b64f9e1234567890resp01",
          "form_id": "66b64f9e1234567890abcdef",
          "member_id": "66b64f9e1234567890user01",
          "answers": {
            "1": ["Binary Beasts"],
            "2": ["AI/ML"]
          },
          "submitted_at": "2026-08-10T12:30:00.000Z"
        }
      ]
    },
    "error": null
  }
  ```

---

### 4.8 Get Single Form Response
* **Method:** `GET`
* **Endpoint:** `/api/v1/forms/:form_id/responses/:response_id`
* **Auth Required:** Yes
* **Roles / Authorities:** `editorial_team`, `event_team`, `admin`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "response_id": "66b64f9e1234567890resp01",
      "form_id": "66b64f9e1234567890abcdef",
      "member_id": "66b64f9e1234567890user01",
      "answers": {
        "1": ["Binary Beasts"],
        "2": ["AI/ML"]
      },
      "submitted_at": "2026-08-10T12:30:00.000Z"
    },
    "error": null
  }
  ```

---

## 5. Public Service Interface Reference

Inter-module calls within the ACES API platform must import `FormsService` from [`forms/index.js`](file:///home/yashj/cross-root/aces/aces_api/forms/index.js).

```js
import { FormsService } from './forms/index.js';
```

| Method | Parameters | Returns | Description |
| :--- | :--- | :--- | :--- |
| `createForm(data)` | `data: Object` | `Promise<Object>` | Programmatically creates form & question schemas. |
| `getFormById(formId)` | `formId: String` | `Promise<Object>` | Fetches form details & populated questions by ID. |
| `getForms(params)` | `params: { page, limit, is_active }` | `Promise<Object>` | Retrieves paginated form summaries. |
| `updateForm(formId, updateData, userId)` | `formId, updateData, userId` | `Promise<Object>` | Updates metadata & updates/replaces question definitions. |
| `deleteForm(formId)` | `formId: String` | `Promise<Object>` | Cascades deletion of form, questions, and responses. |
| `submitResponse(formId, memberId, answers)` | `formId, memberId, answers` | `Promise<Object>` | Validates & persists submitted response answers. |
| `getFormResponses(formId)` | `formId: String` | `Promise<Object>` | Fetches all submitted responses for a form. |
| `getSingleResponse(formId, responseId)` | `formId, responseId` | `Promise<Object>` | Fetches single response by ID. |
