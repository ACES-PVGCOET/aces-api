# ACES API - Provisional API Documentation (Updated)

This document provides provisional API contracts (endpoints, request/response structures, authentication rules) for the **ACES API**. Frontend developers can use this spec to mock requests and build UI components in parallel with backend development.

---

## 1. General Specifications

### Base URL
* **Development:** `http://localhost:5000/api/v1`
* **Production:** `https://api.aces.association/api/v1`

### Authentication Header
Protected endpoints require a JWT Bearer token:
```text
Authorization: Bearer <your_jwt_token>
```

### Standard Response Envelopes

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

#### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You do not have permission to perform this action."
  }
}
```

---

## 2. Authentication & Member Management (`/iam`)

### 2.1 Admin Register Member
* **Method:** `POST`
* **Endpoint:** `/iam/register`
* **Auth:** Required (`admin` role)
* **Request Body:**
  ```json
  {
    "email": "alex.mercer@college.edu",
    "team": "Tech Team",
    "position": "member",
    "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex.jpg"
  }
  ```
* **Response Body (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "60d5ecb8b5c9c22b10a1d8a1",
      "name": "",
      "email": "alex.mercer@college.edu",
      "team": "Tech Team",
      "position": "member",
      "status": "NOT_ACTIVE",
      "roles": ["tech_team"],
      "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex.jpg"
    },
    "error": null
  }
  ```

### 2.2 Complete Member Onboarding
* **Method:** `POST`
* **Endpoint:** `/iam/onboard`
* **Auth:** None (Public - uses token sent in email link)
* **Request Body:**
  ```json
  {
    "token": "4f8a9e2b1c3d...",
    "password": "SecurePassword123!",
    "name": "Alex Mercer"
  }
  ```
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "60d5ecb8b5c9c22b10a1d8a1",
      "name": "Alex Mercer",
      "email": "alex.mercer@college.edu",
      "team": "Tech Team",
      "position": "member",
      "status": "ACTIVE",
      "roles": ["tech_team"],
      "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex.jpg"
    },
    "error": null
  }
  ```


### 2.2 Login
* **Method:** `POST`
* **Endpoint:** `/iam/login`
* **Auth:** None (Public)
* **Request Body:**
  ```json
  {
    "email": "alex.mercer@college.edu",
    "password": "SecurePassword123!"
  }
  ```
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "member": {
        "id": "60d5ecb8b5c9c22b10a1d8a1",
        "name": "Alex Mercer",
        "email": "alex.mercer@college.edu",
        "team": "Tech Team",
        "position": "member",
        "roles": ["tech_team"],
        "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex.jpg",
        "social_links": {
          "linkedin": "https://linkedin.in/in/alexmercer",
          "instagram": "https://instagram.com/alex_mercer",
          "github": "https://github.com/alexmercer"
        }
      }
    },
    "error": null
  }

  Cookie: JWT Token
  ```

### 2.3 Get Member Profile by ID
* **Method:** `GET`
* **Endpoint:** `/iam/members/:id`
* **Auth:** Optional / Public
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "60d5ecb8b5c9c22b10a1d8a1",
      "name": "Alex Mercer",
      "team": "Tech Team",
      "position": "head",
      "roles": ["tech_team"],
      "email": "alex.mercer@college.edu",
      "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex.jpg",
      "social_links": {
        "linkedin": "https://linkedin.in/in/alexmercer",
        "instagram": "https://instagram.com/alex_mercer",
        "github": "https://github.com/alexmercer"
      }
    },
    "error": null
  }
  ```

### 2.4 List All Members (with Filtering)
* **Method:** `GET`
* **Endpoint:** `/iam/members`
* **Auth:** Optional / Public
* **Query Params:** `?team=Tech%20Team`
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "members": [
        {
          "id": "60d5ecb8b5c9c22b10a1d8a1",
          "name": "Alex Mercer",
          "team": "Tech Team",
          "position": "joint_head",
          "roles": ["tech_team"],
          "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex.jpg",
          "social_links": {
            "linkedin": "https://linkedin.in/in/alexmercer",
            "instagram": "https://instagram.com/alex_mercer",
            "github": "https://github.com/alexmercer"
          }
        }
      ]
    },
    "error": null
  }
  ```

