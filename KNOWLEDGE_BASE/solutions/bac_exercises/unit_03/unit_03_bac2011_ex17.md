---
id: solution/unit_03_bac2011_ex17
type: solution
title_ar: حل بكالوريا 2011 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2011_ex17
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2011
stream: علوم تجريبية
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2011 – شعبة علوم تجريبية – التمرين 17

**1 – أ** – طريقة الربط بالأوزان المهبطية لجهاز الاهتزاز (الشكل):

**المدخل 1 Y:** نشاهد ub(t).

**المدخل 2 Y:** نشاهد معكوس ur(t) لذا نضغط على الزر INV.

**ب** – المنحنى (1): يمثل تطور ur(t) حيث: عند t = 0، ur(0) = 0.

المنحنى (2): يمثل تطور ub(t) حيث: ub(0) ≠ 0.

**2 – أ** – المعادلة التفاضلية لـ i(t):

$$u_R(t) + u_b(t) = E$$

حيث:

$$u_R(t) = R \cdot i(t)$$

$$u_b(t) = L\frac{di(t)}{dt} + r \cdot i(t)$$

$$\frac{di(t)}{dt} + \frac{R+r}{L} i(t) = \frac{E}{L}$$

وهي من الشكل:

$$\frac{di(t)}{dt} + Ai(t) = B$$

**ب** – تعيين كل من العبارة A و B:

$$A = \frac{R+r}{L}$$

$$B = \frac{E}{L}$$

**ج** – التحقق من أن:

$$i(t) = \frac{B}{A}\left(1 - e^{-At}\right)$$

هو حل للم. ت:

بالشتقاق:

$$\frac{di(t)}{dt} = B \cdot e^{-At}$$

بالتعويض نجد: B = B

**د** – حساب شدة التيار في النظام الدائم:

$$u_R = R \cdot I_0 \Rightarrow I_0 = 0.1 \text{ A}$$

**هـ** – حساب القيم E و r و τ و L:

في النظام الدائم:

$$u_R + u_b = E \Rightarrow E = 10 + 2 = 12 \text{ V}$$

$$u_b = r \cdot I_0 \Rightarrow r = \frac{2}{0.1} = 20 \text{ Ω}$$

من الرسم:

$$\tau = 10 \text{ ms}$$ (طريقة المماس)

$$L = \tau(R+r) = (R+r)\tau = 1.2 \text{ H}$$

**و** – حساب الطاقة المخزنة في الوشيعة:

$$E_L = \frac{1}{2} L I_0^2 = 6 \times 10^{-3} \text{ J}$$
