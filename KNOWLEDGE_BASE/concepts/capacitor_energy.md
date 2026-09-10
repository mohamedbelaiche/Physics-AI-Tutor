---
id: concept/capacitor_energy
type: concept
title_ar: الطاقة المخزنة في المكثفة
title_en: Energy stored in the capacitor
unit: unit3
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/capacitor, concept/rc_dipole]
related_formulas: [formula/u3_capacitor_energy]
related_exercises: []
review_notes: ["RQ-001"]
---

# الطاقة المخزنة في المكثفة

$$E_C = \frac{1}{2}C\,u_C^2$$

## أثناء الشحن

$$E_C(t) = \frac{1}{2}C E^2 \left(1 - e^{-\frac{t}{RC}}\right)^2$$

الطاقة الأعظمية: $E_{C,max} = \frac{1}{2}C E^2$.

## أثناء التفريغ

$$E_C(t) = \frac{1}{2}C E^2\,e^{-\frac{2t}{RC}}$$

## زمن تناقص الطاقة إلى النصف

$$t_{1/2} = \tau \ln 2$$