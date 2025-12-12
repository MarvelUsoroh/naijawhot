# 🇳🇬 Naija Whot Pro

> A production-ready, low-latency multiplayer card game built for TV (Host) and Mobile (Controller) interaction.

![Naija Whot](https://img.shields.io/badge/Status-Production%20Ready-green) ![Latency](https://img.shields.io/badge/Latency-~300ms-blue) ![Stack](https://img.shields.io/badge/Stack-Vite%20%7C%20Supabase%20%7C%20React-orange)

## 🎮 Overview

**Naija Whot Pro** is a modern digital adaptation of the classic Nigerian card game "Whot". It uses an architecture where a shared large screen (TV/Laptop) acts as the Game Table, and players use their smartphones as private hand controllers.

**Key Features:**
*   **True Nigerian Rules**: Implements Star 8, General Market (14) with Manual Draw, and correct Defense mechanics.
*   **Low Latency**: Optimized Database RPC broadcasting for snappy ~300ms interactions.
*   **Premium UI**: Glassmorphism, dynamic "Smart Banners", and a rich wood-style theme.
*   **Resilient Connectivity**: Robust reconnection handling and state syncing.

## ✨ Features

### Game Rules
*   **General Market (14)**:
    *   **Manual Draw**: Opponents must manually draw from the deck (prevents confusion).
    *   **Hold On**: The turn stays with the player who played 14, allowing them to dictate the flow.
*   **Pick Two / Pick Three**: Stacking rules enforced (defend with 2 or 5 only).
*   **Suspension (8)**: Skips opponents (with Star 8 skipping two players).
*   **Whot (20)**: "I Need..." request system.

### Technical Highlights
*   **Database Broadcasting**: Uses direct Postgres RPC calls to `realtime.messages` for reliable, low-overhead communication.
*   **Parallel Execution**: Server-side logic parallelizes database writes and client broadcasts.
*   **Supabase Edge Functions**: Game logic runs on the edge for global performance.

## 🛠️ Tech Stack

*   **Frontend**: React 19, Vite, TypeScript, TailwindCSS v4.
*   **Backend**: Supabase (PostgreSQL, Realtime, Edge Functions).
*   **State Management**: Optimistic UI with authoritative server reconciliation.

## 🚀 quick Start

### Prerequisites
*   Node.js 18+
*   Supabase CLI (for local backend dev)

### Local Development

1.  **Clone & Install**
    ```bash
    git clone https://github.com/your-username/naijawhot.git
    cd naijawhot
    npm install
    ```

2.  **Environment Setup**
    Create a `.env.local` file:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

### 🚢 Deployment (Vercel)

This project is optimized for deployment on Vercel.

## 📄 License
MIT
