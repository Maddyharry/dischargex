"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../landing.module.css";

type BillingCycle = "monthly" | "yearly";

const plans = [
  { name: "Basic", monthly: "299", yearly: "2,990", average: "249", daily: 5, cases: "15–18", detail: "Principal / Comorbidity / Complication · แนะนำ ICD-10 / ICD-9" },
  { name: "Standard", monthly: "590", yearly: "5,990", average: "499", daily: 10, cases: "30–35", detail: "Diagnosis พร้อม Admit / Discharge และส่วนประกอบสรุปชาร์จ", featured: true },
  { name: "Pro", monthly: "1,090", yearly: "10,990", average: "916", daily: 20, cases: "55–65", detail: "ทุกอย่างใน Standard พร้อมเครื่องมือทบทวน coding และ AdjRW ประมาณการ" },
];

export default function LandingPricingPreview() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <section id="pricing" className={`${styles.container} scroll-mt-8`} aria-labelledby="pricing-heading">
      <div className={styles.pricingHeader}>
        <p className={styles.overline}>เลือกให้ตรงกับปริมาณงาน</p>
        <h2 id="pricing-heading" className={styles.sectionTitle}>แพ็กเกจใช้งาน</h2>
        <p className={styles.sectionSub}>ทดลองฟรีก่อน แล้วเลือกแพ็กเกจที่เหมาะกับงานของคุณ</p>
        <div className={styles.billingToggle} role="group" aria-label="เลือกรอบการชำระเงิน">
          {(["monthly", "yearly"] as const).map((value) => {
            const active = cycle === value;
            return <button key={value} type="button" aria-pressed={active} onClick={() => setCycle(value)} className={styles.billingButton}>
              {value === "monthly" ? "รายเดือน" : <>รายปี <span>ประหยัดกว่า</span></>}
            </button>;
          })}
        </div>
      </div>

      <div className={styles.pricingGrid}>
        <article className={styles.priceCard}>
          <h3 className={styles.priceName}>Trial</h3><p className={styles.priceDesc}>ลองก่อน ตัดสินใจทีหลัง</p><p className={styles.priceAmount}>ฟรี</p>
          <p className={styles.pricePeriod}>ทดลอง 14 วัน</p>
          <ul className={styles.priceList}><li>✓ รวม 5 เคสตลอดช่วงทดลอง</li><li>✓ สูงสุด 2 เคสต่อวัน</li><li>✓ ทดลองฟีเจอร์ตามเงื่อนไข</li></ul>
          <Link href="/signup" className={`${styles.button} ${styles.outline} ${styles.priceAction}`}>สมัครทดลองฟรี</Link>
        </article>
        {plans.map((plan) => <article key={plan.name} className={`${styles.priceCard} ${plan.featured ? styles.priceFeatured : ""}`}>
          {plan.featured ? <span className={styles.popularBadge}>แนะนำ</span> : null}
          <h3 className={styles.priceName}>{plan.name}</h3><p className={styles.priceDesc}>{plan.name === "Basic" ? "ช่วยคิด Diagnosis" : plan.name === "Standard" ? "ครบสำหรับงานสรุปชาร์จประจำวัน" : "เชิงลึกสำหรับเคสซับซ้อน"}</p>
          <p className={styles.priceAmount} aria-live="polite">{cycle === "monthly" ? plan.monthly : plan.yearly}฿ <span className={styles.priceCycle}>{cycle === "monthly" ? "/ เดือน" : `/ ปี · เฉลี่ย ${plan.average}฿/เดือน`}</span></p>
          <p className={styles.pricePeriod}>สูงสุด {plan.daily} เคส/วัน</p>
          <ul className={styles.priceList}><li>✓ โดยประมาณ {plan.cases} เคส/เดือน</li><li>✓ {plan.detail}</li></ul>
          <Link href="/pricing" className={`${styles.button} ${plan.featured ? styles.primary : styles.outline} ${styles.priceAction}`}>เลือก {plan.name}</Link>
        </article>)}
      </div>
      <div className={styles.boostStrip}>
        <div><strong>ต้องการใช้งานเพิ่ม? เลือก Boost ได้</strong><p>5 สิทธิ์ 109฿ หรือ 15 สิทธิ์ 299฿ · เคสยาวหรือมีรูปอาจใช้ 2 สิทธิ์</p></div>
        <Link href="/pricing" className={`${styles.button} ${styles.outline} ${styles.boostAction}`}>ดูเงื่อนไข Boost</Link>
      </div>
      <p className={styles.pricingNote}>จำนวนเคสต่อเดือนเป็นค่าประมาณจากวงเงิน AI ไม่ใช่โควตารับประกัน การใช้งานขึ้นกับความยาวข้อความและจำนวนภาพ · แพ็กเกจรายปีชำระเต็มรอบ · <Link href="/pricing">ดูรายละเอียดสิทธิ์และราคาเต็ม</Link></p>
    </section>
  );
}
