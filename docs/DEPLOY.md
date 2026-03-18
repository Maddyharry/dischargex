# คู่มือ Deploy DischargeX

## สิ่งที่ต้องเตรียมก่อน Deploy

### 1. ตัวแปรสภาพแวดล้อม (Environment Variables)
ใน production **ห้าม** commit ไฟล์ `.env` ขึ้น Git  
ให้ตั้งค่าตัวแปรเหล่านี้ในแดชบอร์ดของแพลตฟอร์มที่ใช้ deploy:

| ตัวแปร | ตัวอย่าง (Production) | หมายเหตุ |
|--------|------------------------|----------|
| `DATABASE_URL` | ดูด้านล่างตามแพลตฟอร์ม | ต้องใช้ DB จริง ไม่ใช้ไฟล์ SQLite |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | URL เว็บจริง |
| `AUTH_SECRET` | สุ่มใหม่หรือใช้ค่าเดิม | ใช้เข้ารหัส session |
| `OPENAI_API_KEY` | (ค่าเดิม) | คีย์ OpenAI |
| `ADMIN_EMAIL` | อีเมลแอดมิน | |
| `ADMIN_PASSWORD` | รหัสผ่านแอดมิน (ควรแข็งแรง) | |
| `GOOGLE_CLIENT_ID` | (ค่าเดิม) | |
| `GOOGLE_CLIENT_SECRET` | (ค่าเดิม) | |

### 2. Google OAuth (ถ้าใช้ล็อกอิน Google)
ใน [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials:

- เพิ่ม **Authorized redirect URIs**:  
  `https://<โดเมนของคุณ>/api/auth/callback/google`
- ตัวอย่าง: `https://dischargex.vercel.app/api/auth/callback/google`

---

## วิธีที่ 1: Deploy บน Vercel (แนะนำ ถ้ายอมเปลี่ยนเป็น PostgreSQL)

Vercel เหมาะกับ Next.js มาก แต่ต้องใช้ฐานข้อมูลแบบโฮสต์ (ไม่ใช้ SQLite)

### ขั้นตอน

1. **สมัคร/ล็อกอิน Vercel**  
   ไปที่ [vercel.com](https://vercel.com) และเชื่อมกับ GitHub/GitLab/Bitbucket

2. **สร้างโปรเจกต์**
   - New Project → เลือก Repo ของ dischargex
   - Framework: Next.js (จะ detect อัตโนมัติ)
   - Root Directory: ไม่ต้องเปลี่ยน

3. **เพิ่มฐานข้อมูล PostgreSQL**
   - ใช้ **Vercel Postgres** หรือ **Neon** (มี free tier)
   - สร้าง database แล้ว copy connection string มา

4. **เปลี่ยน Prisma เป็น PostgreSQL**
   - แก้ `prisma/schema.prisma`: เปลี่ยน `provider = "sqlite"` เป็น `provider = "postgresql"`
   - ลบ `@db.SQLite` / ความเฉพาะของ SQLite ถ้ามี (ใน schema ปัจจุบันไม่มี)
   - ตั้ง `DATABASE_URL` ใน Vercel เป็น connection string ของ Postgres

5. **รัน Migration บน DB จริง**
   ```bash
   # ใช้ DATABASE_URL ของ production (จาก Vercel env)
   npx prisma migrate deploy
   ```

6. **ตั้ง Environment Variables ใน Vercel**
   - Project → Settings → Environment Variables
   - ใส่ทุกตัวจากตารางด้านบน (โดยเฉพาะ `NEXTAUTH_URL` = URL ที่ Vercel ให้ เช่น `https://xxx.vercel.app`)

7. **Deploy**
   - กด Deploy หรือ push code ขึ้น Git แล้ว Vercel จะ build อัตโนมัติ

### คำสั่ง Build ที่ Vercel ใช้
- Build: `next build`
- Output: Next.js (อัตโนมัติ)

---

## วิธีที่ 2: Deploy บน Railway / Render (เก็บ SQLite ได้)

ถ้าอยากเก็บ SQLite ไว้ ใช้แพลตฟอร์มที่รันเซิร์ฟเวอร์ต่อเนื่องและมี persistent storage

### Railway

1. ไปที่ [railway.app](https://railway.app) → New Project
2. Deploy from GitHub (เลือก repo dischargex)
3. ตั้งค่า:
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Root Directory: `/`
4. เพิ่ม **Volume** สำหรับเก็บไฟล์ (เช่น `/app/prisma`) แล้วใช้ path ที่ volume นั้นเป็นที่อยู่ของ `dev.db` (หรือตั้ง `DATABASE_URL=file:/app/data/prod.db` แล้ว mount volume ที่ `/app/data`)
5. ตั้ง Environment Variables ครบ (รวมถึง `DATABASE_URL` ชี้ไปที่ path บน volume)

### Render

1. ไปที่ [render.com](https://render.com) → New → Web Service
2. เชื่อม Repo → เลือก dischargex
3. ตั้งค่า:
   - Build: `npm install && npm run build`
   - Start: `npm start`
4. บน Render ฟรี tier ไฟล์ระบบจะไม่ persist หลัง restart — ถ้าจะใช้ SQLite จริงๆ ต้องใช้ **Disk** (มีใน paid plan) หรือเปลี่ยนไปใช้ PostgreSQL ที่ Render ให้ฟรีแทน

---

## วิธีที่ 3: VPS (เซิร์ฟเวอร์ตัวเอง)

ถ้ามี VPS (DigitalOcean, AWS EC2, ฯลฯ):

```bash
# บนเซิร์ฟเวอร์ (Linux)
git clone <repo-url>
cd dischargex
npm install
cp .env.example .env   # แล้วแก้ .env ให้ถูกต้อง
npx prisma generate
npx prisma migrate deploy   # หรือใช้ dev.db copy ขึ้นไป (ไม่แนะนำสำหรับ production)
npm run build
npm start
```

ใช้ process manager เช่น **PM2** เพื่อให้แอปรันต่อเนื่อง:

```bash
npm install -g pm2
pm2 start npm --name "dischargex" -- start
pm2 save && pm2 startup
```

บน VPS สามารถใช้ SQLite แบบไฟล์ได้ตามเดิม (ให้ path `DATABASE_URL` ชี้ไปที่ไฟล์ที่ writable และ backup เป็นระยะ)

---

## สรุป

| แพลตฟอร์ม | ฐานข้อมูล | ความยาก | หมายเหตุ |
|------------|------------|---------|----------|
| **Vercel** | PostgreSQL (Neon/Vercel Postgres) | ปานกลาง | แนะนำ ถ้ายอมเปลี่ยน DB |
| **Railway** | SQLite (volume) หรือ PostgreSQL | ปานกลาง | เก็บ SQLite ได้ |
| **Render** | PostgreSQL (แนะนำ) หรือ SQLite + Disk | ปานกลาง | ฟรี tier ไม่มี disk ถาวร |
| **VPS** | SQLite ได้ตามเดิม | สูงกว่า | ควบคุมเต็มที่ |

หลัง deploy แล้ว อย่าลืม:
- ตั้ง `NEXTAUTH_URL` ให้ตรงกับ URL จริง
- เพิ่ม redirect URI ของ Google OAuth
- เปลี่ยน `ADMIN_PASSWORD` เป็นรหัสที่แข็งแรง
