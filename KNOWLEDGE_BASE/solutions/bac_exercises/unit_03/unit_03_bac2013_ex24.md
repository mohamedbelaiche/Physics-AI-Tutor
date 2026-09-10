---
id: solution/unit_03_bac2013_ex24
type: solution
title_ar: حل بكالوريا 2013 – شعبة رياضي + تقني رياضي
exercise_ref: exercise/unit_03_bac2013_ex24
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2013
stream: رياضي + تقني رياضي
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2013 – شعبة رياضي + تقني رياضي – التمرين 24

## 1 – المعادلة التفاضلية:

$$u_R + r \cdot i + L \cdot \frac{di}{dt} = E$$

لكن: $u_R = R \cdot i$ و $\frac{du_R}{dt} = R \cdot \frac{di}{dt}$

ومنه:

$$\frac{R + r}{L} \cdot u_R + \frac{R}{L} \cdot \frac{du_R}{dt} = \frac{R}{L} \cdot E$$

## 2 – حلها:

لدينا:

$$u_R(t) = A - B \cdot e^{-\lambda t}$$

ومنه:

$$\frac{du_R}{dt} = -B \cdot \lambda \cdot e^{-\lambda t}$$

بالتعويض نجد:

$$B \cdot \lambda \cdot e^{-\lambda t} + \frac{r + R}{L} \cdot \left(A - B \cdot e^{-\lambda t}\right) = \frac{R + r}{L} \cdot A + \frac{R}{L} \cdot E$$

$$\Rightarrow \lambda = \frac{r + R}{L}$$

$$B = \frac{R}{L} \cdot E$$

## 3 –

**أ –**

**ب –**

- المنحنى (1) يمثل $u_R$: لأنّ عندما $t = 0$ فإن $u_R = 0$.
- المنحنى (2) يمثل $u_b$: لأنّ عندما $t = 0$ فإن $u_b = E$.

**ج – قيمة $E$:**

من البيان (2): $E = 10$ V.

من البيان (2): $u_b(t \to \infty) = \frac{r \cdot E}{R + r} = 1$ V

$$\Rightarrow \frac{r}{R + r} = \frac{1}{10} \Rightarrow R + r = 10 \text{ } \Omega$$

## 4 –

**أ – إثبات العلاقة:**

$$\tau = \frac{R}{R + r} \cdot \ln 2$$

عند النقطة $C$ يكون $u_b = u_R$:

$$\frac{r \cdot E}{R + r} + \frac{R \cdot E}{R + r} \cdot e^{-t_C/\tau} = \frac{R \cdot E}{R + r} \cdot \left(1 - e^{-t_C/\tau}\right)$$

ومنه:

$$\tau = \frac{R}{R + r} \cdot \ln 2$$

$$\tau = 10 \text{ ms}$$

**ب – ذاتية الوشيعة:**

$$L = \tau \cdot (R + r) = 1{,}0 \text{ H}$$
