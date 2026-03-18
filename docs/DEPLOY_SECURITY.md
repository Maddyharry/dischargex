# แนวทางความปลอดภัยก่อนอัปโหลด / Deploy

เอกสารนี้สรุปสิ่งที่ควรทำเพื่อลดความเสี่ยงจากการเจาะระบบและใช้ API อย่างไม่ถูกต้อง

---

## 1. ค่าใน .env อย่าให้รั่ว

- **ห้าม commit ไฟล์ `.env` ขึ้น Git** — ใส่ `.env` ใน `.gitignore` แล้วตรวจสอบว่าไม่มี `.env` ใน repo
- **AUTH_SECRET** — ใช้ค่าที่สุ่มและยาว (เช่น `openssl rand -base64 32`) ใน production อย่าใช้ค่าเดียวกับในเอกสารหรือตัวอย่าง
- **ADMIN_EMAIL และ ADMIN_PASSWORD** — ใช้เฉพาะบนเซิร์ฟเวอร์ อย่าใส่ใน frontend หรือ log
- **OPENAI_API_KEY** — เก็บเฉพาะฝั่ง server; API ของคุณเป็นคนเรียก OpenAI ไม่ให้ frontend เรียกโดยตรง

---

## 2. ใช้ HTTPS เสมอใน production

- เปิดเว็บและ API ผ่าน **HTTPS เท่านั้น** (ไม่ใช้ HTTP)
- ตั้ง `NEXTAUTH_URL=https://โดเมนของคุณ` ไม่มี trailing slash
- ถ้าใช้ reverse proxy (Nginx, Cloudflare) ต้องตั้ง SSL (เช่น Let's Encrypt) ให้ครบ

---

## 3. การป้องกัน API ที่มีอยู่แล้ว

- **NextAuth** — route `/api/auth/*` ใช้ session และ AUTH_SECRET; cookie เป็น httpOnly
- **API อื่นๆ** — `/api/me`, `/api/usage`, `/api/summarize` ฯลฯ ใช้ `getServerSession(authOptions)` แล้วตรวจว่าเป็น user ที่ล็อกอินแล้ว
- **Admin API** — `/api/admin/*` ตรวจ `role === "admin"` จาก session แล้วจึงทำงาน

ดังนั้นถ้าไม่มี session ที่ถูกต้อง (cookie ที่ sign แล้ว) จะเรียก API เหล่านี้ใช้ไม่ได้โดยตรงจาก browser/script คนอื่น

---

## 4. ป้องกันการโจมตีที่พบบ่อย

### 4.1 Brute force (ลองรหัสผ่านซ้ำๆ)

- **ล็อกอินแอดมิน** (`/login/admin`) — ใช้รหัสผ่านที่แข็งแรง (ไม่ใช้รหัสสั้นหรือคำในพจนานุกรม)
- ถ้าโฮสต์รองรับ (เช่น Vercel, Cloudflare) ควรเปิด **rate limiting** สำหรับ path `/api/auth/*` และ `/login/admin` เพื่อจำกัดจำนวนครั้งต่อ IP ต่อช่วงเวลา

### 4.2 DDoS / ใช้ API หนักเกินไป

- จำกัดจำนวน request ต่อ user ต่อนาที (rate limit) โดยเฉพาะ:
  - `POST /api/summarize` (ใช้เครดิตและเรียก OpenAI)
  - `POST /api/auth/callback/admin` (ล็อกอินแอดมิน)
- บน Vercel: ใช้ Vercel Firewall หรือ middleware จำกัด rate  
- บนเซิร์ฟเวอร์เอง: ใช้ Nginx limit_req หรือ middleware ใน Next.js ที่นับ request ต่อ IP/user

### 4.3 Input ที่อันตราย

- API ที่รับ body จาก client ควร **ตรวจและล้าง input** (ความยาว, รูปแบบ) ก่อนส่งไป OpenAI หรือเขียน DB
- อย่าเอา input จาก client ไปต่อใน raw SQL; ใช้ Prisma/ORM ที่ bind parameter อยู่แล้ว

---

## 5. สิ่งที่ควรทำก่อนอัปโหลด

| รายการ | สถานะ |
|--------|--------|
| ไม่ commit `.env` (มีใน .gitignore) | ✓ ตรวจ |
| ตั้ง AUTH_SECRET ใหม่สำหรับ production | ✓ ตรวจ |
| ตั้ง ADMIN_PASSWORD ให้แข็งแรง (และเปลี่ยนจากค่า default ถ้ามี) | ✓ ตรวจ |
| NEXTAUTH_URL เป็น https:// โดเมนจริง | ✓ ตรวจ |
| เปิด HTTPS ทั้งไซต์ | ✓ ตรวจ |
| ตรวจว่า OAuth redirect URI ใช้ https | ✓ ตรวจ |

---

## 6. ถ้าต้องการ rate limit ใน Next.js (ตัวอย่างแนวคิด)

- ใช้ middleware หรือ wrapper รอบ API route ที่นับ request ต่อ `userId` หรือ `IP` (จาก header `x-forwarded-for` หรือ `x-real-ip` ถ้ามี proxy)
- เก็บจำนวนใน memory (Map) หรือ Redis ถ้ารันหลาย instance
- ตัวอย่าง: จำกัด `POST /api/summarize` ไม่เกิน 30 ครั้งต่อ user ต่อนาที (แล้วค่อยปรับตามความเหมาะสม)

ถ้าใช้ Vercel หรือ host ที่มี WAF/firewall แนะนำให้ใช้ฟีเจอร์ limit ของ platform นั้นก่อน แล้วค่อยเพิ่มในแอปถ้าจำเป็น
