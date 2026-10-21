import type { Metadata } from "next";
import Link from "next/link";
import { Prompt } from "next/font/google";
import LandingPricingPreview from "./components/LandingPricingPreview";
import LandingImpactStats from "./components/LandingImpactStats";
import styles from "./landing.module.css";

const prompt = Prompt({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: { absolute: "DischargeX — สรุปชาร์จและทบทวน coding สำหรับงาน IPD" },
  description: "DischargeX ผู้ช่วยจัดร่าง Discharge Summary และตรวจทานรหัส ICD-10 สำหรับบุคลากรทางการแพทย์",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DischargeX — สรุปชาร์จและทบทวน coding สำหรับงาน IPD",
    description: "ดูวิธีจัดร่างสรุปชาร์จและทบทวน coding แล้วลองด้วยข้อมูลตัวอย่างได้ทันที",
    url: "https://dischargex.net", locale: "th_TH", type: "website",
  },
};

const demoHref = "/app/guest?tutorial=1";

function DocumentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 2h9l5 5v15H4V4a2 2 0 0 1 2-2zM14 2v6h6M8 12h8M8 16h8" /></svg>;
}

export default function Home() {
  return (
    <main className={`${styles.root} ${prompt.className}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DischargeX", url: "https://dischargex.net",
        applicationCategory: "HealthApplication", operatingSystem: "Web", description: "ผู้ช่วยสร้างร่างสรุปชาร์จให้ผู้ใช้ตรวจทาน",
      }) }} />

      <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AI สำหรับสรุปชาร์จ · ทบทวน ICD-10<br />และช่วยชี้จุดทบทวน Coding / AdjRW</p>
          <h1 id="hero-title" className={styles.heroTitle}>สรุปชาร์จ<br />ให้เป็น<span className={styles.gradientText}>ระเบียบ</span></h1>
          <p className={styles.heroSub}>เปลี่ยนข้อมูลการรักษาเป็นร่างสรุปจำหน่าย<br />ที่อ่านง่าย พร้อมช่วยตรวจทานรหัส ICD-10</p>
          <div className={styles.heroActions}>
            <Link href={demoHref} className={`${styles.button} ${styles.primary}`}>ลองด้วยข้อมูลตัวอย่าง <span aria-hidden="true" style={{ fontSize: 24, lineHeight: 1 }}>→</span></Link>
            <Link href="#pricing" className={`${styles.button} ${styles.outline}`}>ดูแพ็กเกจ</Link>
          </div>
          <div className={styles.trustRow}>
            <div className={styles.trustItem}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" aria-hidden="true"><path d="M12 2 20 5v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z" /></svg><div><strong>ใช้งานง่าย</strong><small>ออกแบบเพื่อเวชปฏิบัติ</small></div></div>
            <div className={styles.trustItem}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg><div><strong>เน้นความเป็นระเบียบ</strong><small>โครงสร้างชัดเจน อ่านง่าย</small></div></div>
            <div className={styles.trustItem}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="12" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v3" /></svg><div><strong>ใส่ใจข้อมูลระบุตัวตน</strong><small>ตรวจทานข้อมูลก่อนส่ง AI</small></div></div>
          </div>
        </div>

        <div className={styles.preview} aria-label="วิดีโอแนะนำการใช้งาน DischargeX">
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.videoWindow}>
            <div className={styles.windowTop}><span className={styles.traffic} aria-hidden="true"><i /><i /><i /></span><span>DischargeX · วิดีโอแนะนำการใช้งาน</span><span aria-hidden="true">VIDEO</span></div>
            <div className={styles.videoFrame}>
              <iframe src="https://www.youtube-nocookie.com/embed/_mIpiKuYrV4" title="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
            </div>
          </div>
          <div className={styles.videoCaption}><span>ผลลัพธ์ต้องตรวจทานก่อนใช้</span><a href="https://youtu.be/_mIpiKuYrV4?si=6-msUGWTH_9h4lQV" target="_blank" rel="noreferrer">เปิดวิดีโอใน YouTube ↗</a></div>
        </div>
      </section>

      <section className={`${styles.features} ${styles.container}`} aria-label="ความสามารถหลัก">
        <article className={styles.feature}><div className={styles.featureHeading}><span className={styles.featureIcon}><DocumentIcon /></span><div><h3>ช่วยร่าง Discharge Summary<br />อย่างเป็นระเบียบ</h3><p>จัดโครงสร้างอัตโนมัติ ครอบคลุม<br />ประเด็นสำคัญ อ่านง่าย</p></div></div><div className={styles.featureArt} aria-hidden="true">{[42,92,67,48,80,59].map((width) => <div key={width} className={styles.skeleton} style={{ width: `${width}%` }} />)}</div></article>
        <article className={styles.feature}><div className={styles.featureHeading}><span className={styles.featureIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 3v7a5 5 0 0 0 10 0V3M4 3h4M14 3h4M11 16v1a4 4 0 0 0 8 0v-2" /><circle cx="19" cy="13" r="2" /></svg></span><div><h3>ตรวจทานรหัส ICD-10</h3><p>เสนอ diagnosis และรหัส ICD-10<br />เพื่อให้ผู้ใช้ตรวจทาน</p></div></div><div className={`${styles.featureArt} ${styles.icdArt}`} aria-hidden="true">{[["J18.9", "Pneumonia, unspecified"], ["I10", "Essential hypertension"], ["E11.9", "Type 2 diabetes mellitus"]].map(([code, text]) => <div key={code} className={styles.icdRow}><span className={styles.icdBullet}>✓</span><span className={styles.icdCode}>{code}</span>{text}</div>)}</div></article>
        <article className={styles.feature}><div className={styles.featureHeading}><span className={styles.featureIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="8" y="7" width="12" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2" /></svg></span><div><h3>ทบทวน Coding และ AdjRW</h3><p>ช่วยชี้จุดที่อาจตกหล่น<br />และแสดงค่าประมาณ AdjRW</p></div></div><div className={`${styles.featureArt} ${styles.copyArt}`} aria-hidden="true">{[61,85,65].map((width) => <div key={width} className={styles.skeleton} style={{ width: `${width}%` }} />)}</div><div className={styles.floatingCopy} aria-hidden="true">▣ คัดลอก</div></article>
      </section>

      <section className={`${styles.benefits} ${styles.container}`} aria-label="ประโยชน์ของ DischargeX">
        <p className={styles.overline}>ทำไมต้องใช้ DischargeX</p><h2 className={styles.sectionTitle}>ไม่ได้ช่วยแค่สรุปข้อความ <span className={styles.cyan}>แต่ช่วยให้ตรวจทานได้ครบขึ้น</span></h2>
        <div className={styles.benefitGrid}>{["ช่วยลดเวลาจัดทำร่างสรุปชาร์จ", "ช่วยชี้ข้อมูลสำคัญที่อาจพิมพ์ผิดหรือตกหล่น", "เสนอ ICD ที่สอดคล้องกับข้อมูลเพื่อให้ทบทวน", "ชี้จุดที่ควรตรวจทานก่อนนำไปใช้งานจริง"].map((text) => <div key={text} className={styles.benefit}><span className={styles.benefitCheck}>✓</span><span>{text}</span></div>)}</div>
        <p className={styles.benefitFootnote}>เป็นเครื่องมือช่วยทบทวน ไม่ใช่ระบบวินิจฉัยหรือรับรองการจัดกลุ่ม DRG อย่างเป็นทางการ</p>
      </section>

      <section id="how-it-works" className={`${styles.stepsSection} ${styles.container}`} aria-labelledby="steps-title">
        <h2 id="steps-title" className={styles.sectionTitle}>ใช้งานง่ายใน <span className={styles.cyan}>3 ขั้นตอน</span></h2>
        <div className={styles.steps}>
          <div className={styles.step}><span className={styles.number}>1</span><span className={styles.stepIcon}><DocumentIcon /></span><div className={styles.stepText}><strong>วางข้อมูล</strong><small>คัดลอกข้อมูลการรักษา<br />หรือพิมพ์สรุปย่อ</small></div></div><span className={styles.stepArrow} aria-hidden="true" />
          <div className={styles.step}><span className={styles.number}>2</span><span className={styles.stepIcon}><DocumentIcon /></span><div className={styles.stepText}><strong>ได้รับร่างสรุป</strong><small>ระบบจัดโครงสร้างเป็น<br />ร่าง Discharge Summary</small></div></div><span className={styles.stepArrow} aria-hidden="true" />
          <div className={styles.step}><span className={styles.number}>3</span><span className={styles.stepIcon}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></svg></span><div className={styles.stepText}><strong>ตรวจทานก่อนใช้</strong><small>ตรวจสอบเนื้อหาและรหัส ICD-10<br />ก่อนคัดลอกไปใช้งาน</small></div></div>
        </div>
      </section>

      <section className={`${styles.stats} ${styles.container}`} aria-label="ภาพรวมการใช้งาน">
        <LandingImpactStats />
      </section>

      <div className={styles.pricing}><LandingPricingPreview /></div>
      <div id="review-note" className={`${styles.disclaimer} ${styles.container}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7h.01" /></svg><span>ผลลัพธ์เป็นร่างสำหรับตรวจทานก่อนใช้งานจริง โปรดตรวจสอบความถูกต้องของเนื้อหาและรหัส ICD-10 ก่อนนำไปใช้ในเวชระเบียน</span></div>
    </main>
  );
}
