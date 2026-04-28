# AI Sales Kit สำหรับแม่ค้าออนไลน์

โฟลเดอร์นี้คือชุดไฟล์ต้นฉบับสำหรับทำ Ebook และ digital product โดยตั้งราคา Ebook อย่างเดียว 199 บาท และชุดรวมพร้อม bonus 299 บาท

## ไฟล์หลัก

- `ai-sales-kit-ebook.md` - ต้นฉบับ Ebook หลัก
- `prompt-pack.md` - Prompt 50 แบบสำหรับตอบลูกค้า คิดคอนเทนต์ และปิดการขาย
- `content-calendar-30-days.md` - แผนโพสต์ 30 วัน
- `faq-template.md` - FAQ template สำหรับร้านค้าออนไลน์
- `profit-calculator.csv` - ตารางคำนวณกำไร/ต้นทุนแอด เปิดได้ด้วย Google Sheets หรือ Excel
- `profit-calculator.html` - ตารางคำนวณกำไรแบบจัดหน้าแล้วสำหรับ export เป็น PDF
- `Profit-Calculator-Worksheet.pdf` - ไฟล์คำนวณกำไรแบบสวย พร้อมส่งเป็น bonus
- `Profit-Calculator-Formula.xlsx` - ไฟล์ Excel จัดหน้าแล้ว พร้อมสูตรคำนวณกำไร
- `AI-Sales-Kit-Customer-Delivery.zip` - ZIP สำหรับส่งลูกค้าจริง มีเฉพาะ PDF/XLSX ไม่มีไฟล์ source `.md`
- `Prompt-Pack.pdf` - Prompt Pack แบบ PDF สำหรับส่งลูกค้า
- `Content-Calendar-30-Days.pdf` - แผนโพสต์ 30 วันแบบ PDF
- `FAQ-Template.pdf` - FAQ Template แบบ PDF
- `LINE-OA-Reply-Script.pdf` - Script ตอบแชท/LINE OA แบบ PDF
- `Ad-Testing-Plan.pdf` - แผน test แอด 7 วันแบบ PDF
- `Launch-Checklist.pdf` - Checklist ก่อนเริ่มขายแบบ PDF
- `sales-page-and-ads.md` - หน้าขายและข้อความยิงแอด
- `launch-sales-page.md` - หน้าขายเวอร์ชันพร้อมนำไปใช้จริง
- `ad-test-kit.md` - ชุดข้อความแอดและ creative brief สำหรับ test รอบแรก
- `payment-delivery-flow.md` - ขั้นตอนรับเงินและส่งไฟล์แบบง่าย
- `full-automation-blueprint.md` - flow ระบบอัตโนมัติเต็มรูปแบบ: แชท, QR payment, ส่งไฟล์, tracking, ads automation
- `canva-layout-guide.md` - คู่มือจัดหน้าใน Canva/Google Docs/HTML
- `ai-sales-kit-preview.html` - ไฟล์ preview สำหรับเปิดดูใน browser และ print เป็น PDF
- `AI-Sales-Kit-Ebook.pdf` - หนังสือที่จัดหน้าแล้ว พร้อมส่งให้ลูกค้าหรือใช้เป็น draft ก่อนปรับดีไซน์เพิ่ม
- `bonus-line-oa-reply-script.md` - bonus script ตอบแชท/LINE OA
- `bonus-ad-testing-plan.md` - bonus แผน test แอด 7 วัน
- `bonus-launch-checklist.md` - bonus checklist ก่อนเริ่มขาย

## วิธีทำเป็นสินค้าขายจริง

1. ใช้ `AI-Sales-Kit-Ebook.pdf` เป็นไฟล์หนังสือหลัก
2. ถ้าต้องการแก้ดีไซน์ ให้เปิด `ai-sales-kit-preview.html` แล้วปรับ HTML/CSS หรือเอาเนื้อหาจาก `ai-sales-kit-ebook.md` ไปจัดใน Canva/Google Docs
3. ส่งลูกค้าด้วย `AI-Sales-Kit-Customer-Delivery.zip` สำหรับแพ็ก 299 บาท เพราะใน ZIP มีเฉพาะไฟล์ PDF/XLSX ที่เปิดง่าย
4. ส่ง `AI-Sales-Kit-Ebook.pdf` อย่างเดียวสำหรับแพ็ก 199 บาท
5. ส่ง `Profit-Calculator-Formula.xlsx` ให้ลูกค้าใช้กรอกตัวเลขจริง หรืออัปโหลด `profit-calculator.csv` เข้า Google Sheets เป็นตัวเลือกเสริม
6. ใช้ข้อความจาก `launch-sales-page.md`, `ad-test-kit.md`, และ `payment-delivery-flow.md` เพื่อทำหน้าขาย ยิงแอด และส่งไฟล์ให้ลูกค้า
7. ถ้าต้องการไม่ผ่านคนเลย ให้ใช้ `full-automation-blueprint.md` และ route `/ai-sales-kit` เป็นแผนต่อระบบแชท + QR payment + ส่งไฟล์อัตโนมัติ

## คำแนะนำราคา

- Ebook อย่างเดียว: 199 บาท
- ชุดรวมพร้อม bonus: 299 บาท
- ราคาเต็มหลังมี mockup/รีวิว: 399-690 บาท
- Bonus ที่ควรเพิ่มภายหลัง: วิดีโอสั้น 5-10 นาที สอนใช้ prompt กับ ChatGPT/Gemini

## ระบบ automation ที่เพิ่มในแอป

- หน้าขาย/checkout: `/ai-sales-kit`
- หน้าตรวจสถานะและรับไฟล์: `/ai-sales-kit/success?order=ORDER_ID`
- Checkout API: `/api/ai-sales-kit/checkout`
- Status API: `/api/ai-sales-kit/status/[orderId]`
- Download API: `/api/ai-sales-kit/download/[token]`
- Opn webhook: `/api/ai-sales-kit/webhook/opn`

Environment variables ที่ต้องตั้งก่อนใช้เงินจริง:

- `OPN_SECRET_KEY` หรือ `OMISE_SECRET_KEY`
- `OPN_WEBHOOK_SECRET` ถ้าเปิด signature verification
