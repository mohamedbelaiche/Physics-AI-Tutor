---
id: concept/coil_energy
type: concept
title_ar: الطاقة المخزنة في الوشيعة
title_en: Energy stored in the coil
unit: unit3
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/coil, concept/rl_dipole]
related_formulas: [formula/u3_coil_energy]
related_exercises: []
review_notes: ["RQ-001"]
---

# الطاقة المخزنة في الوشيعة

$$E_L = \frac{1}{2}L\,i^2$$

## أثناء ظهور التيار ($i = I_0(1 - e^{-t/\tau})$)

$$E_L(t) = \frac{1}{2}L I_0^2 \left(1 - e^{-\frac{t}{\tau}}\right)^2$$

الطاقة الأعظمية: $E_{L,max} = \frac{1}{2}L I_0^2$.

## أثناء انقطاع التيار ($i = I_0 e^{-t/\tau}$)

$$E_L(t) = \frac{1}{2}L I_0^2\,e^{-\frac{2t}{\tau}}$$