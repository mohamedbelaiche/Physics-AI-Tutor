---
id: solution/unit_03_bac2010_ex11
type: solution
title_ar: حل بكالوريا 2010 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2010_ex11
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2010
stream: رياضي + تقني رياضي
topic: مكثفة RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2010 – شعبة رياضي + تقني رياضي – التمرين 11

**1 – أ** – قيمة ثابت الزمن τ وقيمة التوتر الكهربائي بين طرفي المولد ثم حساب سعة المكثفة C:

$$\tau = 14 \text{ ms}$$

$$E = 14.8 \text{ V}$$

$$\tau = R \cdot C \Rightarrow C = \frac{\tau}{R} = \frac{28 \times 10^{-6}}{1} = 28 \text{ μF}$$

**ب** – تحديد المدة الزمنية t' لاكتمال عملية شحن المكثفة:

$$u_C(t') = \frac{99}{100} \times 14.8 = 14.65 \text{ V}$$

بيانياً:

$$t' = 70 \text{ ms}$$

**ج** – العلاقة بين t' و τ:

$$t' = 5\tau$$

**2** – المعادلة التفاضلية بدالة التوتر الكهربائي بين طرفي المكثفة:

باتباع قانون جمع التوتر:

$$E = u_C + u_R$$

$$E = u_C + R \cdot i$$

$$i = C \frac{du_C}{dt} = C \frac{dq}{dt}$$

$$E = u_C + RC \frac{du_C}{dt}$$

ومنه:

$$\frac{du_C}{dt} + \frac{1}{RC} u_C - \frac{E}{RC} = 0$$

**الإثبات** أنها تقبل حالاً من الشكل:

$$u_C(t) = E\left(1 - e^{-\frac{t}{\tau}}\right)$$

$$\frac{du_C(t)}{dt} = \frac{E}{\tau} e^{-\frac{t}{\tau}}$$

بالتعويض في م. ت:

$$\frac{E}{\tau} e^{-\frac{t}{\tau}} + \frac{1}{RC} E\left(1 - e^{-\frac{t}{\tau}}\right) - \frac{E}{RC} = 0$$

ومنه: 0 = 0

**3** – قيمة الطاقة الكهربائية المخزنة Ec في المكثفة عند اللحظات:

t = 0، t₁ = τ و t₂ = 5τ:

$$E_C(t) = \frac{1}{2} C u_C^2(t)$$

ومنه:

$$E_C(0) = 0 \text{ J}$$

$$E_C(\tau) = \frac{1}{2} C E (0.63)^2 = 1.21 \times 10^{-3} \text{ J}$$

$$E_C(5\tau) = \frac{1}{2} C E (0.99)^2 = 3 \times 10^{-3} \text{ J}$$
