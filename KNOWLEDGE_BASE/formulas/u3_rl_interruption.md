---
id: formula/u3_rl_interruption
type: formula
title_ar: حلول انقطاع التيار في ثنائي القطب RL
symbol: i(t), uL(t), uR(t)
unit: A ; V
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/rl_dipole]
related_exercises: []
review_notes: ["RQ-001"]
---

# حلول انقطاع التيار في ثنائي القطب RL

المعادلة $\frac{di}{dt} + \frac{R+r}{L}i = 0$؛ حلها (باعتماد $I_0 = \frac{E}{R+r}$، $\tau = \frac{L}{R+r}$):

$$i(t) = I_0\,e^{-\frac{t}{\tau}}$$

$$u_R(t) = R.I_0\,e^{-\frac{t}{\tau}}$$

$$u_L(t) = -R.I_0\,e^{-\frac{t}{\tau}}$$

المصدر معزول؛ تفرغ الوشيعة طاقتها في الدارة، وهنا تظهر ظاهرة التوترات العكسية.