const AI_UNAVAILABLE = "ขออภัยครับ ขณะนี้บริการ AI ขัดข้องชั่วคราว ทีมงานกำลังตรวจสอบและแก้ไข กรุณาลองใหม่ภายหลัง หากยังพบปัญหา แจ้งเวลาและข้อความผิดพลาดได้ทางแชท โดยไม่ส่งข้อมูลผู้ป่วยครับ";

function normalize(text: string) {
  return text.toLocaleLowerCase("th-TH").replace(/[\u200b\s]+/g, " ").trim();
}

export function deterministicSupportReply(message: string): string | null {
  const text = normalize(message);
  const mentionsBoost = /boost|บูส|บูสต์|บูท/.test(text);
  if (/\b429\b|no credits remaining|insufficient[_\s-]quota|provider.{0,12}(error|outage)|ai.{0,12}(error|down|unavailable)|เอไอ.{0,10}(ล่ม|ขัดข้อง)|ระบบ.{0,10}(ล่ม|ขัดข้อง)|ขัดข้องชั่วคราว/.test(text)) return AI_UNAVAILABLE;

  if (/(เคสยาว|long case).{0,30}(ภาพ|รูป|pass|สิทธิ์)|(ภาพ|รูป).{0,30}(pass|สิทธิ์)/.test(text)) {
    return "เคสปกติใช้ Boost 1 สิทธิ์ ส่วนเคสยาวหรือเคสที่มีรูปใช้ 2 สิทธิ์; ต้องกดยืนยันใช้เองและหักเมื่อสร้างเคสสำเร็จครับ";
  }

  if (mentionsBoost && /แพ็ก.{0,18}(ไม่ active|inactive|ไม่แอคทีฟ|หมดแพ็ก|หมดอายุ|expired)|สมาชิก.{0,12}(หมดอายุ|ไม่ active)|subscription.{0,24}(expired|inactive|cancelled)|ยกเลิกแพ็ก|cancel/.test(text)) {
    return "Boost ใช้ได้เฉพาะตอนแพ็กเกจแบบชำระเงินยัง active หรือ pending_change ครับ เมื่อแพ็กเกจไม่ active ระบบจะไม่อนุญาตให้ใช้ Boost ตรวจสถานะและวันสิ้นสุดได้ที่ /app/profile → Billing";
  }
  if (mentionsBoost && /ราคา|เท่าไหร่|กี่บาท|price|cost|how much/.test(text)) {
    return "Boost มี 2 แพ็กครับ: 5 สิทธิ์ ฿109 และ 15 สิทธิ์ ฿329 ซื้อได้จาก /app/profile หรือ /pricing แล้วดูรายการได้ในประวัติ Billing";
  }
  if (mentionsBoost && /ใช้ยังไง|วิธีใช้|กดใช้|activate|how.{0,8}use/.test(text)) {
    return "เมื่อระบบแจ้งว่าถึงขีดจำกัด ให้ตรวจจำนวนสิทธิ์ที่ต้องใช้แล้วกด “ใช้ Boost … สิทธิ์กับเคสนี้” ครับ ระบบจะไม่ใช้เอง และหักสิทธิ์เมื่อสร้างเคสสำเร็จ";
  }
  if (mentionsBoost && /ซื้อ|buy|purchase|สั่งซื้อ/.test(text)) {
    return "ซื้อ Boost ได้จาก /app/profile หรือ /pricing ครับ เลือก 5 สิทธิ์ ฿109 หรือ 15 สิทธิ์ ฿329 แล้วชำระตามขั้นตอน ระบบจะเพิ่มยอดหลังยืนยันการชำระสำเร็จ";
  }
  if (mentionsBoost && /ทำไม|อัตโนมัติ|auto|ไม่หัก|ไม่ใช้|ไม่ถูกใช้|ไม่ตัด/.test(text)) {
    return "Boost จะไม่ถูกใช้เองแม้มียอดคงเหลือครับ เมื่อถึงขีดจำกัด ระบบจะแสดงจำนวนสิทธิ์ที่ต้องใช้ ให้กด “ใช้ Boost … สิทธิ์กับเคสนี้” เพื่อยืนยันก่อนทำเคส";
  }
  if (mentionsBoost && /daily|period|quota|cap|limit|โควตา|ขีดจำกัด|เพดาน/.test(text)) {
    return "Boost ใช้ทำเคสต่อได้เมื่อถึงขีดจำกัดรายวันหรือรอบแพ็กเกจ โดยต้องกดยืนยันเองและไม่รีเซ็ตตัวนับปกติครับ เคสปกติใช้ 1 สิทธิ์ ส่วนเคสยาวหรือมีรูปใช้ 2 สิทธิ์";
  }
  if (mentionsBoost && /ยาว|รูป|ภาพ|สิทธิ์|pass|เคส/.test(text)) {
    return "เคสปกติใช้ Boost 1 สิทธิ์ ส่วนเคสยาวหรือเคสที่มีรูปใช้ 2 สิทธิ์ ระบบจะแสดงจำนวนที่ต้องใช้ก่อนยืนยัน และจะไม่หักสิทธิ์จนสร้างเคสสำเร็จ";
  }
  if (mentionsBoost && /หมดอายุ|expire|โอน|transfer|ตลอดไป|permanent/.test(text)) {
    return "ยอด Boost แสดงใน /app/profile และไม่มีตัวนับวันหมดอายุแยก แต่ใช้ได้เฉพาะขณะที่แพ็กเกจแบบชำระเงินยัง active หรือ pending_change; ระบบไม่รองรับการโอนสิทธิ์";
  }
  if (mentionsBoost && /คืนเงิน|refund|คืนยอด/.test(text)) {
    return "การคืนเงิน Boost ไม่ได้ดำเนินการอัตโนมัติครับ หากต้องการให้ตรวจสอบรายการชำระเงิน ติดต่อทีมงานผ่านช่องทางช่วยเหลือในแอป พร้อมแจ้งเวลาและยอดชำระ โดยไม่ส่งข้อมูลผู้ป่วย";
  }
  if (mentionsBoost && /ดู|เช็ก|เช็ค|ยอด|คงเหลือ|ประวัติ|history|where/.test(text)) {
    return "ดูยอด Boost และประวัติรายการซื้อได้ที่ /app/profile ในส่วนการใช้งานและ Billing ครับ รายการใช้ Boost จะแสดงร่วมกับกิจกรรมเคส";
  }
  if (mentionsBoost && /ยังไง|ได้จากไหน|how to get/.test(text)) {
    return "ซื้อ Boost ได้ที่ /app/profile หรือ /pricing เลือกแพ็ก 5 สิทธิ์ ฿109 หรือ 15 สิทธิ์ ฿329 แล้วชำระตามขั้นตอน ยอดจะเพิ่มหลังยืนยันสำเร็จครับ";
  }
  if (mentionsBoost) {
    return "Boost คือสิทธิ์สำหรับทำเคสต่อทันทีเมื่อถึงขีดจำกัดรายวันหรือรอบแพ็กเกจ โดยไม่รีเซ็ตตัวนับปกติ เคสปกติใช้ 1 สิทธิ์ ส่วนเคสยาวหรือมีรูปใช้ 2 สิทธิ์ และต้องกดยืนยันใช้กับเคสนั้นเอง";
  }

  if (/ราคา|price|how much|เท่าไร|เท่าไหร่/.test(text) && /แพ็ก|แพค|แพตเกจ|subscription|basic|standard|pro/.test(text)) {
    return "ราคาแพ็กเกจปัจจุบันคือ Basic ฿299/เดือน หรือ ฿2,990/ปี, Standard ฿590/เดือน หรือ ฿5,990/ปี, Pro ฿1,090/เดือน หรือ ฿10,990/ปีครับ ดูรายละเอียดล่าสุดที่ /pricing";
  }

  if (/โควตา|quota|เคสต่อวัน|ต่อวัน|daily limit|วันละกี่|per day/.test(text)) {
    return "โควตาสร้างเคสปกติคือ Trial 2 เคส/วัน, Basic 5, Standard 15 และ Pro 40 เคส/วันครับ รอบวันรีเซ็ตเวลา 07:00 น. เวลาไทย; ดูยอดและเวลาถัดไปที่ /app/profile";
  }
  if (/รอบแพ็ก|รอบบิล|billing period|period reset|รีเซ็ต.*รอบ|reset.*period/.test(text)) {
    return "โควตารอบแพ็กเกจรีเซ็ตเมื่อถึงวันสิ้นสุดรอบชำระปัจจุบันครับ ดูวันรีเซ็ตที่แน่นอนได้ใน /app/profile";
  }
  if (/ยอด|ประวัติ|สถานะ|balance|history|status/.test(text) && /โปรไฟล์|profile|แพ็ก|payment|ชำระ/.test(text)) {
    return "ดูสถานะแพ็กเกจ รายการชำระเงิน และประวัติที่เกี่ยวข้องได้ที่ /app/profile → Billing ครับ";
  }
  if (/ข้อมูลผู้ป่วย|patient data|order sheet|เวชระเบียน|คนไข้|ผู้ป่วย/.test(text) && /แชท|ส่ง|แปะ|paste|แนบ|ภาพ|รูป/.test(text)) {
    return "กรุณาอย่าส่งข้อมูลผู้ป่วยในแชทช่วยเหลือครับ ใช้หน้า /app สำหรับข้อมูลเคส และก่อนแนบภาพให้ปิดบังตัวระบุทั้งหมด รวม QR code และ barcode ด้วยตนเอง ระบบไม่สามารถรับรองว่าปิดบังภาพได้ครบ";
  }
  if (/(ภาพ|รูป|image|photo)/.test(text) && /(ส่ง|แนบ|upload|attach|ได้ไหม|ได้มั้ย)/.test(text)) {
    return "ก่อนแนบภาพ ให้ปิดบังข้อมูลระบุตัวบุคคลทั้งหมดด้วยตนเอง รวม QR code และ barcode แล้วตรวจทุกภาพก่อนยืนยัน ระบบไม่สามารถรับรองว่าปิดบังได้ครบครับ";
  }
  return null;
}