### 2.5 Update Member Profile (Self / Admin)
* **Method:** `PUT`
* **Endpoint:** `/iam/members/:id`
* **Auth:** Required (`member` updating self or `admin`)
* **Request Body:**
  ```json
  {
    "name": "Alex Mercer",
    "team": "Leaders",
    "position": "general_secretary",
    "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex_new.jpg",
    "social_links": {
      "linkedin": "https://linkedin.in/in/alexmercer",
      "instagram": "https://instagram.com/alex_mercer_official",
      "github": "https://github.com/alexmercer"
    }
  }
  ```
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "60d5ecb8b5c9c22b10a1d8a1",
      "name": "Alex Mercer",
      "team": "Core Committee",
      "position": "Vice President",
      "roles": ["member", "event_team"],
      "email": "alex.mercer@college.edu",
      "profile_photo_url": "https://res.cloudinary.com/aces/image/upload/v123/alex_new.jpg",
      "social_links": {
        "linkedin": "https://linkedin.in/in/alexmercer",
        "instagram": "https://instagram.com/alex_mercer_official",
        "github": "https://github.com/alexmercer"
      }
    },
    "error": null
  }
  ```

### 2.6 Delete Member
* **Method:** `DELETE`
* **Endpoint:** `/iam/members/:id`
* **Auth:** Required (`admin` role)
* **Response Body (`200 OK`):**
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

## 3. Events Module (`/events`)

### 3.1 Get All Events
* **Method:** `GET`
* **Endpoint:** `/events`
* **Auth:** Optional / Public
* **Query Params:** `?page=1&limit=10`
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "events": [
        {
          "id": "60d5ecb8b5c9c22b10a1d901",
          "overview": "Annual Hackathon 2026",
          "description": "24-hour coding challenge...",
          "terms": "Must be a college student.",
          "reg_form_id": "60d5ecb8b5c9c22b10a1d850",
          "banner_url": "https://res.cloudinary.com/aces/image/upload/v123/banner.jpg"
        }
      ],
      "pagination": { "page": 1, "limit": 10, "total": 1 }
    },
    "error": null
  }
  ```

### 3.2 Create Event
* **Method:** `POST`
* **Endpoint:** `/events`
* **Auth:** Required (`event_team` role)
* **Request Body:**
  ```json
  {
    "overview": "Web Dev Workshop",
    "description": "Learn modern backend development using Node.js.",
    "terms": "Laptops required.",
    "reg_form_id": "60d5ecb8b5c9c22b10a1d850",
    "banner_url": "https://res.cloudinary.com/aces/image/upload/v123/workshop.jpg"
  }
  ```
* **Response Body (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "60d5ecb8b5c9c22b10a1d902",
      "overview": "Web Dev Workshop",
      "description": "Learn modern backend development using Node.js.",
      "terms": "Laptops required.",
      "reg_form_id": "60d5ecb8b5c9c22b10a1d850",
      "banner_url": "https://res.cloudinary.com/aces/image/upload/v123/workshop.jpg",
      "auditing": {
        "created_by": "60d5ecb8b5c9c22b10a1d8a1",
        "created_at": "2026-08-09T16:00:00.000Z"
      }
    },
    "error": null
  }
  ```

---

## 4. Forms Module (`/forms`)

### 4.1 Create Form
* **Method:** `POST`
* **Endpoint:** `/forms`
* **Auth:** Required (`editorial_team` role)
* **Request Body:**
  ```json
  {
    "title": "Hackathon Registration Form",
    "questions": [
      {
        "question_serial": 1,
        "question_statement": "What is your team name?",
        "question_type": "textual",
        "textual_policy": { "max_len": 50 }
      },
      {
        "question_serial": 2,
        "question_statement": "Select preferred track",
        "question_type": "multiple_choice",
        "multiple_choice_policy": {
          "type": "Single",
          "options": ["AI/ML", "Web3", "Cloud/DevOps"]
        }
      },
      {
        "question_serial": 3,
        "question_statement": "Upload your resume (PDF)",
        "question_type": "file",
        "file_policy": {
          "supported_types": ["pdf"],
          "max_size_mb": 5
        }
      }
    ]
  }
  ```
* **Response Body (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "60d5ecb8b5c9c22b10a1d850",
      "title": "Hackathon Registration Form",
      "question_count": 3
    },
    "error": null
  }
  ```

