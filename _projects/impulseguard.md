---
layout: page
title: ImpulseGuard
description: AI-Powered Chrome Extension to Prevent Impulse Purchases
img: assets/img/impulseguard.jpg
importance: 1
category: creations
related_publications: false
---

## Overview

ImpulseGuard is an intelligent browser extension that helps users save money by analyzing and blocking impulse purchases in real-time. Using AI to understand product context and categorize spending, it acts as a financial guardian that helps users make more mindful purchasing decisions.

This prototype and business plan was developed in under 24 hours during the Ibtikar Waterloo case competition. The project addresses UN Sustainable Development Goal 12 (Responsible Consumption and Production), specifically target 12.8: ensuring that people everywhere have the relevant information and awareness for sustainable development and lifestyles in harmony with nature.

## The Problem

Online shopping has made impulse purchasing easier than ever, and Generation Z has a problem. With one-click checkout, targeted ads, and strategically designed UI, e-commerce platforms are engineered to encourage spontaneous spending. Traditional solutions like budgeting apps require manual entry and only show spending *after* it happens—too late to prevent the purchase.

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
- Non-intrusive design that doesn't break the shopping experience
- Instant analysis with loading states and visual feedback

### 24-Hour Cooling Period

- Blocked items cannot be attempted again for 24 hours
- Based on behavioral economics research showing that delaying decisions reduces impulse buying
- Forces a "sleep on it" approach for questionable purchases

### Comprehensive Statistics Dashboard

- Total money saved tracked over time
- Weekly savings breakdown
- Number of blocked purchases
- Total impulses detected vs. impulses resisted
- Success rate percentage
- Persistent storage using Chrome Storage API

## Technical Implementation

### Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 19.2.4 with TypeScript |
| **UI Library** | Radix UI (accessible component library) |
| **Styling** | Tailwind CSS v4 with custom theme |
| **Build Tool** | Vite 5.4.21 |
| **Type Safety** | TypeScript 5.4.5 (strict mode) |
| **AI Integration** | Claude AI API (Haiku model) |
| **Storage** | Chrome Storage API |
| **Extension Platform** | Chrome Manifest V3 |

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

## Why ImpulseGuard Matters

Financial wellness isn't just about earning more—it's about spending mindfully. ImpulseGuard combines:

- **Behavioral Economics** – Cooling-off periods reduce impulsive decisions
- **AI Intelligence** – Context-aware understanding, not just price filters
- **Seamless UX** – No friction for legitimate purchases, firm guardrails for impulses

By intervening at the moment of decision, ImpulseGuard helps users build better spending habits and save thousands over time—without requiring willpower alone.

---

Built with React, TypeScript, and Claude AI. Designed to make mindful spending effortless.

---

**Note:** The source code for ImpulseGuard is not yet publicly available as the project is currently under active development. Stay tuned for updates!
