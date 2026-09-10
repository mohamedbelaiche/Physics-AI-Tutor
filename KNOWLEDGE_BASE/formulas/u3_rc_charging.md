---
id: formula/u3_rc_charging
type: formula
title_ar: حلول الشحن لثنائي القطب RC
symbol: uC(t), i(t), uR(t)
unit: V ; A
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/rc_dipole]
related_exercises: []
review_notes: ["RQ-001"]
---

# حلول الشحن لثنائي القطب RC

المعادلة التفاضلية $\frac{du_C}{dt} + \frac{1}{RC}u_C = \frac{E}{RC}$؛ حلها (مع τ = RC):

$$u_C(t) = E\left(1 - e^{-\frac{t}{RC}}\right)$$

$$i(t) = \frac{E}{R}\,e^{-\frac{t}{RC}}$$

$$u_R(t) = E\,e^{-\frac{t}{RC}}$$

اكتمال الشحن: $i \to 0$ و $u_C \to E$.