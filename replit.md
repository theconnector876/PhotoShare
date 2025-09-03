# The Connector Photography

## Overview

The Connector Photography is a professional photography booking and portfolio management system built for photographers operating in Jamaica. The application provides a comprehensive platform for clients to book photography sessions, view portfolios, and access their photo galleries through a secure access system. The system handles multiple service types including photoshoots, weddings, and events with tiered package pricing and add-on services.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side application is built with React and TypeScript using Vite as the build tool. The architecture follows a modern component-based approach:
- **UI Framework**: React with TypeScript for type safety
- **Component Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Hook Form for form state, TanStack Query for server state
- **Build System**: Vite with hot module replacement and development server

The frontend implements a responsive design with mobile-first approach, featuring animated backgrounds, interactive components, and a cohesive Jamaica-themed color palette (greens, yellows, golds).

### Backend Architecture
The server-side is built with Express.js and follows RESTful API principles:
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware for logging, JSON parsing, and error handling
- **Database Layer**: Drizzle ORM with PostgreSQL as the database engine
- **Storage Strategy**: In-memory storage implementation with interface for easy swapping to persistent database
- **API Structure**: Resource-based endpoints for bookings, galleries, and contact messages

### Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations:
- **ORM**: Drizzle with migrations support via drizzle-kit
- **Database**: PostgreSQL (configured for Neon Database)
- **Schema Management**: Centralized schema definitions with Zod validation
- **Connection**: Serverless-friendly database connection using @neondatabase/serverless

### Authentication and Authorization
The application implements a simple access-based system:
- **Gallery Access**: Email + access code combination for client gallery access
- **Admin Functions**: Basic user authentication system with username/password
- **Session Management**: Express sessions with PostgreSQL session store

### Key Data Models
- **Users**: Admin user accounts for managing the system
- **Bookings**: Complete booking information including client details, service types, pricing
- **Galleries**: Photo gallery management with multiple image states (gallery, selected, final)
- **Contact Messages**: Client inquiries and communication tracking

### Business Logic
The system implements sophisticated pricing calculation:
- **Service Types**: Photoshoot, wedding, event with different pricing structures
- **Package Tiers**: Bronze, Silver, Gold, Platinum with varying features
- **Add-ons**: Video services, express delivery, drone photography
- **Transportation**: Parish-based fee calculation across Jamaica's 14 parishes

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection for serverless environments
- **drizzle-orm**: Type-safe SQL query builder and ORM
- **express**: Web application framework for Node.js
- **react**: Frontend UI library
- **vite**: Build tool and development server

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for creating variant-based component APIs
- **lucide-react**: Icon library

### Form and Data Management
- **react-hook-form**: Performant forms with easy validation
- **@hookform/resolvers**: Validation resolvers for react-hook-form
- **zod**: TypeScript-first schema validation
- **@tanstack/react-query**: Data fetching and caching library

### Development and Build Tools
- **typescript**: Static type checking
- **drizzle-kit**: Database migrations and schema management
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin-***: Replit-specific development plugins

### Utility Libraries
- **date-fns**: Date manipulation and formatting
- **nanoid**: URL-safe unique string ID generator
- **clsx**: Utility for constructing className strings conditionally

The application is configured for deployment on Replit with proper environment variable management and PostgreSQL database integration.