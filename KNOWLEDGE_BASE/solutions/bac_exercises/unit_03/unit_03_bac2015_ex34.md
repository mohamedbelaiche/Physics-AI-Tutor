---
id: solution/unit_03_bac2015_ex34
type: solution
title_ar: حل بكالوريا 2015 – شعبة علوم تجريبية
exercise_ref: exercise/unit_03_bac2015_ex34
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2015
stream: علوم تجريبية
topic: مكثفة RC – التفريغ
review_notes: ["RQ-001"]
---

# حل بكالوريا 2015 – شعبة علوم تجريبية

## التمرين 34

**1-**

الشكل 3: تفريغ

الشكل 4: شحن

الجهاز المستعمل: جهاز الـ ExAO أو جهاز راسم الإهتزاز.

**2- المعادلة التفاضلية أثناء التفريغ:**

$$u_{AB} + u_R' = 0$$

حيث:

$$u_R' = R' \cdot i = R' \cdot C \cdot \frac{du_{AB}}{dt}$$

ومنه:

$$R' \cdot C \frac{du_{AB}}{dt} + u_{AB} = 0$$

أو:

$$\frac{du_{AB}}{dt} + \frac{1}{R'C} \cdot u_{AB} = 0$$

وهي معادلة تفاضلية من الرتبة الأولى بالنسبة لـ $u_{AB}(t)$.

**3- التحقق من الحل:**

$$u_{AB}(t) = A \cdot e^{-t/(R'C)}$$

$$\frac{du_{AB}}{dt} = -\frac{A}{R'C} \cdot e^{-t/(R'C)}$$

بالتعويض نجد:

$$-\frac{A}{R'C} \cdot e^{-t/(R'C)} + \frac{1}{R'C} \cdot A \cdot e^{-t/(R'C)} = 0$$

(المعادلة محققة).

لما $t = 0$ تكون:

$$u_{AB}(0) = A \cdot e^0 = A = E$$

فإن:

$$A = E$$

**4- العبارة شدة التيار:**

$$i(t) = -C \frac{du_{AB}}{dt} = -C \cdot A \cdot \left(-\frac{1}{R'C}\right) \cdot e^{-t/(R'C)} = \frac{E}{R'} \cdot e^{-t/(R'C)}$$

ملاحظة: يمكن استنتاج $i(t)$ من قانون جمع التوتر.

**5-**

من الشكل 4: من أجل $u_{AB} = 0.63 \cdot E = 7.5 \text{ V}$

وبإسقاط نجد: $\tau = 0.2 \text{ s}$
