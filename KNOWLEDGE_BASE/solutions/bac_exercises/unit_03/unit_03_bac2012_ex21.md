---
id: solution/unit_03_bac2012_ex21
type: solution
title_ar: حل بكالوريا 2012 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2012_ex21
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2012
stream: علوم تجريبية
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2012 – شعبة علوم تجريبية – التمرين 21

## 1 –

**أ –** إزهاز هو اهتزاز تناظري.

**ب –** $u_R = R \cdot i \Rightarrow u_R = R \cdot i$

لكن $R$ ثابتة ومنه: تتغير $i$ بنفسها تغير $u_R$.

## 2 –

**أ –**

$$u_b + u_R = E$$

$$L \cdot \frac{di}{dt} + (R + r) \cdot i = E$$

ومنه:

$$\frac{di}{dt} + \frac{R + r}{L} \cdot i = \frac{E}{L}$$

**ب –** نعوض الحل في المعادلة:

$$A \cdot e^{-t/\tau} \cdot \left(-\frac{1}{\tau}\right) + (R + r) \cdot \left(A \cdot e^{-t/\tau} + \frac{E}{R + r}\right) = E$$

$$\Rightarrow (R + r) \cdot A = 0$$

و $\tau = \frac{L}{R + r}$

ومنه:

$$A = I_0 = \frac{E}{R + r}$$

ويمثل شدة التيار أعظمي.

$$\tau = \frac{L}{R + r}$$

ويمثل ثابت الزمن المميز للدار.

## 3 –

**أ –**

| المنحنى | التجربة | التعليل |
|---------|---------|--------|
| 1 | 2 | ألم: $I_{02} = I_{01}$ و $\tau_2 > \tau_1$ |
| 2 | 3 | $I_{03} < I_{02} = I_{01}$ |

**ب –**

$$\tau_1 = \frac{L}{R + r} \Rightarrow r_1 = \frac{L}{\tau_1} - R$$

من البيان: $\tau_3 = 0{,}10$ ms

$$r = 10 \text{ } \Omega$$
