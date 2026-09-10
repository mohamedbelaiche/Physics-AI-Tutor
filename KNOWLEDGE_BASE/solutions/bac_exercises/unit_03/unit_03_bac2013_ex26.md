---
id: solution/unit_03_bac2013_ex26
type: solution
title_ar: حل بكالوريا 2013 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2013_ex26
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2013
stream: علوم تجريبية
topic: وشيعة RL – الشحن
review_notes: ["RQ-001"]
---

# حل بكالوريا 2013 – شعبة علوم تجريبية

## التمرين 26

**1- الرسم:**

**2- المعادلة التفاضلية:**

بتطبيق قانون جمع التوتر:

$$u_{BA} + u_R = E$$

ومنه:

$$\frac{R+r}{R} \cdot u_R + u_R = E$$

أي:

$$\frac{du}{dt} + \frac{R+r}{L} \cdot u = \frac{R+r}{L} \cdot E$$

**3- الحل:**

$$u = A \cdot e^{-t/\tau}$$

ومنه:

$$A = \frac{R \cdot E}{R+r}$$

$$\tau = \frac{L}{R+r}$$

**4- التحليل البعدي:**

$$[\tau] = \frac{[U]}{[T]} \cdot [I] = \frac{[U] \cdot [T]}{[I]} = [T]$$

قيمة:

$$\tau = 0.63 \cdot 2 \cdot R_R \cdot u_{max}$$

بالتالي:

$$\tau = 1.2 \text{ ms}$$

**5- قيمة L:**

$$L = \tau \cdot (R+r) = 18 \times 10^{-3} \text{ H}$$

و:

$$u_R = \frac{R}{R+r} \cdot E = 4.8 \text{ V}$$
