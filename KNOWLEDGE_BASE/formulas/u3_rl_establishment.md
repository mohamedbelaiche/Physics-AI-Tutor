---
id: formula/u3_rl_establishment
type: formula
title_ar: حلول ظهور التيار في ثنائي القطب RL
symbol: i(t), uL(t), uR(t)
unit: A ; V
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/rl_dipole]
related_exercises: []
review_notes: ["RQ-001"]
---

# حلول ظهور التيار في ثنائي القطب RL

المعادلة $\frac{di}{dt} + \frac{R+r}{L}i = \frac{E}{L}$؛ حلها (مع $I_0 = \frac{E}{R+r}$، $\tau = \frac{L}{R+r}$):

$$i(t) = I_0\left(1 - e^{-\frac{t}{\tau}}\right)$$

$$u_L(t) = r.I_0 + R.I_0\,e^{-\frac{t}{\tau}}$$

$$u_R(t) = R.I_0\left(1 - e^{-\frac{t}{\tau}}\right)$$

نحو النظام الدائم: $i \to I_0$، $u_R \to R.I_0$، $u_L \to r.I_0$.