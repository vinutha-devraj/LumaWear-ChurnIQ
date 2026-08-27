# LumaWear Storefront

A modern, responsive e-commerce frontend for a premium online clothing store built with **React + Tailwind CSS + Vite**.

## Features

- Elegant fashion-focused responsive UI (mobile, tablet, desktop)
- Home, Shop, Product Details, Cart, Checkout, Order Confirmation, and Account flows
- Product search, filtering, sorting, and load-more pagination
- Cart + wishlist + recently viewed state (persisted in localStorage)
- Multi-step checkout with validation and accessible form feedback
- Toast notifications, loading skeletons, hover transitions, and polished micro-interactions
- Sticky nav, cart drawer, detailed footer, testimonials, and lookbook sections

## Tech Stack

- React 18
- React Router DOM
- Tailwind CSS
- Vite
- Lucide React icons

## Run Frontend Locally

1. Install Node.js 18+ (includes npm)
2. Go to frontend folder:
   ```bash
   cd frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development server:
   ```bash
   npm run dev
   ```
5. Build production bundle:
   ```bash
   npm run build
   ```
6. Preview production build:
   ```bash
   npm run preview
   ```

## Project Structure

- `src/components` – reusable UI components (navigation, cards, filters, drawer, footer, etc.)
- `src/pages` – routed pages and flows
- `src/context` – app-wide state providers (store + toast)
- `src/data/products.js` – realistic mock catalog data and product metadata

## Notes

- Product and editorial imagery uses Unsplash image URLs/placeholders.
- The storefront currently uses frontend mock product/user data for UI flows.
