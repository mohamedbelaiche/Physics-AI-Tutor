---
id: concept/rl_dipole
type: concept
title_ar: ثنائي القطب RL (ظهور/انقطاع التيار)
title_en: RL dipole (establishment/interruption of current)
unit: unit3
status: needs_review
source_refs:
  - api/data/البيانات/الوحدة الثالثة/ملخص الوحدة/ملخص الوحدة الثالثة.pdf
related_concepts: [concept/coil, concept/time_constant_rl, concept/coil_energy]
related_formulas: [formula/u3_rl_establishment, formula/u3_rl_interruption]
related_exercises: []
review_notes: ["RQ-001"]
---

# ثنائي القطب RL

## الظهور (تطبيق التيار)

بتطبيق قانون جمع التوترات $u_R + u_L = E$:

$$(R + r)\,i + L\frac{di}{dt} = E \implies \frac{di}{dt} + \frac{R + r}{L}i = \frac{E}{L}$$

الحل (مع $I_0 = \frac{E}{R+r}$، $\tau = \frac{L}{R+r}$):

$$i(t) = I_0\left(1 - e^{-\frac{t}{\tau}}\right)$$

$$u_L(t) = r.I_0 + R.I_0\,e^{-\frac{t}{\tau}} \qquad u_R(t) = R.I_0\left(1 - e^{-\frac{t}{\tau}}\right)$$

## الانقطاع (قطع التيار)

$$u_R + u_L = 0 \implies \frac{di}{dt} + \frac{R + r}{L}i = 0$$

الحلول:

$$i(t) = I_0\,e^{-\frac{t}{\tau}} \qquad u_R(t) = R.I_0\,e^{-\frac{t}{\tau}} \qquad u_L(t) = -R.I_0\,e^{-\frac{t}{\tau}}$$

## ملاحظات

- نفس المنهجية المستعملة في RC (جمع التوترات + أوم)، مع توظيف $u_L = r.i + L\frac{di}{dt}$.
- سلوك أسّي: خلال التطبيق i تصعد نحو I0؛ خلال الانقطاع تتناقص إلى 0.