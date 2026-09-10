export function GuideVideo() {
  return <section className="mb-10 rounded-xl border border-slate-700 bg-slate-900 p-5">
    <h2 className="text-xl font-semibold">ดูภาพรวมใน 24 วินาที</h2>
    <p className="mb-4 mt-2 text-sm text-slate-300">คลิปไม่มีเสียง ใช้ภาพตัวอย่างอธิบาย 4 ขั้นตอน เปิดเต็มจอเพื่ออ่านตัวหนังสือได้ชัดขึ้น</p>
    <video controls playsInline preload="metadata" className="w-full rounded-lg" aria-label="ภาพแนะนำขั้นตอนเริ่มใช้ DischargeX ไม่มีเสียง">
      <source src="/media/guide-overview.mp4" type="video/mp4" />
      <a href="/media/guide-overview.mp4">ดาวน์โหลดคลิปแนะนำ</a>
    </video>
    <details className="mt-4 text-sm text-slate-300"><summary className="cursor-pointer">อ่านข้อความแทนคลิป</summary><ol className="mt-3 list-decimal space-y-2 pl-5"><li>เตรียม Order Sheet และตรวจว่าข้อมูลครบ</li><li>กดสร้างสรุปและรอผล ไม่ต้องกดซ้ำ</li><li>ตรวจวันที่ diagnosis และผลสรุปเทียบกับบันทึกก่อนนำไปใช้</li><li>หากใช้ Auto ให้ตั้งค่าเครื่องและทดสอบก่อน พักด้วย F9 หยุดด้วย F10</li></ol></details>
  </section>;
}