### 4.2 Get Form Details
* **Method:** `GET`
* **Endpoint:** `/forms/:form_id`
* **Auth:** Required (`member` role)
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "form_id": "60d5ecb8b5c9c22b10a1d850",
      "title": "Hackathon Registration Form",
      "questions": [
        {
          "question_id": "60d5ecb8b5c9c22b10a1d851",
          "question_serial": 1,
          "question_statement": "What is your team name?",
          "question_type": "textual",
          "textual_policy": { "max_len": 50 }
        },
        {
          "question_id": "60d5ecb8b5c9c22b10a1d852",
          "question_serial": 2,
          "question_statement": "Select preferred track",
          "question_type": "multiple_choice",
          "multiple_choice_policy": {
            "type": "Single",
            "options": ["AI/ML", "Web3", "Cloud/DevOps"]
          }
        }
      ]
    },
    "error": null
  }
  ```

### 4.3 Submit Form Response
* **Method:** `POST`
* **Endpoint:** `/forms/:form_id/responses`
* **Auth:** Required (`member` role)
* **Request Body:**
  ```json
  {
    "answers": {
      "1": ["Cyber Knights"],
      "2": ["AI/ML"],
      "3": ["https://res.cloudinary.com/aces/raw/upload/v123/resume.pdf"]
    }
  }
  ```
* **Response Body (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "response_id": "60d5ecb8b5c9c22b10a1d999",
      "form_id": "60d5ecb8b5c9c22b10a1d850",
      "submitted_at": "2026-08-09T16:15:00.000Z"
    },
    "error": null
  }
  ```

---

## 5. Announcements Module (`/announcements`)

### 5.1 Create Announcement
* **Method:** `POST`
* **Endpoint:** `/announcements`
* **Auth:** Required (`marketing_team` role)
* **Request Body:**
  ```json
  {
    "topic": "Registration Open for Hackathon",
    "description": "Submit your team responses before August 20th!"
  }
  ```
* **Response Body (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "announcement_id": "60d5ecb8b5c9c22b10a1d701",
      "topic": "Registration Open for Hackathon",
      "description": "Submit your team responses before August 20th!",
      "auditing": {
        "created_by": "60d5ecb8b5c9c22b10a1d8a1",
        "created_at": "2026-08-09T16:30:00.000Z"
      }
    },
    "error": null
  }
  ```

### 5.2 Get Announcements
* **Method:** `GET`
* **Endpoint:** `/announcements`
* **Auth:** Optional / Public
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "announcement_id": "60d5ecb8b5c9c22b10a1d701",
        "topic": "Registration Open for Hackathon",
        "description": "Submit your team responses before August 20th!",
        "created_at": "2026-08-09T16:30:00.000Z"
      }
    ],
    "error": null
  }
  ```

---

## 6. Gallery & File Management (`/gallery`)

### 6.1 Get Presigned Upload Signature
* **Method:** `GET`
* **Endpoint:** `/gallery/upload-signature`
* **Auth:** Required
* **Query Params:** `?folder=events&resource_type=image`
* **Response Body (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "upload_url": "https://api.cloudinary.com/v1_1/aces-cloud/image/upload",
      "signature": "a1b2c3d4e5f6...",
      "timestamp": 1723220000,
      "api_key": "1234567890"
    },
    "error": null
  }
  ```
