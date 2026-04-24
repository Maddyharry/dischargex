export type SeoVariant = "conversion" | "technical" | "thai_brand";
export type SeoPage = "home" | "pricing" | "guidelines";

type SeoCopy = {
  title: string;
  description: string;
};

type SeoCatalog = Record<SeoPage, SeoCopy>;

const conversionCopy: SeoCatalog = {
  home: {
    title:
      "DischargeX — ผู้ช่วยสรุปชาร์จตามแนวทาง สปสช พร้อม ICD-10 review สำหรับงาน IPD",
    description:
      "เครื่องมือ AI สำหรับแพทย์และทีมเวชระเบียนไทย: ช่วยสรุปชาร์จ, แนะนำหลักฐานที่ควรประเมินก่อนลงวินิจฉัย, และทบทวน coding ICD-10/Thai DRG โดยปกปิดข้อมูลระบุตัวก่อนส่ง AI",
  },
  pricing: {
    title:
      "ราคา DischargeX — แพ็กเกจ AI สรุปชาร์จและช่วยทบทวน ICD-10 สำหรับงาน IPD",
    description:
      "ดูราคาและแพ็กเกจ DischargeX สำหรับทีมแพทย์และเวชระเบียน: โควตาการใช้งานโดยประมาณต่อวันตาม Fair Use, ชำระเงินหลักผ่าน Stripe, และช่วยทบทวนการจัดโครง diagnosis ตามแนวทาง สปสช/Thai DRG",
  },
  guidelines: {
    title:
      "แนวทางใช้งาน DischargeX — วิธีใช้ AI สรุปชาร์จและข้อควรระวังก่อนใช้งานจริง",
    description:
      "อ่านวิธีใช้ DischargeX แบบเป็นขั้นตอน พร้อมข้อควรระวังด้านข้อมูลผู้ป่วย ข้อจำกัดของ AI และแนวทางตรวจทานผลลัพธ์ก่อนนำไปใช้จริงในงานเวชระเบียน",
  },
};

const technicalCopy: SeoCatalog = {
  home: {
    title:
      "DischargeX | AI Clinical Documentation Support สำหรับสรุปชาร์จและ ICD-10 Review",
    description:
      "ระบบช่วยงานเอกสารคลินิกสำหรับโรงพยาบาลไทย: สร้าง draft สรุปชาร์จ, แนะนำ criteria ของ diagnosis เชิงหลักฐาน และช่วยทบทวน ICD-10/Thai DRG ใน workflow เวชระเบียน",
  },
  pricing: {
    title:
      "DischargeX Pricing | แพ็กเกจโควตา AI สำหรับสรุปชาร์จและ Coding Review",
    description:
      "เปรียบเทียบแพ็กเกจ Trial, Basic, Standard, Pro ของ DischargeX ตามจำนวนโควตาและระดับการช่วยทบทวน diagnosis/ICD-10 สำหรับงาน IPD",
  },
  guidelines: {
    title:
      "DischargeX Guidelines | ข้อกำหนดการใช้งาน, ความปลอดภัยข้อมูล, และการตรวจทานผล AI",
    description:
      "แนวทางใช้ DischargeX อย่างปลอดภัย: การปกปิดข้อมูลผู้ป่วย ข้อจำกัดของระบบ AI และขั้นตอนตรวจทานผลก่อนนำไปใช้ทางคลินิกหรือเอกสารเวชระเบียน",
  },
};

const thaiBrandCopy: SeoCatalog = {
  home: {
    title:
      "DischargeX — AI สำหรับสรุปชาร์จของแพทย์ไทยและทีมเวชระเบียน",
    description:
      "ช่วยสรุปชาร์จ จัดโครงวินิจฉัย และช่วยทบทวน ICD-10 ในงาน IPD ของโรงพยาบาลไทย ใช้งานง่ายและตรวจทานต่อได้จริง",
  },
  pricing: {
    title:
      "แพ็กเกจ DischargeX — ราคา AI ช่วยสรุปชาร์จสำหรับโรงพยาบาลไทย",
    description:
      "ดูแพ็กเกจ Trial, Basic, Standard และ Pro ของ DischargeX เลือกแผนให้เหมาะกับปริมาณเคสและ workflow งานเวชระเบียนของทีมคุณ",
  },
  guidelines: {
    title:
      "วิธีใช้ DischargeX — แนวทางสรุปชาร์จด้วย AI ให้ปลอดภัยและใช้งานได้จริง",
    description:
      "รวมขั้นตอนใช้งาน DischargeX ข้อควรระวังข้อมูลผู้ป่วย และวิธีตรวจทานผลก่อนนำไปใช้จริงโดยแพทย์หรือผู้ตรวจรหัส",
  },
};

export function getSeoVariant(): SeoVariant {
  const variant = process.env.SEO_VARIANT?.toLowerCase();
  if (variant === "technical") return "technical";
  if (variant === "thai_brand") return "thai_brand";
  return "conversion";
}

export function getSeoCopy(page: SeoPage): SeoCopy {
  const variant = getSeoVariant();
  if (variant === "technical") return technicalCopy[page];
  if (variant === "thai_brand") return thaiBrandCopy[page];
  return conversionCopy[page];
}
