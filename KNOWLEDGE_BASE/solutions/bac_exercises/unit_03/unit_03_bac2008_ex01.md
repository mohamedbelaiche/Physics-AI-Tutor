---
id: solution/unit_03_bac2008_ex01
type: solution
title_ar: حل بكالوريا 2008 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2008_ex01
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2008
stream: رياضي + تقني رياضي
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2008 – شعبة رياضي + تقني رياضي

## التمرين الأول: دائرة وشيعة RL

**1- مخطط الدار:**

(انظر الشكل)

**2- أ)**

$$u_{AB} = E \quad \text{؛} \quad u_{AB} = L \frac{di}{dt} + r \cdot i$$

إذن:

$$L \frac{di}{dt} + r \cdot i = E$$

أو:

$$\frac{di}{dt} + \frac{r}{L} \cdot i - \frac{E}{L} = 0$$

**ب)** التحقق من أن $i(t) = I_0 \left(1 - e^{-\frac{r}{L} \cdot t}\right)$ هو حل للمعادلة التفاضلية السابقة:

بالتعويض بالعبارتين:

$$i(t) = I_0 \left(1 - e^{-\frac{r}{L} \cdot t}\right) \quad \text{؛} \quad \frac{di}{dt} = I_0 \cdot \frac{r}{L} \cdot e^{-\frac{r}{L} \cdot t}$$

في عبارة المعادلة التفاضلية نجد:

$$0 = 0 \quad \text{(المعادلة التفاضلية محققة)}$$

**3- أ)** بالرجوع إلى العبارة المعطاة:

$$i(t) = 0,45 \left(1 - e^{-10t}\right)$$

نستنتج: $I_0 = 0,45 \text{ A}$

**ب)** في النظام الدائم: $\frac{di}{dt} = 0$

إذن: $E = r \cdot I_0$

$$r = 10 \; \Omega$$

**ج)** من العبارة $i(t) = 0,45 \left(1 - e^{-10t}\right)$ وبالمقارنة مع العبارة:

$$i(t) = I_0 \left(1 - e^{-\frac{r}{L} \cdot t}\right)$$

نجد: $\frac{r}{L} = 10 \text{ SI}$، $r = 10 \; \Omega$

$$L = 1 \text{ H}$$

**د)** $\tau = \frac{L}{r}$

$$\tau = 0,1 \text{ s}$$

**4- أ)** $E_0 = \frac{1}{2} L I_0^2 = 0,10125 \text{ J}$

**ب)** $u_{AB} = L \frac{di}{dt} + r \cdot i$

$$u_{AB}(t) = 4,5 \cdot e^{-10t} \text{ V}$$

**ج)** $t = 0,3 \text{ s}$:

$$u_{AB} = 3 \cdot 4,5 \cdot e^{-3} = 0,224 \text{ V}$$
