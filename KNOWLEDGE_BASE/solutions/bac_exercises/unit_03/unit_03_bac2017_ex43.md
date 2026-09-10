---
id: solution/unit_03_bac2017_ex43
type: solution
title_ar: حل بكالوريا 2017 – شعبة رياضيات + تقني رياضي (الدورة الإضافية)
exercise_ref: exercise/unit_03_bac2017_ex43
source_refs:
  - api/data/البيانات/الوحدة الثالثة/تجميعية_عمورة_للبكالوريات_السابقة_الوحدة_3.pdf
status: needs_review
year: 2017
stream: رياضيات + تقني رياضي
topic: وشيعة (RL)
review_notes: ["RQ-001"]
---

# حل بكالوريا 2017 – شعبة رياضيات + تقني رياضي (الدورة الإضافية)

## 1. الظاهرة التي تحدث في الدار

الظاهرة هي التحريض الذاتي (انقطاعة التيار تدريجياً).

## 2. المعادلة التفاضلية

حسب قانون جمع التوتر:

$$u_R + u_b = 0$$

$$u_R + L \cdot \frac{di}{dt} + ri = 0$$

$$\frac{du_R}{R} + \frac{L}{R} \cdot \frac{di}{dt} + \frac{r}{R} \cdot u_R = 0$$

$$\frac{du_R}{dt} + \frac{R + r}{L} \cdot u_R = 0$$

## 3. إيجاد عبارتي $A$ و $\alpha$

الحل هو: $u_R(t) = A \cdot e^{-\alpha t}$

باشتقاقه نجد: $\frac{du_R}{dt} = -A\alpha \cdot e^{-\alpha t}$

بالتعويض في المعادلة التفاضلية نجد:

$$\tau = \alpha = \frac{L}{R + r}$$

ومن الشروط الابتدائية نجد: $u_R(0) = RI_0 = A \implies A = RI_0$

ومنه الحل هو:

$$u_R(t) = RI_0 \cdot e^{-t/\tau}$$

## إيجاد عبارة $i(t)$

لدينا: $i(t) = \frac{u_R(t)}{R} = I_0 \cdot e^{-t/\tau}$

## 4. عبارة الاستطاعة

$$P(t) = R \cdot i^2(t) = RI_0^2 \cdot e^{-2t/\tau} = P_{\max} \cdot e^{-2t/\tau}$$

حيث $P_{\max} = RI_0^2$

## 5-أ. مماس البرم

لدينا معامل توجيه المماس:

$$a_{\max} = \left.\frac{dP}{dt}\right|_{\max} = -\frac{P_{\max}}{\tau} \cdot 2 \cdot e^{-2t/\tau}$$

$$a = \left.\frac{dP}{dt}\right|_{t} = -\frac{2P_{\max}}{\tau} \cdot e^{-2t/\tau}$$

ولدينا معامل توجيه المماس بيانياً:

$$a_{\max} = \text{tg } t = -\frac{P_{\max}}{t'}$$

بمطابقة نجد:

$$\tau = \frac{2P_{\max}}{P_{\max} \cdot t'} = \frac{2}{t'}$$

استنتاج ثابت الزمن: من البيان نجد:

$$P_{\max} = 5 \times 10^{-2} \text{ ms} \implies \tau = 2 \text{ ms}$$

## 5-ب. شدة التيارعظمى

$$P_{\max} = R \cdot I_0^2 \implies I_0 = \sqrt{\frac{P_{\max}}{R}}$$

ومنه:

$$I_0 = \frac{50 \times 10^{-3}}{0{,}1} = 0{,}1 \text{ A}$$

## 5-ج. إيجاد عبارتي $r$ و $L$

### إيجاد $r$:

$$E = I_0(R + r) \implies r = \frac{E}{I_0} - R$$

ومنه:

$$r = \frac{6}{0{,}1} - 50 = 10 \; \Omega$$

### إيجاد $L$:

$$L = \tau(R + r)$$

ومنه:

$$L = 0{,}01 \times (50 + 10) = 0{,}6 \text{ H}$$

## 6. زمن تناقص الاستطاعة إلى النصف

لدينا:

$$\frac{1}{2} P_{\max} = P_{\max} \cdot e^{-2t_{1/2}/\tau}$$

$$e^{-2t_{1/2}/\tau} = \frac{1}{2} \implies \frac{2t_{1/2}}{\tau} = \ln 2 \implies t_{1/2} = \frac{\tau \cdot \ln 2}{2}$$

ومنه:

$$t_{1/2} = 3{,}46 \text{ ms}$$
