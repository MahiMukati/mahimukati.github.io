---
layout: page
title: ImpulseGuard
description: Browser extension MVP with AI purchase classification and a 24-hour checkout block; fourth of 32 teams at Ibtikar Waterloo.
img: assets/img/impulseguard.jpg
importance: 1
category: creations
related_publications: false
---

## Overview

ImpulseGuard is a browser extension MVP that detects add-to-cart actions, uses the Claude API to classify purchases as needs or wants, and applies a 24-hour checkout block.

I built the MVP in **under 48 hours** for the **Ibtikar Case Competition in Waterloo in February 2026**. Our team placed **fourth among 32 teams**, presenting the technical architecture and monetization model to venture capitalists and industry investors.

## The Problem

ImpulseGuard explores how a browser extension can introduce a pause between seeing a product and buying it. The prototype focuses on detecting shopping interactions and applying a cooling-off period before checkout.

## The Solution

ImpulseGuard intervenes **before** the purchase is made. When shopping on supported sites (currently BestBuy.ca), the extension:

1. **Detects** products on the page using intelligent DOM analysis
2. **Analyzes** each product using Claude AI to determine if it's an essential purchase or impulse spending
3. **Blocks** the "Add to Cart" button with a transparent overlay when categorized as wasteful
4. **Tracks** savings over time with detailed statistics

## Features

### AI-Powered Product Analysis

- Leverages Claude AI API to understand product context beyond simple keyword matching
- Categorizes items as "normal" (essentials) or "wasteful" (impulse purchases)
- Uses a conservative blocking strategy—when uncertain, leans toward protecting the user's wallet

### Real-Time Purchase Interception

- Places transparent overlays on "Add to Cart" buttons for blocked items
- Overlays allow interception without changing the underlying product listing
- Instant analysis with loading states and visual feedback

### 24-Hour Cooling Period

- Blocked items cannot be attempted again for 24 hours
- Adds a deliberate pause before the user returns to a blocked purchase

### Comprehensive Statistics Dashboard

- Total money saved tracked over time
- Weekly savings breakdown
- Number of blocked purchases
- Total impulses detected vs. impulses resisted
- Success rate percentage
- Persistent storage using Chrome Storage API

## Technical Implementation

### Tech Stack

| Category               | Technology                              |
| ---------------------- | --------------------------------------- |
| **Frontend**           | React 19.2.4 with TypeScript            |
| **UI Library**         | Radix UI (accessible component library) |
| **Styling**            | Tailwind CSS v4 with custom theme       |
| **Build Tool**         | Vite 5.4.21                             |
| **Type Safety**        | TypeScript 5.4.5 (strict mode)          |
| **AI Integration**     | Claude AI API (Haiku model)             |
| **Storage**            | Chrome Storage API                      |
| **Extension Platform** | Chrome Manifest V3                      |

### Product Detection

The extension uses XPath selectors to identify products and "Add to Cart" buttons on target pages. Currently optimized for:

- **BestBuy.ca** – Full product detection and blocking support

Extensible architecture allows easy addition of new e-commerce platforms.

### AI Classification System

```typescript
// System prompt for purchase classification
"You are a purchase analyzer. Determine if a product is:
- NORMAL: Groceries, essentials, planned purchases
- WASTEFUL: Impulse items, luxury goods, unnecessary purchases

When uncertain, categorize as WASTEFUL to protect the user."
```

### State Management

- Local persistence using `chrome.storage.local`
- Tracks blocked items with timestamps for 24-hour rule enforcement
- Duplicate prevention to avoid double-counting blocked purchases

### Design System

Custom theme with:

- **Primary**: Emerald greens (money/savings association)
- **Accent**: Gold (wealth/value)
- Clean, modern interface with accessible components via Radix UI

## Development

### Build System

```bash
# Development with hot reload
npm run dev

# Production build
npm run build

# Load unpacked extension
# Load the 'dist' folder in Chrome://extensions
```

### Key Dependencies

- `@radix-ui/themes` – Accessible UI components
- `webextension-polyfill` – Cross-browser compatibility
- `@vitejs/plugin-react` – Fast React development with Vite
- `tailwindcss` – Utility-first CSS framework

## Impact & Future Roadmap

### Current Capabilities

- Real-time impulse purchase detection
- AI-powered product categorization
- Comprehensive savings tracking
- 24-hour cooling period enforcement

### Planned Enhancements

- Support for additional e-commerce platforms (Amazon, Walmart, etc.)
- User customization of sensitivity levels
- Category-based blocking (e.g., always block electronics, never block groceries)
- Spending alerts and budget integration
- Export savings data for financial planning tools
- Community-shared "impulse patterns" for improved detection

## Source Availability

The source code is not publicly available. [Get in touch](mailto:mahi.mukati@mail.utoronto.ca) to discuss the project and its implementation.
