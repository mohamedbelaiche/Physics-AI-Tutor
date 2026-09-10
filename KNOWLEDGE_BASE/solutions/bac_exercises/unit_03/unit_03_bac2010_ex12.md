---
id: solution/unit_03_bac2010_ex12
type: solution
title_ar: حل بكالوريا 2010 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2010_ex12
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2010
stream: علوم تجريبية
topic: وشيعة RL
review_notes: ["RQ-001"]
---

# حل بكالوريا 2010 – شعبة علوم تجريبية – التمرين 12

**1** – تعريف كل من العبارة ur(t) و ub(t):

بالتعريف:

$$u_R(t) = R \cdot i(t)$$

$$u_b(t) = L \frac{di(t)}{dt} + r \cdot i(t)$$

**2** – المعادلة التفاضلية:

باتباع قانون جمع التوتر:

$$E = u_R + u_b = Ri + L\frac{di}{dt} + ri$$

$$\frac{E}{L} = \frac{di}{dt} + \frac{R+r}{L} i$$

**3** – إثبات أن العبارة:

$$i(t) = \frac{E}{R+r}\left(1 - e^{-\frac{R+r}{L}t}\right)$$

حل للمعادلة التفاضلية السابقة:

بإشتقاق عبارة التيار والتعويض في المعادلة التفاضلية:

$$\frac{di}{dt} = \frac{E}{R+r} \cdot \frac{R+r}{L} \cdot e^{-\frac{R+r}{L}t} = \frac{E}{L} e^{-\frac{R+r}{L}t}$$

$$\frac{E}{L} e^{-\frac{R+r}{L}t} + \frac{R+r}{L} \cdot \frac{E}{R+r}\left(1 - e^{-\frac{R+r}{L}t}\right) = \frac{E}{L}$$

ومنه، المعادلة محققة.

**4 – أ** – المقاومة r للوشيعة: بيانياً I₀ = 0.5 A، حيث:

$$I_0 = \frac{E}{R+r} \Rightarrow r = \frac{E}{I_0} - R = 2 \text{ Ω}$$

**ب** – تعيين ثابت الزمن τ وحساب الذاتية L للوشيعة:

بيانياً أو حسابياً، نجد:

$$\tau = 10 \text{ ms}$$

ومنه:

$$\tau = \frac{L}{R+r} \Rightarrow L = 0.12 \text{ H}$$

**5** – الطاقة الكهربائية Eb المخزنة في الوشيعة في النظام الدائم:

بالتعريف:

$$E_b = \frac{1}{2} L I_0^2 = 15 \text{ mJ}$$
