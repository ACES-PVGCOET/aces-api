# ACES Membership & Fee Verification API Documentation

Comprehensive API specifications, data models, workflows, and developer reference for the **Membership & Fee Verification** module of the ACES API platform.

---

## 1. Overview & Architecture

The **Membership Module** (`membership/`) manages student association memberships, fee verification workflows, payment receipt tracking, batch imports from spreadsheets, and registration analytics.

### Architectural Boundaries & Encapsulation
* **Public Service Interface ([`membership/index.js`](file:///home/yashj/cross-root/aces/aces_api/membership/index.js))**: Exports `MembershipService`, `MembershipModel`, and domain constants (`MEMBERSHIP_STATUS`, `PAYMENT_MODES`, `RECEIPT_STATUS`).
* **HTTP Layer ([`membership/http/`](file:///home/yashj/cross-root/aces/aces_api/membership/http))**: Contains Express route definitions ([`membership.routes.js`](file:///home/yashj/cross-root/aces/aces_api/membership/http/membership.routes.js)) and HTTP request controllers ([`membership.controller.js`](file:///home/yashj/cross-root/aces/aces_api/membership/http/membership.controller.js)).
* **Internal Layer ([`membership/internal/`](file:///home/yashj/cross-root/aces/aces_api/membership/internal))**: Contains the Mongoose data schema ([`membership.model.js`](file:///home/yashj/cross-root/aces/aces_api/membership/internal/membership.model.js)) and internal domain business logic ([`membership.service.internal.js`](file:///home/yashj/cross-root/aces/aces_api/membership/internal/membership.service.internal.js)).

---

## 2. General Specifications

### Base URLs
* **Local Development:** `http://localhost:5000/api/v1/membership`
* **Production:** `https://api.aces.association/api/v1/membership`

### Standard Response Envelopes

#### Success Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

#### Error Envelope (`400`, `401`, `403`, `404`, `409`, `500`)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of the error."
  }
}
```

---

## 3. Data Model & Enumerations

### Schema Fields (`Membership`)

| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `String` | Auto | ObjectId string | Unique registration identifier |
| `full_name` | `String` | Yes | - | Full name of the student (indexed) |
| `email` | `String` | No | `""` | Student email address (lowercase, trimmed) |
| `class_name` | `String` | Yes | - | Standardized class (`SE`, `TE`, `BE`) (indexed) |
| `contact_number` | `String` | Yes | - | 10-digit normalized contact/WhatsApp number (indexed) |
| `payment_mode` | `String` | No | `"UPI"` | Mode of payment (`UPI`, `CASH`, `OTHER`) |
| `payment_date` | `String` | No | `""` | Date of payment transaction |
| `amount` | `Number` | No | `450` | Membership fee amount paid |
| `transaction_ss_url` | `String` | No | `""` | URL to uploaded screenshot/receipt |
| `status` | `String` | No | `"PENDING"` | Verification state (`PENDING`, `VERIFIED`, `REJECTED`) |
| `verified_by` | `String` | No | `""` | Name or email of verifying admin/lead |
| `verified_by_id` | `ObjectId` | No | `null` | Reference to verifying `Member` account |
| `verified_at` | `Date` | No | `null` | Timestamp when verified/rejected |
| `receipt_number` | `String` | No | `""` | Unique receipt identifier (e.g. `ACES-2026-8492`) |
| `receipt_status` | `String` | No | `"NOT_SENT"` | Delivery state (`NOT_SENT`, `QUEUED`, `SENT`) |
| `remarks` | `String` | No | `""` | Verification notes or rejection reason |
| `registration_timestamp`| `String` | No | `""` | Original form submission timestamp |
| `source` | `String` | No | `"google_form_sheet"` | Origin (`google_form_sheet`, `manual_cms`, `api_bulk_import`, `excel_file_import`) |
| `createdAt` | `Date` | Auto | Timestamp | Record creation timestamp |
| `updatedAt` | `Date` | Auto | Timestamp | Last update timestamp |

### Constants & Enumerations

```javascript
export const MEMBERSHIP_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
};

export const PAYMENT_MODES = {
  UPI: 'UPI',
  CASH: 'CASH',
  OTHER: 'OTHER',
};

export const RECEIPT_STATUS = {
  NOT_SENT: 'NOT_SENT',
  QUEUED: 'QUEUED',
  SENT: 'SENT',
};
```

---

## 4. Normalization & Data Processing

### Phone Number Normalization
* Strips all non-digit characters.
* Handles scientific notation strings exported by Excel (e.g., `7.219366476E9` $\to$ `7219366476`).
* Removes `91` country code prefix when length exceeds 10 digits to produce standard 10-digit phone numbers.

### Class Name Standardization
* `SY`, `SE`, `Second Year` $\to$ `SE`
* `TY`, `TE`, `Third Year` $\to$ `TE`
* `FINAL`, `BE`, `BTech`, `Fourth Year` $\to$ `BE`

### Automatic Receipt Number Generation
* Format: `ACES-<YEAR>-<4_DIGIT_RANDOM>` (e.g., `ACES-2026-4819`). Generated automatically upon status transition to `VERIFIED` if not manually assigned.

---

## 5. API Endpoints Reference

### 5.1 List & Filter Memberships
Retrieves a paginated list of membership registrations matching optional filter criteria, along with real-time aggregate statistics.

- **Method**: `GET`
- **Endpoint**: `/api/v1/membership`
- **Auth**: Optional
- **Query Parameters**:
  | Parameter | Type | Default | Description |
  | :--- | :--- | :--- | :--- |
  | `status` | `String` | `ALL` | Filter by status: `PENDING`, `VERIFIED`, `REJECTED`, or `ALL` |
  | `class` | `String` | `ALL` | Filter by class: `SE`, `TE`, `BE`, or `ALL` |
  | `payment_mode` | `String` | `ALL` | Filter by payment mode: `UPI`, `CASH`, `OTHER`, or `ALL` |
  | `search` | `String` | `""` | Search query across name, contact, email, and receipt number |
  | `page` | `Number` | `1` | Page number (1-indexed) |
  | `limit` | `Number` | `100` | Results per page (max `500`) |
  | `sort_by` | `String` | `newest` | Sort order: `newest`, `oldest`, `name-asc`, `name-desc` |

- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "66bc600011223344556677aa",
          "full_name": "Aditya Kulkarni",
          "email": "aditya.k@college.edu",
          "class_name": "TE",
          "contact_number": "9876543210",
          "payment_mode": "UPI",
          "payment_date": "14/08/2026",
          "amount": 450,
          "transaction_ss_url": "https://res.cloudinary.com/aces/image/upload/v1/receipt.jpg",
          "status": "VERIFIED",
          "verified_by": "Treasury Lead",
          "verified_by_id": "66bc1234567890abcdef1001",
          "verified_at": "2026-08-15T10:30:00.000Z",
          "receipt_number": "ACES-2026-4921",
          "receipt_status": "NOT_SENT",
          "remarks": "Payment confirmed in Bank Statement",
          "registration_timestamp": "14/08/2026 18:22:10",
          "source": "manual_cms",
          "createdAt": "2026-08-14T18:22:10.000Z",
          "updatedAt": "2026-08-15T10:30:00.000Z"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 100,
      "totalPages": 1,
      "stats": {
        "total": 1,
        "pending": 0,
        "verified": 1,
        "rejected": 0,
        "byClass": {
          "TE": 1
        },
        "byMode": {
          "UPI": 1
        },
        "totalCollected": 450
      }
    },
    "error": null
  }
  ```

---

### 5.2 Get Membership Statistics
Retrieves high-level counts and breakdown by class, payment mode, verification status, and total funds collected.

- **Method**: `GET`
- **Endpoint**: `/api/v1/membership/stats`
- **Auth**: Optional
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "total": 145,
      "pending": 23,
      "verified": 118,
      "rejected": 4,
      "byClass": {
        "SE": 62,
        "TE": 48,
        "BE": 35
      },
      "byMode": {
        "UPI": 135,
        "CASH": 10
      },
      "totalCollected": 53100
    },
    "error": null
  }
  ```

---

### 5.3 Get Single Membership by ID
Retrieves details of a specific membership record.

- **Method**: `GET`
- **Endpoint**: `/api/v1/membership/:id`
- **Auth**: Optional
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "66bc600011223344556677aa",
      "full_name": "Aditya Kulkarni",
      "email": "aditya.k@college.edu",
      "class_name": "TE",
      "contact_number": "9876543210",
      "payment_mode": "UPI",
      "amount": 450,
      "status": "PENDING"
    },
    "error": null
  }
  ```

---

### 5.4 Create Membership Registration
Creates a new membership registration record. Supports both JSON payloads and `multipart/form-data` with direct receipt screenshot file uploads.

- **Method**: `POST`
- **Endpoint**: `/api/v1/membership`
- **Auth**: Optional
- **Content-Type**: `application/json` or `multipart/form-data`
- **Request Body (JSON)**:
  ```json
  {
    "full_name": "Neha Patil",
    "email": "neha.patil@college.edu",
    "class_name": "SE",
    "contact_number": "9823456789",
    "payment_mode": "UPI",
    "payment_date": "15/08/2026",
    "amount": 450,
    "transaction_ss_url": "https://res.cloudinary.com/aces/image/upload/v1/ss.jpg",
    "remarks": "Transaction ID 52819203910"
  }
  ```
- **Multipart Form Upload**:
  Include file in the `receipt_file` field to automatically upload to Cloudinary.
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "66bc600011223344556677bb",
      "full_name": "Neha Patil",
      "email": "neha.patil@college.edu",
      "class_name": "SE",
      "contact_number": "9823456789",
      "payment_mode": "UPI",
      "amount": 450,
      "status": "PENDING",
      "transaction_ss_url": "https://res.cloudinary.com/aces/image/upload/v1/ss.jpg"
    },
    "error": null
  }
  ```

---

### 5.5 Verify / Reject Membership
Updates the verification state of a student membership registration. Assigns receipt numbers and timestamps automatically when verified.

- **Method**: `PATCH`
- **Endpoint**: `/api/v1/membership/:id/verify`
- **Auth**: Optional / Authenticated (`admin`, `treasury_team`, `web_team`, `leader`)
- **Request Body**:
  ```json
  {
    "status": "VERIFIED",
    "remarks": "UPI UTR verified on bank portal",
    "amount": 450,
    "receipt_number": "ACES-2026-5501"
  }
  ```
  *(Note: `receipt_number` is optional; auto-generated if omitted).*
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "66bc600011223344556677bb",
      "full_name": "Neha Patil",
      "status": "VERIFIED",
      "verified_by": "Treasury Lead",
      "verified_at": "2026-08-15T11:00:00.000Z",
      "receipt_number": "ACES-2026-5501",
      "receipt_status": "NOT_SENT",
      "remarks": "UPI UTR verified on bank portal"
    },
    "error": null
  }
  ```

