---
id: concept/rc_dipole
type: concept
title_ar: ثنائي القطب RC (شحن/تفريغ)
title_en: RC dipole (charging/discharging)
unit: unit3
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/capacitor, concept/time_constant_rc, concept/capacitor_energy]
related_formulas: [formula/u3_rc_charging, formula/u3_rc_discharging]
related_exercises: []
review_notes: ["RQ-001"]
---

# ثنائي القطب RC

## آلية الدراسة (المنهجية)

1. تحقيق التركيب التجريبي (مولد + قاطعة + مكثفة + ناقل أومي، مع بادلة).
2. تطبيق قانوني جمع التوترات وقانون أوم.
3. توظيف $i = C\frac{du_C}{dt}$ لإقامة المعادلة التفاضلية ثم حلها.

## الشحن (الوضع 1)

$$u_R + u_C = E \implies RC\frac{du_C}{dt} + u_C = E$$

$$\frac{du_C}{dt} + \frac{1}{RC}u_C = \frac{E}{RC}$$

الحلول:

$$u_C(t) = E\left(1 - e^{-\frac{t}{RC}}\right) \qquad i(t) = \frac{E}{R}e^{-\frac{t}{RC}} \qquad u_R(t) = E\,e^{-\frac{t}{RC}}$$

## التفريغ (الوضع 2)

$$u_R + u_C = 0 \implies \frac{du_C}{dt} + \frac{1}{RC}u_C = 0$$

الحلول:

$$u_C(t) = E\,e^{-\frac{t}{RC}} \qquad i(t) = -\frac{E}{R}e^{-\frac{t}{RC}} \qquad u_R(t) = -E\,e^{-\frac{t}{RC}}$$

## سلوكيات

- اكتمال الشحن: i = 0 و u_C ≈ E.
- أثناء التفريغ تمرار التيار بعكس جهة الشحن؛ المكثفة **مولد مؤقت**.
- عند الإفراغ: u_C = 0.