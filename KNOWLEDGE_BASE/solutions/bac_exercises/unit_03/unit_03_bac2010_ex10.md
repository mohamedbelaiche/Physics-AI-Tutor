---
id: solution/unit_03_bac2010_ex10
type: solution
title_ar: حل بكالوريا 2010 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2010_ex10
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2010
stream: رياضي + تقني رياضي
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2010 – شعبة رياضي + تقني رياضي – التمرين 10

**1 – أ** – حساب شدة التيار الكهربائي I₀ في النظام الدائم وقيمة ثابت الزمن τ للدار:

$$I_0 = 0.24 \text{ A}$$

$$\tau = 10 \text{ ms}$$

**ب** – قيمة المقاومة r والذاتية L للوشيعة:

في النظام الدائم:

$$E = (R + r) I_0 \Rightarrow r = \frac{E}{I_0} - R = 7.5 \text{ Ω}$$

$$\tau_L = \frac{L}{R+r} \Rightarrow L = \tau(R+r) = 0.25 \text{ H}$$

**2 – أ** – إثبات أن:

$$\tau \frac{di}{dt} + i = I_0$$

$$L \frac{di}{dt} + (R+r)i = E$$

$$E = (R+r)I_0$$

$$\tau = \frac{L}{R+r}$$

$$\frac{di}{dt} + \frac{R+r}{L} i = \frac{E}{L}$$

$$\tau \frac{di}{dt} + i = I_0$$

**ب** – إثبات أن حل المعادلة هو من الشكل:

$$i(t) = I_0 \left(1 - e^{-\frac{t}{\tau}}\right)$$

بالتعويض في المعادلة التفاضلية نجد أن:

$$i(t) = I_0 \left(1 - e^{-\frac{t}{\tau}}\right)$$

هو حل لها.

**3 – أ** – رسم البيان h(τ):

(انظر الشكل المرفق)

**ب** – معادلة البيان:

$$h = a\tau$$

$$25 L = h$$

**ج** – قيمة مقاومة الوشيعة r:

$$\tau_L = \frac{L}{R+r} \Rightarrow L = \tau(R+r)$$

$$25 L = 17.5\tau + 7.5\tau$$

$$25 = r + R$$

$$r = 25 - 17.5 = 7.5 \text{ Ω}$$

وهي نفس النتيجة المحسوبة سابقاً للمقاومة r.
