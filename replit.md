# replit.md

## Overview

ShapeSortAI is a full-stack web application that classifies geometric shapes in uploaded images using purely local OpenCV computer vision — no external AI APIs needed. Users upload an image (including real camera photos of 3D objects), and the system detects the primary shape (Circle, Square, Triangle, Rectangle, or Other) and assigns a numbered container (1-4). Results are stored in a PostgreSQL database and displayed in a dashboard UI.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + Vite)
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: `wouter` for client-side routing (single page: Home + 404)
- **State Management**: `@tanstack/react-query` for server state (fetching classifications, mutations for uploads)
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support), custom color tokens for container colors
- **Animations**: Framer Motion for smooth transitions on result cards and upload interactions
- **Icons**: Lucide React
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`
- **Key pages**: Home page with drag-and-drop image upload (Dropzone component), latest result display, and classification history

### Backend (Express + Node.js)
- **Framework**: Express 5 on Node.js, written in TypeScript, run with `tsx`
- **API Design**: RESTful API at `/api/classifications` (GET for list, POST with FormData for upload)
- **File Uploads**: Multer middleware handling image uploads to an `uploads/` directory (5MB limit)
- **Shape Classification**: Purely local OpenCV computer vision via Python script (`server/lib/image_processor.py`), spawned as a child process. Uses smart multi-strategy detection:
  - 5 segmentation strategies (adaptive Gaussian/Mean, Otsu, Canny, GrabCut)
  - Ensemble voting system across multiple metrics (circularity, fill ratios, vertex counts, Hough circle confirmation)
  - Contour-mask color sampling with HSV classification
  - Best-contour scoring by solidity, area, and centrality
  - Container mapping: Circle=1, Square=2, Triangle/Rectangle=3, Other=4
- **Static Serving**: In production, serves built client assets from `dist/public`; in development, uses Vite dev server with HMR
- **Build**: Custom build script using esbuild for server bundling and Vite for client bundling

### Shared Code (`shared/`)
- **Schema** (`shared/schema.ts`): Drizzle ORM table definitions and Zod validation schemas
- **Routes** (`shared/routes.ts`): API route definitions with Zod response schemas, shared between client and server
- **Chat Models** (`shared/models/chat.ts`): Additional tables for conversations/messages (Replit AI integration scaffolding)

### Database (PostgreSQL + Drizzle ORM)
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Connection**: `pg` Pool using `DATABASE_URL` environment variable
- **Schema Push**: `npm run db:push` uses drizzle-kit to push schema changes
- **Main Table**: `classifications` table with columns: `id` (serial PK), `image_url` (text), `detected_shape` (varchar 50), `container_color` (varchar 20), `confidence` (text, optional), `created_at` (timestamp)
- **Additional Tables**: `conversations` and `messages` tables for chat functionality (from Replit integrations)

### Storage Pattern
- `IStorage` interface in `server/storage.ts` defines the data access contract
- `DatabaseStorage` class implements it with Drizzle queries
- Exported as singleton `storage` instance

### Replit Integrations (`server/replit_integrations/` and `client/replit_integrations/`)
- Pre-built modules for chat, audio/voice, image generation, and batch processing
- These are scaffolding from Replit AI integrations and may not all be actively used by the core app
- Chat storage uses the conversations/messages tables from shared schema

## External Dependencies

### Required Services
- **PostgreSQL Database**: Connected via `DATABASE_URL` environment variable. Must be provisioned for the app to start.
- **OpenAI API** (via Replit AI Integrations): Used for image classification with GPT-4o vision. Configured through `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables.

### Python Dependencies (for fallback image processing)
- **OpenCV** (`cv2`): Used in `server/lib/image_processor.py` for shape detection via contour analysis and Hough circle transform
- **NumPy**: Required by OpenCV

### Key NPM Packages
- `express` (v5) - HTTP server
- `drizzle-orm` + `drizzle-kit` - Database ORM and migrations
- `multer` - File upload handling
- `openai` - OpenAI API client
- `@tanstack/react-query` - Client-side data fetching
- `wouter` - Client-side routing
- `framer-motion` - Animations
- `zod` + `drizzle-zod` - Schema validation
- `connect-pg-simple` - PostgreSQL session store (available but may not be actively used)

### Development Tools
- `vite` + `@vitejs/plugin-react` - Frontend build/dev server
- `tsx` - TypeScript execution for Node.js
- `esbuild` - Server bundling for production
- `tailwindcss` + `postcss` + `autoprefixer` - CSS processing