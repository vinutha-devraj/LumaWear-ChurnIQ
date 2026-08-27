# LumaWear ChurnIQ — Final Demonstration Checklist

Use this checklist to ensure smooth presentation and validation during live demonstrations.

---

## 1. Prerequisites & Services Startup

- [ ] **MongoDB**: Running locally on port `27017`
  ```bash
  # Verify MongoDB connection
  mongosh mongodb://127.0.0.1:27017/lumawear --eval "db.users.countDocuments()"
  ```

- [ ] **Terminal 1: Express Backend (:4000)**
  ```bash
  cd LumaWear-Ecommerce/backend
  node src/server.js
  ```
  *Expected log:* `MongoDB connected: 127.0.0.1/lumawear` | `LumaWear backend running at http://localhost:4000`

- [ ] **Terminal 2: ChurnIQ Python FastAPI Engine (:8000)**
  ```bash
  cd ChurnProject
  uvicorn backend.main:app --host 127.0.0.1 --port 8000
  ```
  *Expected log:* `Application startup complete.` | `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Terminal 3: React Storefront (:5173)**
  ```bash
  cd LumaWear-Ecommerce/frontend
  npm run dev
  ```
  *Expected log:* `VITE v8.2.2 ready in ... ms` | `http://localhost:5173/`

---

## 2. Demonstration Flow Checklist

- [ ] **1. Sign in as Admin**: Navigate to `http://localhost:5173/sign-in`, log in with `admin@lumawear.local` / `ChangeMe123!` (or `shivin412@gmail.com` / `Shivin@123`).
- [ ] **2. Open Admin Dashboard**: Navigate to `http://localhost:5173/admin`.
- [ ] **3. Inspect Users Table**: Verify registered customer accounts and live activity stream.
- [ ] **4. Click "⚡ Analyze Risk"**: Click the button next to customer `shivin1418@gmail.com`.
- [ ] **5. Verify Loading Skeleton**: Observe the smooth pulse loading animation while live extraction occurs.
- [ ] **6. Validate Churn Risk Score**:
  - Probability: `5.37%` (`0.0537`)
  - Risk Level: `Low Risk` (Emerald Badge)
  - Timeline: `Low near-term churn risk`
- [ ] **7. Validate SHAP Drivers**:
  - Explain the top contributing factors (`30-Day Activity Events`, `Order Frequency`, `Account Tenure`).
  - Point out the direction indicators (`↓ Reduces Churn Risk`).
- [ ] **8. Validate Recommendations**:
  - `[High Priority]` Cart abandonment outreach.
  - `[Medium Priority]` New customer onboarding journey.
- [ ] **9. Validate Live Signals Grid**:
  - Verify that the 21 signals match real MongoDB documents (18 page views, 4 cart actions, 3 wishlist toggles, 0 orders).
- [ ] **10. Demonstrate On-Demand Search**:
  - Enter User ID or Email in the top search bar and click `🔍 Analyze Risk`.
- [ ] **11. Close Modal**: Test closing via close button and backdrop click.
