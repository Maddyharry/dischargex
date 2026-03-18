# ตรวจสอบก่อน Deploy บน Vercel

ใน Vercel → Project → **Settings** → **Environment Variables** ต้องมีตัวแปรเหล่านี้และติ๊กใช้กับ **Production** (และ **Preview** ถ้าต้องการ):

- `DATABASE_URL` = connection string จาก Neon (postgresql://...)
- `NEXTAUTH_URL` = URL เว็บจริงหลัง deploy (เช่น https://xxx.vercel.app)
- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**สำคัญ:** ตัวแปรต้องใช้กับ **Build** ด้วย (ไม่ใช่แค่ Runtime) เพื่อให้ `next build` รู้ค่า DATABASE_URL