---

### 5.6 Update Membership Record
Updates editable registration attributes.

- **Method**: `PUT`
- **Endpoint**: `/api/v1/membership/:id`
- **Auth**: Optional
- **Request Body**:
  ```json
  {
    "full_name": "Neha S. Patil",
    "email": "neha.patil@gmail.com",
    "amount": 450,
    "remarks": "Updated contact info"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "66bc600011223344556677bb",
      "full_name": "Neha S. Patil",
      "email": "neha.patil@gmail.com",
      "remarks": "Updated contact info"
    },
    "error": null
  }
  ```

---

### 5.7 Delete Membership Record
Deletes a membership registration from the database.

- **Method**: `DELETE`
- **Endpoint**: `/api/v1/membership/:id`
- **Auth**: Optional
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Membership record deleted successfully."
    },
    "error": null
  }
  ```

---

### 5.8 Bulk Import Registrations
Imports an array of registration records in a single batch, deduplicating records by student full name and contact number.

- **Method**: `POST`
- **Endpoint**: `/api/v1/membership/bulk-import`
- **Auth**: Optional
- **Request Body**:
  ```json
  {
    "records": [
      {
        "full_name": "Rahul Deshmukh",
        "email": "rahul.d@college.edu",
        "class_name": "BE",
        "contact_number": "9765432100",
        "payment_mode": "UPI",
        "payment_date": "14/08/2026",
        "amount": 450,
        "transaction_ss_url": "https://drive.google.com/open?id=1AbCdEfGh"
      }
    ]
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "importedCount": 1,
      "skippedCount": 0,
      "totalSubmitted": 1,
      "errors": []
    },
    "error": null
  }
  ```

---

### 5.9 Import from Local Excel Spreadsheet
Parses a local `.xlsx` responses spreadsheet file using the zero-dependency embedded parser, extracts student responses, normalizes fields, and imports new records into the database.

- **Method**: `POST`
- **Endpoint**: `/api/v1/membership/import-local-sheet`
- **Auth**: Optional
- **Request Body**:
  ```json
  {
    "file_path": "/home/aces/membership_responses.xlsx"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "importedCount": 73,
      "skippedCount": 0,
      "totalSubmitted": 73,
      "errors": []
    },
    "error": null
  }
  ```

---

## 6. Access Control & Authority Matrix

In `authorities.json`:
```json
{
  "membership.*": ["admin", "treasury_team", "web_team", "leader"]
}
```

| Route | Method | Authority Key | Allowed Roles |
| :--- | :---: | :--- | :--- |
| `/api/v1/membership` | `GET` | `*.read` | Public / All |
| `/api/v1/membership/stats` | `GET` | `*.read` | Public / All |
| `/api/v1/membership/:id` | `GET` | `*.read` | Public / All |
| `/api/v1/membership` | `POST` | `membership.create` | Public / Member Registration |
| `/api/v1/membership/:id/verify` | `PATCH` | `membership.verify` | `admin`, `treasury_team`, `web_team`, `leader` |
| `/api/v1/membership/:id` | `PUT` | `membership.update` | `admin`, `treasury_team`, `web_team`, `leader` |
| `/api/v1/membership/:id` | `DELETE` | `membership.delete` | `admin`, `treasury_team`, `web_team`, `leader` |
| `/api/v1/membership/bulk-import` | `POST` | `membership.import` | `admin`, `treasury_team`, `web_team`, `leader` |
| `/api/v1/membership/import-local-sheet` | `POST` | `membership.import` | `admin`, `treasury_team`, `web_team`, `leader` |
