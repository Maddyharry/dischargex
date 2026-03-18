# วิธีเปิดใช้ล็อกอิน Google และ Facebook จริง

โปรเจกต์มี NextAuth ตั้งค่า Google และ Facebook ไว้แล้ว จะทำงานเมื่อคุณใส่ **Client ID** และ **Client Secret** ใน `.env`

---

## 1. Google Sign-In

### 1.1 สร้างโปรเจกต์ใน Google Cloud Console

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้างโปรเจกต์ใหม่ หรือเลือกโปรเจกต์ที่มีอยู่
3. ไปที่ **APIs & Services** → **Credentials**
4. กด **Create Credentials** → **OAuth client ID**
5. ถ้ายังไม่มี OAuth consent screen:
   - ไปที่ **OAuth consent screen** ก่อน
   - เลือก **External** (หรือ Internal ถ้าเป็นองค์กร)
   - กรอก App name (เช่น DischargeX), User support email, Developer contact
   - เพิ่ม Scopes ถ้าต้องการ (ปกติ email, profile เพียงพอ)
   - เพิ่ม Test users ถ้า app ยังเป็น Testing mode
6. กลับมา **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: เช่น `DischargeX Web`
   - **Authorized JavaScript origins**:
     - Local: `http://localhost:3000`
     - Production: `https://yourdomain.com`
   - **Authorized redirect URIs**:
     - Local: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google`
7. กด Create แล้ว copy **Client ID** และ **Client secret**

### 1.2 ใส่ใน .env

```env
GOOGLE_CLIENT_ID=xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxx
```

รีสตาร์ท dev server (`npm run dev`) แล้วปุ่ม "เข้าสู่ด้วย Google" จะล็อกอินได้จริง

---

## 2. Facebook Login

### 2.1 สร้างแอปใน Facebook Developer

1. ไปที่ [Facebook for Developers](https://developers.facebook.com/)
2. เมนู **My Apps** → **Create App** → เลือก **Consumer** (หรือ Use case อื่นตามต้องการ)
3. ตั้งชื่อแอป (เช่น DischargeX) แล้วสร้างแอป
4. ในแดชบอร์ดแอป ไปที่ **Products** → **Facebook Login** → **Set up** (หรือ **Settings**)
5. เลือก **Web** แล้วตั้งค่า:
   - **Site URL**:
     - Local: `http://localhost:3000`
     - Production: `https://yourdomain.com`
   - **Valid OAuth Redirect URIs** (สำคัญมาก):
     - Local: `http://localhost:3000/api/auth/callback/facebook`
     - Production: `https://yourdomain.com/api/auth/callback/facebook`
6. บันทึก แล้วไปที่ **Settings** → **Basic**
   - Copy **App ID** (= Client ID)
   - กด **Show** ที่ App Secret แล้ว copy (= Client Secret)
7. ถ้าแอปยังเป็นโหมด Development จะมีเฉพาะผู้ใช้ที่เพิ่มใน Roles → Test Users (หรือคนที่อยู่ในทีม) ล็อกอินได้ ถ้าจะให้ทุกคนใช้ต้องส่งแอปให้ Facebook ตรวจ (App Review)

### 2.2 ใส่ใน .env

```env
FACEBOOK_CLIENT_ID=xxxxxxxxxx
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

รีสตาร์ท dev server แล้วปุ่ม "เข้าสู่ด้วย Facebook" จะทำงาน

---

## 3. ตรวจสอบ .env

ให้มีค่าต่อไปนี้ (ไม่ต้องมีทั้ง Google และ Facebook ก็ได้ ถ้าเปิดแค่ตัวใดตัวหนึ่ง):

```env
# บังคับ (มีอยู่แล้ว)
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=xxxxxxxxxxxxxxxx

# Google (ถ้าต้องการล็อกอินด้วย Google)
GOOGLE_CLIENT_ID=xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxx

# Facebook (ถ้าต้องการล็อกอินด้วย Facebook)
FACEBOOK_CLIENT_ID=xxxxxxxxxx
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- **Production**: เปลี่ยน `NEXTAUTH_URL` เป็น `https://yourdomain.com` และเพิ่ม redirect URI ตามนั้นทั้งใน Google และ Facebook

---

## 4. พฤติกรรมในโปรเจกต์

- ถ้า **ไม่มี** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` → ปุ่ม "เข้าสู่ด้วย Google" ยังโชว์อยู่ แต่พอกดแล้ว NextAuth จะ error (เพราะไม่มี provider)
- ถ้า **มี** ค่าครบ → NextAuth จะลงทะเบียน/ล็อกอิน user ผ่าน Prisma Adapter (สร้าง/อัปเดต User ใน DB อัตโนมัติ)
- อีเมลที่ล็อกอินตรงกับ `ADMIN_EMAIL` ใน `.env` จะได้ role **admin** อัตโนมัติ (มีอยู่แล้วใน `lib/auth.ts`)

ถ้าต้องการให้ปุ่ม Google/Facebook **ไม่แสดง** เมื่อยังไม่ได้ตั้งค่า OAuth สามารถแก้หน้า Login ให้เช็ค env แล้วซ่อนปุ่มได้
