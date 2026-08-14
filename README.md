# ACES API 

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-brightgreen.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4.19-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%20v8-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Monolith-orange.svg)](#architecture--design-principles)

A robust, enterprise-grade **Modular Monolith Backend API** powering the digital ecosystem of the **ACES Student Association** (Association of Computer Engineering Students). Built with **Node.js**, **Express**, **MongoDB/Mongoose**, and ES Modules.

---

##  Table of Contents

- [Overview](#overview)
- [Architecture & Design Principles](#architecture--design-principles)
- [Core Features & Modules](#core-features--modules)
- [Tech Stack & Dependencies](#tech-stack--dependencies)
- [Directory Structure](#directory-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Server](#running-the-server)
- [API Reference Summary](#api-reference-summary)
- [Testing & Code Quality](#testing--code-quality)
- [Docker & Containerization](#docker--containerization)
- [Detailed Documentation](#detailed-documentation)
- [License](#license)

---

##  Overview

The **ACES API** serves as the centralized backend service for managing student membership, events, showcase gallery collections, dynamic form surveys, and announcements for the ACES Association.

Key features include:
- **RBAC Authentication & Security**: JWT-based authentication with granular role/authority permissions.
- **Bulk Member Onboarding**: Automated member registration via published Google Sheet CSV URLs.
- **Controlled Event Management**: Event lifecycle management with capped highlight slots for homepage feature displays.
- **Showcase Gallery**: Media uploads (photos & videos) backed by Cloudinary with collection-based filtering.
- **Dynamic Form Builder**: Custom field definitions and submission tracking.
- **Targeted Announcements**: Priority pinning and audience-based notice broadcasts.

---

##  Architecture & Design Principles

The application is structured as a **Modular Monolith**:
- **Domain Isolation**: Each business domain (`iam`, `events`, `gallery`, `forms`, `announcements`) operates within its dedicated directory containing entity models, services, controllers, and routes.
- **Cross-Domain Communication**: Inter-module calls are routed strictly via internal service facades (e.g., `IAMService`) rather than raw model access.
- **Orchestration Layer**: Express routing, global middleware (Helmet, CORS, logging, error handling), and HTTP server bootstrapping are handled under `orchestration/`.
- **Shared Utilities**: Common response formatters, custom error classes, database connectors, and mailers reside in `shared/`.

---

##  Core Features & Modules

###  1. Identity & Access Management (IAM)
- User authentication via JWT tokens and bcrypt password hashing.
- Role-based Access Control (RBAC) supporting custom administrative authorities.
- Password reset workflow with email verification tokens via Nodemailer.
- **Google Sheet CSV Bulk Member Registration**: Admins can import members directly from published Google Sheet URLs.

###  2. Events Management
- Complete CRUD operations for association workshops, hackathons, and technical events.
- **Highlight Enforcer**: System caps featured/highlighted events to a maximum of **4 active highlights** for homepage showcase.
- Event RSVP and member registration management.

###  3. Gallery Showcase
- Image and video file upload using `Multer` memory storage and `Cloudinary` cloud streaming.
- Categorization by collection names (e.g., "Hackathon 2026", "Freshers 2025").
- Public endpoints for fetching grouped showcase media.

###  4. Forms & Responses
- Admin creation of dynamic survey and registration forms with customized fields.
- Public form rendering and response submission tracking.
- CSV / JSON extraction of form responses.

###  5. Announcements
- Notice broadcasting for general members, specific teams, or public visibility.
- Priority pinning toggle for featuring urgent announcements.

---

##  Tech Stack & Dependencies

| Category | Technologies / Libraries |
| :--- | :--- |
| **Runtime & Core** | Node.js (v20+ ES Modules), Express.js (v4.19) |
| **Database** | MongoDB, Mongoose ODM (v8.3) |
| **Authentication & Security** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors` |
| **File Storage & Mail** | Cloudinary (v2.0), Multer (v2.2), Nodemailer (v9.0) |
| **Logging & Utilities** | Morgan, Dotenv |
| **Testing & Quality** | Node.js Native Test Runner (`node --test`), `mongodb-memory-server`, ESLint (v9) |
| **Containerization** | Docker (Alpine Multi-Stage Build) |

---

##  Directory Structure

```
aces_api/
├── announcements/            # Notice & announcement module
│   ├── http/                 # Controllers & router
│   ├── internal/             # Domain logic & models
│   └── index.js              # Module export facade
├── events/                   # Events & RSVP module
│   ├── http/                 # Controllers & router
│   ├── internal/             # Event model & validation logic
│   └── index.js              # Module export facade
├── forms/                    # Dynamic form builder module
│   ├── http/                 # Controllers & router
│   ├── internal/             # Form & response models
│   └── index.js              # Module export facade
├── gallery/                  # Media showcase module
│   ├── http/                 # Upload & gallery controllers
│   ├── internal/             # Media models & Cloudinary service
│   └── index.js              # Module export facade
├── iam/                      # Identity & Access Management module
│   ├── http/                 # Auth & profile routes/controllers
│   ├── internal/             # User model, auth & bulk register logic
│   └── index.js              # Module export facade
├── orchestration/            # Application bootstrap & middleware
│   └── http/                 # Express app setup, CORS, Helmet, router engine
├── shared/                   # Cross-cutting utilities
│   ├── config/               # Environment configuration loader
│   ├── errors/               # Standardized error definitions
│   └── utils/                # DB client, mailer, response formatter
├── docs/                     # Detailed API specifications & guides
├── test/                     # Integration test suites using mongodb-memory-server
├── authorities.json          # System RBAC role/authority configuration
├── Dockerfile                # Multi-stage Docker deployment definition
├── server.js                 # HTTP server entry point & graceful shutdown
└── package.json              # Project dependencies & scripts
```

---

##  Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment mode (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP server listening port | `5000` |
| `CLIENT_ORIGIN` | Allowed origin URL for CORS policy | `http://localhost:3000` |
| `MONGO_URI` | MongoDB connection URI string | `mongodb://localhost:27017/aces_db` |
| `JWT_SECRET` | Secret key for signing authentication JWT tokens | `super_secret_jwt_key` |
| `JWT_EXPIRES_IN` | JWT token expiration duration | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `your_api_secret` |
| `INIT_ADMIN_EMAIL` | Initial root admin email address for auto-seeding | `admin@aces.org` |
| `INIT_ADMIN_PASSWORD` | Initial root admin password for auto-seeding | `Admin@123456` |
| `SMTP_HOST` | SMTP server host address | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port number | `587` |
| `SMTP_USER` | SMTP authentication user | `your_email@gmail.com` |
| `SMTP_PASS` | SMTP authentication app password | `your_app_password` |
| `SMTP_FROM` | Sender display string for emails | `"ACES Association"` |

---

##  Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: Active local instance or MongoDB Atlas URI

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ACES-PVGCOET/aces-api.git
   cd aces-api
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy `.env.example` to `.env` and fill in your database and SMTP/Cloudinary credentials.

### Running the Server

- **Development Mode** (with automatic reloading via `nodemon`):
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

Once running, the server output will confirm connection to MongoDB and display:
```
[Server] ACES API running in 'development' mode on port 5000
[Server] Health Check available at http://localhost:5000/health
```

---

##  API Reference Summary

All API endpoints are hosted under the base prefix `/api/v1`.

###  System & Health
- `GET /health` - Service health status check
- `GET /api/v1/health` - API version check

###  Authentication & IAM (`/api/v1/iam`)
- `POST /api/v1/iam/login` - User login
- `POST /api/v1/iam/register` - New user registration
- `POST /api/v1/iam/bulk-register` - Admin bulk registration from Google Sheet CSV URL
- `POST /api/v1/iam/forgot-password` - Request password reset link
- `POST /api/v1/iam/reset-password` - Reset password via token
- `GET /api/v1/iam/profile` - Fetch current user profile
- `PATCH /api/v1/iam/profile` - Update user profile
- `GET /api/v1/iam/members` - Retrieve member directory (Admin)

###  Events (`/api/v1/events`)
- `GET /api/v1/events` - List all events (filterable by category/status)
- `GET /api/v1/events/highlights` - Retrieve featured homepage events (Max 4)
- `GET /api/v1/events/:id` - Fetch single event details
- `POST /api/v1/events` - Create event (Admin)
- `PUT /api/v1/events/:id` - Update event (Admin)
- `DELETE /api/v1/events/:id` - Remove event (Admin)
- `POST /api/v1/events/:id/rsvp` - Register / RSVP for event

###  Gallery (`/api/v1/gallery`)
- `GET /api/v1/gallery` - Fetch media showcase items by collection or full list
- `POST /api/v1/gallery` - Upload media photo/video to Cloudinary (Admin)
- `DELETE /api/v1/gallery/:id` - Delete media item (Admin)

###  Forms (`/api/v1/forms`)
- `GET /api/v1/forms` - List active forms
- `GET /api/v1/forms/:id` - Get form definition
- `POST /api/v1/forms` - Create dynamic form (Admin)
- `POST /api/v1/forms/:id/submit` - Submit form response
- `GET /api/v1/forms/:id/responses` - Get form submissions (Admin)

###  Announcements (`/api/v1/announcements`)
- `GET /api/v1/announcements` - List notices
- `POST /api/v1/announcements` - Create notice (Admin)
- `PATCH /api/v1/announcements/:id/pin` - Toggle priority pin (Admin)
- `DELETE /api/v1/announcements/:id` - Delete notice (Admin)

---

##  Testing & Code Quality

The test suite utilizes Node's built-in test runner (`node --test`) along with `mongodb-memory-server` to run fully isolated integration tests without requiring an external MongoDB instance.

### Run All Integration Tests
```bash
npm test
```

### Run Linter
```bash
npm run lint
```

---

## 🐳 Docker & Containerization

The repository includes an optimized multi-stage [Dockerfile](file:///home/yashj/cross-root/aces/aces_api/Dockerfile) based on `node:20-alpine` for production deployments.

### Build Docker Image
```bash
docker build -t aces-api:latest .
```

### Run Docker Container
```bash
docker run -d \
  --name aces-api \
  -p 5000:5000 \
  --env-file .env \
  aces-api:latest
```

The container automatically includes periodic HTTP health checks against `/health`.

---

## 📄 Detailed Documentation

For comprehensive API specifications, data contracts, schema diagrams, and developer guides, consult the documents in the [`docs/`] directory:

- [API Reference Specification](docs/API_DOCS.md)
- [API Architecture Design](docs/API_DESIGN_DOCS.md)

---

## 📜 License

This project is licensed under the **ISC License**. Developed & maintained by the **ACES Web and Tech Team**.
