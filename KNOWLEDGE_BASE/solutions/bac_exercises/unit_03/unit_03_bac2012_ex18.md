---
id: solution/unit_03_bac2012_ex18
type: solution
title_ar: حل بكالوريا 2012 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2012_ex18
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2012
stream: رياضي + تقني رياضي
topic: مكثفة RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2012 – شعبة رياضي + تقني رياضي – التمرين 18

## أولًا:

**أ – عبارة التوتر $u_{AB}$:**

$$u_{AB} = \frac{q}{C} = \frac{i \cdot t}{C}$$

**ب – معادلة المنحنى البياني:**

$$u_{AB} = a \cdot t$$

بحساب $C$ بمطابقة العلاقةين:

$$a = \frac{71{,}5 \times 10^{-3}}{15 \times 10^{-3}} = 4{,}77$$

$$C = \frac{1}{a} = 0{,}31 \times 10^{-3} = 0{,}54 \text{ mF}$$

**أو:** عندما تشحن المكثفة تمامًا (من البيان: $U_0 = 1{,}6$ V، $t_0 = 28$ s):

$$C = \frac{i \cdot t_0}{U_0} = 5{,}4 \times 10^{-3} = 5{,}4 \text{ mF}$$

## ثانيًا:

**أ – المعادلة التفاضلية:**

من قانون جمع التوتر: $u_{AB} + u_C = 0$

$$\frac{du_{AB}}{dt} + \frac{u_{AB}}{RC} = 0$$

**ب – قيمة ثابت الزمن $\tau$ للدار:**

من معادلة المنحنى البياني: $\ln(u_{AB}) = a \cdot t$

$$u_{AB} = U_0 \cdot e^{-t/\tau}$$

$$\tau = \frac{t}{\ln\left(\frac{U_{AB}}{U_{AB}}\right)}$$

بمطابقة العلاقةين:

$$\tau = \frac{1}{a} \approx 0{,}187 \text{ s}$$

**قيمة سعة المكثفة $C$:**

$$\tau = R \cdot C \Rightarrow C = \frac{\tau}{R} = \frac{5{,}4}{1000} = 5{,}4 \text{ mF}$$
