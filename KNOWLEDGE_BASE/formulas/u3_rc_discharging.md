---
id: formula/u3_rc_discharging
type: formula
title_ar: حلول التفريغ لثنائي القطب RC
symbol: uC(t), i(t), uR(t)
unit: V ; A
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/rc_dipole]
related_exercises: []
review_notes: ["RQ-001"]
---

# حلول التفريغ لثنائي القطب RC

المعادلة التفاضلية $\frac{du_C}{dt} + \frac{1}{RC}u_C = 0$؛ حلها:

$$u_C(t) = E\,e^{-\frac{t}{RC}}$$

$$i(t) = -\frac{E}{R}\,e^{-\frac{t}{RC}}$$

$$u_R(t) = -E\,e^{-\frac{t}{RC}}$$

أثناء التفريغ يشير التيار إلى الجهة المعاكسة (المكثفة تعمل مولدًا).