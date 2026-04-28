# Flow รับเงินและส่งไฟล์

เป้าหมายคือให้ลูกค้าทัก/ซื้อ/จ่าย QR/รับไฟล์ได้โดยไม่ต้องรอคุณตอบเอง

## Flow แนะนำแบบ Auto

แอด → Landing page → Checkout เลือกแพ็ก → QR PromptPay → payment webhook ยืนยันจ่าย → ส่งไฟล์อัตโนมัติ → LINE/email follow up → ส่ง purchase event กลับ Meta

## Stack ที่แนะนำ

### Stack A: ทำจริงจังและ auto ที่สุด
- Landing page: Next.js, Carrd, Framer หรือ WordPress
- Payment: Opn Payments, GB Prime Pay หรือ HitPay ที่รองรับ PromptPay QR และ webhook
- Delivery: email อัตโนมัติ + Google Drive/S3 signed link
- Chat: LINE OA + Messaging API หรือ no-code bot เช่น Zaapi/Zell724/Thunder Solution
- Data: Google Sheet/Airtable สำหรับ order log
- Ads: Meta Pixel + Conversion API + custom audience

### Stack B: no-code มากขึ้น
- Landing/checkout: แพลตฟอร์มขายไฟล์ที่รองรับ payment ไทย หรือ payment link จาก gateway
- Chat: LINE OA bot platform
- Automation: Make/Zapier webhook → Google Sheet → email/LINE message
- Ads: Meta Pixel บน landing page + manual campaign rules

## สิ่งที่ต้องเตรียม
- QR พร้อมเพย์ หรือเลขพร้อมเพย์
- Google Drive folder สำหรับเก็บไฟล์
- ข้อความตอบลูกค้า 5 ชุด
- Google Sheet จดออเดอร์

### ไฟล์ที่ควรส่งลูกค้า
1. `AI-Sales-Kit-Ebook.pdf`
2. `Profit-Calculator-Worksheet.pdf`
3. `prompt-pack.md` หรือ PDF ที่แปลงแล้ว
4. `content-calendar-30-days.md` หรือ PDF ที่แปลงแล้ว
5. `faq-template.md`
6. Bonus 3 ไฟล์

### วิธีตั้ง Google Drive
1. สร้าง folder ชื่อ `AI Sales Kit - Customer Files`
2. อัปโหลดไฟล์ทั้งหมด
3. คลิก Share
4. ตั้งเป็น `Anyone with the link can view`
5. คัดลอกลิงก์ folder
6. ทดสอบเปิดใน incognito ก่อนส่งลูกค้า

## ข้อความตอบลูกค้า

### ลูกค้าทักว่าสนใจ
สวัสดีค่ะ ชุด AI Sales Kit ราคาเปิดตัว 299 บาทนะคะ

ในชุดมี Ebook, Prompt Pack, แผนโพสต์ 30 วัน, ตารางคำนวณกำไร และ bonus สำหรับเริ่มขาย/ยิงแอดค่ะ

ถ้าสนใจ แอดมินส่งรายละเอียดชำระเงินให้ได้เลยค่ะ

### ส่งรายละเอียดชำระเงิน
เลือกแพ็กได้เลยค่ะ

1. Ebook อย่างเดียว 199 บาท
2. Bundle ครบชุด 299 บาท

โอนผ่านพร้อมเพย์: [ใส่เลขพร้อมเพย์]
ชื่อบัญชี: [ใส่ชื่อบัญชี]

หลังโอนแล้ว ส่งสลิปในแชทนี้ได้เลยค่ะ แอดมินจะส่งลิงก์ดาวน์โหลดไฟล์ให้ทันที

### หลังได้รับสลิป
ได้รับสลิปแล้วค่ะ ขอบคุณมากนะคะ

นี่คือลิงก์ดาวน์โหลด AI Sales Kit:
[ใส่ลิงก์ Google Drive]

แนะนำให้เริ่มจากไฟล์ `AI-Sales-Kit-Ebook.pdf` ก่อน แล้วค่อยเปิด Prompt Pack ใช้กับร้านของตัวเองค่ะ

### Follow up หลังส่งไฟล์ 1 วัน
สวัสดีค่ะ แอดมินขอสอบถามนิดนึงนะคะ ได้ลองเปิดไฟล์ AI Sales Kit แล้วหรือยังคะ

ถ้าเพิ่งเริ่ม แนะนำให้ทำแค่ 2 อย่างก่อน:
1. กรอกข้อมูลสินค้า 1 ตัว
2. ใช้ prompt สร้าง FAQ 15 ข้อ

เริ่มจากตรงนี้จะง่ายที่สุดค่ะ

## Google Sheet จดออเดอร์

คอลัมน์ที่ควรมี:
- วันที่
- ชื่อลูกค้า
- ช่องทางที่มา เช่น Facebook, TikTok, LINE
- ยอดชำระ
- ส่งไฟล์แล้วหรือยัง
- หมายเหตุ

## Manual PromptPay เป็น fallback

ใช้เฉพาะช่วง test แรกหรือช่วงที่ payment gateway ยังไม่ผ่านอนุมัติ เพราะยังต้องเช็กสลิปเอง

## Payment gateway ที่ควรดู

ดูตัวที่รองรับ QR PromptPay และ webhook:
- Opn Payments
- GB Prime Pay
- HitPay
- ผู้ให้บริการ LINE OA bot ที่มีระบบ QR/payment verification ในตัว

## LINE OA แบบง่าย

ถ้าใช้ LINE เป็นช่องทางหลัก ให้ตั้งเมนูและข้อความอัตโนมัติไว้ก่อน

### Rich menu/ข้อความที่ควรมี
- ดูรายละเอียดสินค้า
- วิธีชำระเงิน
- ดาวน์โหลดหลังชำระ
- ถามปัญหาการเปิดไฟล์

### Auto reply เบื้องต้น
สวัสดีค่ะ ขอบคุณที่สนใจ AI Sales Kit นะคะ

พิมพ์เลขที่ต้องการได้เลย:
1 = ดูรายละเอียดสินค้า
2 = วิธีชำระเงิน
3 = ซื้อแล้ว ขอรับไฟล์
4 = เปิดไฟล์ไม่ได้

## Checklist ก่อนยิงแอด

- [ ] ลิงก์ดาวน์โหลดเปิดได้จริง
- [ ] ไฟล์ PDF เปิดบนมือถือได้
- [ ] QR PromptPay/checkout จ่ายได้จริง
- [ ] webhook ยืนยัน payment สำเร็จ
- [ ] ระบบส่งไฟล์อัตโนมัติสำเร็จ
- [ ] Google Sheet/Airtable จดออเดอร์อัตโนมัติ
- [ ] Pixel/Conversion API รับ event Purchase
- [ ] มี refund policy หรือเงื่อนไขชัดเจน

## Refund policy แนะนำ

เนื่องจากเป็นสินค้าดิจิทัล หลังส่งไฟล์แล้วขอสงวนสิทธิ์ไม่คืนเงิน ยกเว้นกรณีลูกค้าเปิดไฟล์ไม่ได้และร้านไม่สามารถแก้ไขหรือส่งไฟล์ใหม่ให้ได้

เขียนให้สุภาพ:

> เนื่องจากสินค้าเป็นไฟล์ดิจิทัล หลังชำระเงินและได้รับลิงก์ดาวน์โหลดแล้ว ทางร้านขอสงวนสิทธิ์ไม่คืนเงิน แต่หากลูกค้าเปิดไฟล์ไม่ได้ แอดมินยินดีช่วยส่งไฟล์ใหม่หรือแนะนำวิธีเปิดให้ค่ะ
