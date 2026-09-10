---
id: solution/unit_03_bac2013_ex25
type: solution
title_ar: حل بكالوريا 2013 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2013_ex25
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2013
stream: علوم تجريبية
topic: مكثفة RC
review_notes: ["RQ-001"]
---

# حل بكالوريا 2013 – شعبة علوم تجريبية – التمرين 25

## 1 – رسم الدارة الكهربائية:

(يرسم الدارة())

## 2 – المعادلة التفاضلية:

$$u_R + u_C = E$$

ومنه:

$$\frac{dq}{dt} + \frac{q}{RC} = \frac{E}{R}$$

## 3 – عبارة الثوابت:

$$q(t) = A \cdot e^{\alpha t} + B$$

ولدينا:

$$q(0) = A + B = 0 \Rightarrow A = -B \quad \text{... (1)}$$

بتعويض الحل في المعادلة التفاضلية نجد:

$$A \cdot \alpha \cdot e^{\alpha t} + \frac{A \cdot e^{\alpha t} + B}{RC} = \frac{E}{R}$$

ومنه:

$$B = CE$$

ومنه: $A = -CE$

و $\alpha = -\frac{1}{RC}$

## 4 –

**أ – قيمة $\tau$:**

$$q_{\max} = 0{,}63 \times 4{,}8 \times 10^{-4} = 3{,}0 \times 10^{-4}$$

$$\tau = 39 \text{ ms}$$

$$C = \frac{\tau}{R} = \frac{39 \times 10^{-3}}{6} = 39 \text{ } \mu\text{F}$$

**ب – قيمة $E$:**

$$q_{\max} = CE \Rightarrow E = 12 \text{ V}$$

**ج –**

$$E_C = \frac{q^2}{2C} = \frac{(200)^2}{2} = 2{,}9 \times 10^{-3} \text{ J}$$
