"use client";



export type WorkspaceCoachPhase = "workspace_click" | "workspace_paste" | "generate_prompt";



export const WORKSPACE_COACH_COPY: Record<

  WorkspaceCoachPhase,

  { title: string; body: string; target: string; stepLabel: string }

> = {

  workspace_click: {

    stepLabel: "หลังคัดลอกจากหน้าต่างตัวอย่าง",

    title: "คลิกซ้ายในช่อง Clinical ก่อน",

    body: "ถ้าหน้าต่างตัวอย่างยังเปิดอยู่ ให้ปิดด้วยปุ่มสีเหลืองที่หน้าต่างนั้นก่อนก็ได้ จากนั้นคลิกซ้ายในช่องข้อความด้านบน (มีขอบไฮไลต์) แล้วค่อยวางในขั้นถัดไป",

    target: "ช่อง Clinical Input Workspace",

  },

  workspace_paste: {

    stepLabel: "วางข้อความ",

    title: "วาง order sheet",

    body: "กด Ctrl+V หรือคลิกขวาแล้วเลือกวาง — วางข้อความที่คัดลอกจากหน้าต่างตัวอย่างลงในช่องนี้",

    target: "ช่องเดิม",

  },

  generate_prompt: {

    stepLabel: "สร้างสรุป",

    title: "กดปุ่ม สร้างสรุป",

    body: "เมื่อมีข้อความในช่องแล้ว กดปุ่มสีฟ้า — ระบบจะแสดงหน้ารอและผลจำลอง",

    target: "ปุ่ม สร้างสรุป",

  },

};


