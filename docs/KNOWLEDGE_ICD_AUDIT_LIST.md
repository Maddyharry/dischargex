# Knowledge ICD Audit List

Updated: 2026-04-25

Purpose:
- Use this as an internal checklist for coder/physician review before final coding.
- Knowledge entries now contain practical default ICD codes, but final coding must follow chart evidence and official coding rules.

## How To Use

- Step 1: Match the clinical narrative with the topic in Knowledge.
- Step 2: Verify if the selected code is a true diagnosis/procedure for this admission.
- Step 3: Replace default "unspecified" codes with more specific codes only when chart evidence supports it.
- Step 4: For procedures, use ICD-9-CM from procedure documentation (not diagnosis text only).

## Topic Audit Notes

### Sepsis / Septic shock
- Default: `A41.9` + optional `R65.1` / `R57.2`.
- Upgrade to specific organism only with documented microbiology/physician diagnosis.
- Do not code septic shock without hypotension/perfusion criteria and treatment context.

### Pneumonia
- Default: `J18.9`.
- Use `J69.0` only with aspiration context evidence.
- Add `J96.0` only if hypoxemia/respiratory support criteria are met.

### AKI / CKD
- Defaults: `N17.9`, `N18.9`, `N18.5`.
- Confirm AKI criteria from trend and timing before coding.
- Use ESRD (`N18.5`) only with clear CKD stage 5 context.

### Acute bronchitis
- Default: `J20.9`.
- Do not upcode to pneumonia without imaging/clinical support.

### Asthma exacerbation
- Default: `J45.9`.
- Add ARF only when oxygenation/respiratory support criteria are present.

### Cirrhosis / variceal context
- Defaults include `K74.6`, `I85.9`, `I85.0`, `K72.9`.
- Use bleeding varices code only when bleeding is clinically documented.

### Acute appendicitis / peritonitis
- Default appendicitis: `K35.9`.
- Use perforation/peritonitis codes only when operative/clinical evidence supports.

### Acute pancreatitis
- Default: `K85.9`.
- Upgrade etiology-specific codes only with documented etiology.

### Influenza / viral respiratory infection
- Defaults: `J10.1`, `J11.1`, `J12.9`.
- Choose confirmed vs unconfirmed influenza based on test/diagnostic documentation.

### Stroke and sequelae
- Defaults: `I63.9`, `I61.9`, `I69.3/I69.4`, `G81.9`.
- Distinguish acute event vs old sequelae carefully.
- Do not use sequelae codes without persistent residual deficits.

### Seizure
- Defaults: `R56.8`, `G40.9`.
- Use epilepsy code only when chronic/recurrent diagnosis is documented.

### Meningitis / encephalitis
- Defaults: `G00.9`, `G03.9`, `G04.9`, `B45.1`.
- Use organism/specific cause codes only with laboratory or definitive documentation.

### Postpartum hemorrhage
- Defaults: `O72.1`, `O72.2`, `O75.1`, `D62`.
- Verify timing (immediate vs delayed) and shock/anemia criteria before assigning combinations.

### Neonatal sepsis
- Default: `P36.9`.
- Upgrade to specific neonatal sepsis subtype only with clear evidence.

### UTI / pyelonephritis / cystitis
- Defaults: `N39.0`, `N10`, `N30.0`.
- Use pyelonephritis only when upper UTI context exists.

### Tropical infections
- Malaria defaults: `B50.9`, `B51.9`, `B52.9`, `B54`.
- Melioidosis default: `A24.9` (with sepsis context often `A41.9`).
- Leptospirosis default: `A27.9`.
- Use species-specific codes only when confirmed.

### Cellulitis / necrotizing fasciitis
- Default cellulitis: `L03.9`.
- `M72.6` requires strong clinical/operative evidence.

## Procedure Coding (ICD-9-CM)

### Blood transfusion
- `99.03`, `99.04`, `99.05`, `99.06`
- Must have actual transfusion record, not order only.

### Dialysis procedures
- `39.95`, `54.93`, `54.95`, `54.98`
- Separate ICD-10 status/care codes (`Z49.x`, `Z99.2`) from procedure coding.

### Debridement
- `86.28` (non-excisional), `86.22` (excisional)
- Use excisional only when operative evidence clearly supports excisional tissue removal.

### Lumbar puncture
- `03.31`
- Must have procedure note.

### Thoracentesis / chest tube
- `34.91`, `34.04`
- Must have procedure documentation.

## Remaining Broad Category By Design

- External cause remains broad category (`V01-Y98`) by design.
- Final external cause coding must be selected from mechanism/place/activity details in chart.

## Governance Note

- This list is an internal operational aid, not a replacement for official coding manuals or institutional policy.
- Final coding responsibility remains with licensed/assigned medical coding reviewers and physicians.
