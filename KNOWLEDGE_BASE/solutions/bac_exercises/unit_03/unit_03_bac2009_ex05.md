---
id: solution/unit_03_bac2009_ex05
type: solution
title_ar: حل بكالوريا 2009 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2009_ex05
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2009
stream: رياضي + تقني رياضي
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2009 – شعبة رياضي + تقني رياضي

## التمرين الخامس: دائرة وشيعة RL

**1-** المعادلة التفاضلية لشدة التيار:

$$L \frac{di}{dt} + (R + r) \cdot i = E$$

بوضع $R' = R + r$:

$$\frac{di}{dt} + \frac{R'}{L} \cdot i = \frac{E}{L}$$

**2-** في النظام الدائم، تسلك الوشيعة سلوك ناقل أومي عادي لأن $\frac{di}{dt} = 0$.

إذن، عبارة شدة التيار عندئذ:

$$I_0 = \frac{E}{R'} = \frac{E}{R + r}$$

**3- أ)** إيجاد العبارة الحرفية لكل من $A$ و $\tau$:

$$\frac{di}{dt} = -\frac{A}{\tau} \cdot e^{-\frac{t}{\tau}} \quad \text{؛} \quad i(t) = A \cdot e^{-\frac{t}{\tau}}$$

بالتعويض في المعادلة التفاضلية:

$$A \cdot \frac{R + r}{L} \cdot e^{-\frac{t}{\tau}} + \frac{E}{L} - \frac{A}{L} \cdot e^{-\frac{t}{\tau}} = 0$$

و منه:

$$\left(\frac{R + r}{L} - \frac{1}{L}\right) \cdot A \cdot e^{-\frac{t}{\tau}} + \frac{E}{L} = 0$$

$$A \cdot e^{-\frac{t}{\tau}} \cdot \left(\frac{R + r}{L}\right) + \frac{E}{L} = 0$$

بالतالي:

$$\tau = \frac{L}{R + r}$$

كذلك:

$$A \cdot (R + r) = E \quad \text{؛} \quad A = \frac{E}{L}$$

**ب)** استنتاج عبارة التوتر $u_{BC}$ بين طرفي الوشيعة:

$$u_{BC} = L \frac{di}{dt} + r \cdot i$$

حيث أن:

$$i(t) = -\frac{E}{R + r} \cdot e^{-\frac{(R + r) \cdot t}{L}}$$

بالتألي:

$$u_{BC} = L \times \frac{R + r}{L} \times \frac{E}{R + r} \cdot e^{-\frac{(R + r) \cdot t}{L}} + r \times \left(-\frac{E}{R + r}\right) \cdot e^{-\frac{(R + r) \cdot t}{L}}$$

إذن:

$$u_{BC} = E \cdot e^{-\frac{(R + r) \cdot t}{L}} + \frac{E \cdot r}{R + r} \cdot \left(1 - e^{-\frac{(R + r) \cdot t}{L}}\right)$$

**4- أ)** حساب قيمة التوتر $u_{BC}$ في النظام الدائم:

في هذه الحالة: $E = (R + r) \cdot I_0$

$$u_{BC} = r \cdot I_0 = E + \frac{r}{R + r} \cdot E$$

إذن: $u_{BC} = 1 \text{ V}$

**ب)** رسم كيفي لبيان تغير التوتر الكهربائي بين طرفي الوشيعة.
